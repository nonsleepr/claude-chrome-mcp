/**
 * Chrome Native Messaging Protocol Handler
 * 
 * Implements bidirectional communication with Chrome extension via stdio.
 * Wire format: [4 bytes length (LE uint32)][N bytes JSON (UTF-8)]
 * 
 * Message flow:
 * - Chrome sends: ping, get_status, tool_response, mcp_connected, mcp_disconnected
 * - We send: pong, status_response, tool_request
 */

import { EventEmitter } from 'events';

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1 MB

// Message types from Chrome extension
export interface ToolResponseMessage {
  type: 'tool_response';
  result?: {
    content: unknown;
    tabContext?: TabContext;
  };
  error?: {
    content: string;
  };
}

export interface PingMessage {
  type: 'ping';
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export interface StatusResponseMessage {
  type: 'status_response';
  native_host_version?: string;
}

export interface McpConnectedMessage {
  type: 'mcp_connected';
}

export interface McpDisconnectedMessage {
  type: 'mcp_disconnected';
}

export interface GetStatusMessage {
  type: 'get_status';
}

export type ChromeMessage =
  | ToolResponseMessage
  | PingMessage
  | PongMessage
  | GetStatusMessage
  | StatusResponseMessage
  | McpConnectedMessage
  | McpDisconnectedMessage;

// Tab context returned with tool responses
export interface TabContext {
  currentTabId: number;
  executedOnTabId?: number;
  availableTabs: Array<{ tabId: number; title: string; url: string }>;
  tabCount: number;
  tabGroupId?: number;
}

// Tool response structure
export interface ToolResponse {
  content?: unknown;
  error?: string;
  tabContext?: TabContext;
}

// Event types emitted by NativeHost
export interface NativeHostEvents {
  'tool_response': (response: ToolResponseMessage) => void;
  'ping': (message: PingMessage) => void;
  'pong': (message: PongMessage) => void;
  'get_status': (message: GetStatusMessage) => void;
  'status_response': (message: StatusResponseMessage) => void;
  'mcp_connected': () => void;
  'mcp_disconnected': () => void;
  'close': () => void;
  'error': (error: Error) => void;
}

export class NativeHost extends EventEmitter {
  private buffer: Buffer = Buffer.alloc(0);
  private running = false;

  constructor() {
    super();
  }

  /**
   * Start reading from stdin (Chrome sends messages here)
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Use readable event for proper flow control
    process.stdin.on('readable', () => {
      this.readFromStdin();
    });

    process.stdin.on('end', () => {
      this.running = false;
      this.emit('close');
    });

    process.stdin.on('error', (err) => {
      this.emit('error', err);
    });

    // Ensure stdin is in raw mode for binary data
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
  }

  /**
   * Stop the native host
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Send a message to Chrome (via stdout)
   */
  send(message: unknown): void {
    const payload = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    
    process.stdout.write(header);
    process.stdout.write(payload);
  }

  /**
   * Send a tool request to Chrome for execution
   */
  sendToolRequest(tool: string, args: Record<string, unknown>, clientId?: string): void {
    this.send({
      type: 'tool_request',
      method: 'execute_tool',
      params: {
        tool,
        args,
        client_id: clientId,
      },
    });
  }

  /**
   * Send ping to check if Chrome is alive
   */
  sendPing(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Send pong in response to ping
   */
  sendPong(): void {
    this.send({ type: 'pong', timestamp: Date.now() });
  }

  /**
   * Request status from Chrome
   */
  sendGetStatus(): void {
    this.send({ type: 'get_status' });
  }

  /**
   * Send status response
   */
  sendStatusResponse(version: string): void {
    this.send({ type: 'status_response', native_host_version: version });
  }

  /**
   * Notify Chrome that an MCP client connected
   */
  sendMcpConnected(): void {
    this.send({ type: 'mcp_connected' });
  }

  /**
   * Notify Chrome that an MCP client disconnected
   */
  sendMcpDisconnected(): void {
    this.send({ type: 'mcp_disconnected' });
  }

  /**
   * Read available data from stdin
   */
  private readFromStdin(): void {
    let chunk: Buffer | null;
    while ((chunk = process.stdin.read()) !== null) {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    }
  }

  /**
   * Process buffered data and extract complete messages
   */
  private processBuffer(): void {
    while (this.buffer.length >= 4) {
      // Read message length (4 bytes, little-endian)
      const length = this.buffer.readUInt32LE(0);

      // Validate message size
      if (length === 0 || length > MAX_MESSAGE_SIZE) {
        console.error(`[NativeHost] Invalid message length: ${length}`);
        this.buffer = Buffer.alloc(0);
        this.emit('error', new Error(`Invalid message length: ${length}`));
        return;
      }

      // Check if we have the complete message
      if (this.buffer.length < 4 + length) {
        // Wait for more data
        return;
      }

      // Extract the message payload
      const payload = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.subarray(4 + length);

      // Parse and handle the message
      try {
        const message = JSON.parse(payload.toString('utf-8')) as ChromeMessage;
        this.handleMessage(message);
      } catch (err) {
        console.error('[NativeHost] Failed to parse message:', err);
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  /**
   * Handle a parsed message from Chrome
   */
  private handleMessage(message: ChromeMessage): void {
    switch (message.type) {
      case 'ping':
        this.emit('ping', message);
        break;

      case 'pong':
        this.emit('pong', message);
        break;

      case 'get_status':
        this.emit('get_status', message);
        break;

      case 'status_response':
        this.emit('status_response', message);
        break;

      case 'tool_response':
        this.emit('tool_response', message);
        break;

      case 'mcp_connected':
        this.emit('mcp_connected');
        break;

      case 'mcp_disconnected':
        this.emit('mcp_disconnected');
        break;

      default:
        console.error(`[NativeHost] Unknown message type: ${(message as { type: string }).type}`);
    }
  }
}
