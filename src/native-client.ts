/**
 * Native Host Socket Client
 * 
 * Connects to the Claude Code native host via Unix socket and provides
 * a Promise-based interface for tool execution.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1 MB

export interface ToolRequest {
  tool: string;
  args: Record<string, unknown>;
  tabId?: number;
  tabGroupId?: number;
}

export interface ToolResponse {
  content?: string | Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  error?: string;
  tabContext?: {
    currentTabId: number;
    executedOnTabId: number;
    availableTabs: Array<{ id: number; title: string; url: string }>;
    tabCount: number;
    tabGroupId?: number;
  };
}

interface PendingRequest {
  resolve: (response: ToolResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class NativeHostClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private connected: boolean = false;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private requestId: number = 0;
  private nativeHostProcess: ChildProcess | null = null;
  private socketPath: string;
  private requestTimeout: number;

  constructor(options: { socketPath?: string; requestTimeout?: number } = {}) {
    super();
    this.socketPath = options.socketPath || this.getDefaultSocketPath();
    this.requestTimeout = options.requestTimeout || 60000; // 60 seconds default
  }

  private getDefaultSocketPath(): string {
    const username = process.env.USER || process.env.USERNAME || 'unknown';
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\claude-mcp-browser-bridge-${username}`;
    }
    return `/tmp/claude-mcp-browser-bridge-${username}`;
  }

  /**
   * Spawn the native host process if not already running
   */
  async spawnNativeHost(): Promise<void> {
    // Find claude executable
    const claudePath = await this.findClaudePath();
    if (!claudePath) {
      throw new Error('Claude CLI not found. Please install Claude Code first.');
    }

    console.error(`[NativeHostClient] Spawning native host: ${claudePath} --chrome-native-host`);
    
    this.nativeHostProcess = spawn(claudePath, ['--chrome-native-host'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: false,
    });

    this.nativeHostProcess.on('error', (err) => {
      console.error('[NativeHostClient] Native host process error:', err);
      this.emit('error', err);
    });

    this.nativeHostProcess.on('exit', (code) => {
      console.error(`[NativeHostClient] Native host process exited with code ${code}`);
      this.nativeHostProcess = null;
    });

    // Wait for the socket to become available
    await this.waitForSocket(5000);
  }

  private async findClaudePath(): Promise<string | null> {
    const { execSync } = await import('child_process');
    try {
      const result = execSync('which claude', { encoding: 'utf-8' }).trim();
      return result || null;
    } catch {
      // Try common paths
      const paths = [
        `${process.env.HOME}/.local/bin/claude`,
        `${process.env.HOME}/.npm-global/bin/claude`,
        '/usr/local/bin/claude',
      ];
      const fs = await import('fs');
      for (const p of paths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      return null;
    }
  }

  private async waitForSocket(timeout: number): Promise<void> {
    const start = Date.now();
    const fs = await import('fs');
    
    while (Date.now() - start < timeout) {
      if (process.platform !== 'win32') {
        if (fs.existsSync(this.socketPath)) {
          // Socket file exists, now verify it's accepting connections
          try {
            const testSocket = net.createConnection(this.socketPath);
            await new Promise<void>((resolve, reject) => {
              testSocket.on('connect', () => {
                testSocket.destroy();
                resolve();
              });
              testSocket.on('error', reject);
              setTimeout(() => reject(new Error('Test connection timeout')), 1000);
            });
            // Successfully connected - socket is ready
            return;
          } catch (err) {
            // Socket exists but not ready yet, continue waiting
          }
        }
      } else {
        // On Windows, just wait a bit
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(`Socket ${this.socketPath} not available after ${timeout}ms`);
  }

  /**
   * Connect to the native host socket
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);
      let connectionResolved = false;

      const onConnect = () => {
        console.error(`[NativeHostClient] Connected to ${this.socketPath}`);
        this.connected = true;
        connectionResolved = true;
        
        this.emit('connected');
        resolve();
      };

      const onError = (err: Error) => {
        if (!connectionResolved) {
          // Connection phase error
          console.error('[NativeHostClient] Connection failed:', err);
          
          // Clean up listeners
          this.socket?.removeListener('connect', onConnect);
          
          // Only emit error event if there are listeners to prevent unhandled error
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
          
          connectionResolved = true;
          reject(err);
        } else {
          // Runtime error after successful connection
          console.error('[NativeHostClient] Socket error:', err);
          // Only emit if we have listeners
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
        }
      };

      this.socket.once('connect', onConnect);
      this.socket.on('error', onError);

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        console.error('[NativeHostClient] Socket closed');
        this.connected = false;
        this.emit('disconnected');
        
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
      });
    });
  }

  /**
   * Disconnect from the native host
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    if (this.nativeHostProcess) {
      this.nativeHostProcess.kill();
      this.nativeHostProcess = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected to native host
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Execute a tool via the native host
   */
  async executeTool(request: ToolRequest): Promise<ToolResponse> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to native host');
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Tool execution timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send tool request in native host format
      // Note: tabId and tabGroupId should be inside args per extension code
      const args = { ...request.args };
      if (request.tabId !== undefined) {
        args.tabId = request.tabId;
      }
      if (request.tabGroupId !== undefined) {
        args.tabGroupId = request.tabGroupId;
      }
      
      const message = {
        method: 'execute_tool',
        params: {
          tool: request.tool,
          args,
        },
      };

      this.sendMessage(message);
    });
  }

  private sendMessage(message: unknown): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    const payload = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);

    this.socket.write(header);
    this.socket.write(payload);
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    this.processBuffer();
  }

  private processBuffer(): void {
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);

      if (length === 0 || length > MAX_MESSAGE_SIZE) {
        console.error(`[NativeHostClient] Invalid message length: ${length}`);
        this.buffer = Buffer.alloc(0);
        return;
      }

      if (this.buffer.length < 4 + length) {
        // Not enough data yet
        return;
      }

      const payload = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);

      try {
        const message = JSON.parse(payload.toString('utf-8'));
        this.handleMessage(message);
      } catch (err) {
        console.error('[NativeHostClient] Failed to parse message:', err);
      }
    }
  }

  private handleMessage(message: unknown): void {
    // The native host sends responses for all pending requests
    // Since we don't have request IDs in the protocol, we resolve the oldest pending request
    
    // Native host wraps responses in { result: {...} } or { error: {...} }
    const rawMessage = message as { result?: ToolResponse; error?: unknown };
    let response: ToolResponse;
    
    if (rawMessage.result) {
      response = rawMessage.result;
    } else if (rawMessage.error) {
      response = { error: typeof rawMessage.error === 'string' ? rawMessage.error : JSON.stringify(rawMessage.error) };
    } else {
      // Fallback - treat the whole message as the response
      response = message as ToolResponse;
    }
    
    // Get the oldest pending request
    const iterator = this.pendingRequests.entries().next();
    if (!iterator.done) {
      const [id, pending] = iterator.value;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(id);
      pending.resolve(response);
    } else {
      // No pending request, emit as event
      this.emit('message', message);
    }
  }
}
