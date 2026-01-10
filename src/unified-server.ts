/**
 * Unified Server - Native Host + MCP HTTP Server
 * 
 * Single process that:
 * 1. Acts as Chrome's native messaging host (stdin/stdout)
 * 2. Exposes MCP tools via HTTP (/mcp endpoint)
 * 3. Routes tool requests between MCP clients and Chrome extension
 * 
 * The Chrome extension executes all browser tools via CDP (Chrome DevTools Protocol).
 * This server is just a message router/proxy.
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'net';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IncomingMessage, ServerResponse, Server as HttpServer } from 'http';
import { z } from 'zod';

import { NativeHost, ToolResponseMessage, TabContext } from './native-host.js';
import { allTools } from './tools.js';

const VERSION = '1.0.0';
const DEFAULT_PORT = 3456;
const TOOL_TIMEOUT_MS = 60000; // 60 seconds

export interface UnifiedServerOptions {
  port?: number;
  host?: string;
}

interface PendingToolRequest {
  resolve: (response: ToolResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface Session {
  id: string;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
}

// MCP content types
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: string };
type McpContent = TextContent | ImageContent;
type ToolResult = { content: McpContent[] };

export class UnifiedServer {
  private nativeHost: NativeHost;
  private app: express.Application;
  private httpServer: HttpServer | null = null;
  private mcpServer: McpServer;
  private sessions = new Map<string, Session>();
  private pendingToolRequests = new Map<string, PendingToolRequest>();
  private requestId = 0;
  private actualPort = 0;
  private options: UnifiedServerOptions;

  constructor(options: UnifiedServerOptions = {}) {
    this.options = options;
    this.nativeHost = new NativeHost();
    this.app = express();
    
    // Initialize MCP server
    this.mcpServer = new McpServer({
      name: 'claude-chrome-mcp',
      version: VERSION,
    });

    this.setupNativeHostHandlers();
    this.setupHttpServer();
    this.registerTools();
  }

  /**
   * Start the unified server
   */
  async start(): Promise<void> {
    // Find available port
    const preferredPort = this.options.port ?? DEFAULT_PORT;
    this.actualPort = await this.findAvailablePort(preferredPort);

    // Start HTTP server
    await this.startHttpServer();

    // Start native host (stdin reading)
    this.nativeHost.start();

    // Log to stderr (stdout is reserved for Chrome protocol)
    console.error(`[UnifiedServer] Started - MCP endpoint: http://localhost:${this.actualPort}/mcp`);
  }

  /**
   * Stop the server
   */
  stop(): void {
    this.nativeHost.stop();
    this.cleanupAllSessions();
    if (this.httpServer) {
      this.httpServer.close();
    }
  }

  /**
   * Get the actual port the server is listening on
   */
  getPort(): number {
    return this.actualPort;
  }

  /**
   * Find an available port, starting with preferred port
   */
  private async findAvailablePort(preferred: number): Promise<number> {
    return new Promise((resolve) => {
      const testServer = createServer();
      
      testServer.once('error', () => {
        // Preferred port is busy, let OS assign one
        const fallbackServer = createServer();
        fallbackServer.listen(0, '127.0.0.1', () => {
          const addr = fallbackServer.address();
          const port = typeof addr === 'object' && addr ? addr.port : 0;
          fallbackServer.close(() => resolve(port));
        });
      });

      testServer.listen(preferred, '127.0.0.1', () => {
        testServer.close(() => resolve(preferred));
      });
    });
  }

  /**
   * Set up handlers for messages from Chrome extension
   */
  private setupNativeHostHandlers(): void {
    // Handle tool responses from Chrome
    this.nativeHost.on('tool_response', (response: ToolResponseMessage) => {
      // Chrome doesn't include request ID in responses, so we resolve FIFO
      const iterator = this.pendingToolRequests.entries().next();
      if (!iterator.done) {
        const [id, pending] = iterator.value;
        clearTimeout(pending.timeout);
        this.pendingToolRequests.delete(id);

        if (response.error) {
          const errorMsg = typeof response.error.content === 'string'
            ? response.error.content
            : JSON.stringify(response.error.content);
          pending.resolve({
            content: [{ type: 'text', text: `Error: ${errorMsg}` }],
          });
        } else if (response.result) {
          pending.resolve(this.formatToolResponse(response.result));
        } else {
          pending.resolve({
            content: [{ type: 'text', text: 'Tool executed successfully.' }],
          });
        }
      }
    });

    // Handle MCP endpoint query from Chrome
    this.nativeHost.on('get_mcp_endpoint', () => {
      this.nativeHost.sendMcpEndpoint(`http://localhost:${this.actualPort}/mcp`);
    });

    // Handle pong (health check response)
    this.nativeHost.on('pong', () => {
      console.error('[UnifiedServer] Received pong from Chrome');
    });

    // Handle status response
    this.nativeHost.on('status_response', (msg) => {
      console.error('[UnifiedServer] Chrome status:', msg);
    });

    // Handle connection state changes
    this.nativeHost.on('mcp_connected', () => {
      console.error('[UnifiedServer] MCP client connected notification from Chrome');
    });

    this.nativeHost.on('mcp_disconnected', () => {
      console.error('[UnifiedServer] MCP client disconnected notification from Chrome');
    });

    // Handle errors
    this.nativeHost.on('error', (err) => {
      console.error('[UnifiedServer] Native host error:', err);
    });

    // Handle close
    this.nativeHost.on('close', () => {
      console.error('[UnifiedServer] Chrome disconnected, shutting down...');
      this.stop();
      process.exit(0);
    });
  }

  /**
   * Set up the Express HTTP server with /mcp endpoint
   */
  private setupHttpServer(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // Security: Validate Origin header to prevent DNS rebinding
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const url = new URL(origin);
          if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
            console.error(`[HTTP] Rejected request from origin: ${origin}`);
            res.status(403).json({ error: 'Forbidden: Invalid origin' });
            return;
          }
        } catch {
          // Invalid URL, allow it (might be a non-browser client)
        }
      }
      next();
    });

    // CORS headers for local development
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
      res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // MCP endpoint - handles all MCP protocol messages
    this.app.all('/mcp', async (req: Request, res: Response) => {
      await this.handleMcpRequest(req, res);
    });
  }

  /**
   * Handle MCP protocol requests
   */
  private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // For initialization requests (no session ID), create a new session
    if (!sessionId && req.method === 'POST') {
      const newSessionId = randomUUID();
      console.error(`[HTTP] New MCP session: ${newSessionId}`);

      try {
        // Create transport with session ID generator
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });

        // Store session
        const session: Session = {
          id: newSessionId,
          transport,
          createdAt: new Date(),
        };
        this.sessions.set(newSessionId, session);

        // Connect MCP server to transport
        await this.mcpServer.connect(transport);

        // Handle cleanup when transport closes
        transport.onclose = () => {
          console.error(`[HTTP] Transport closed for session: ${newSessionId}`);
          this.cleanupSession(newSessionId);
        };

        // Notify Chrome that an MCP client connected
        this.nativeHost.sendMcpConnected();

        // Handle the request
        await transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
          req.body
        );
      } catch (error) {
        console.error(`[HTTP] Failed to create session:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Failed to initialize session' },
            id: null,
          });
        }
      }
      return;
    }

    // For requests with a session ID, find the existing session
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Session not found' },
          id: null,
        });
        return;
      }

      try {
        await session.transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
          req.body
        );
      } catch (error) {
        console.error(`[HTTP] Error handling request for session ${sessionId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          });
        }
      }
      return;
    }

    // GET without session ID - reject
    if (req.method === 'GET') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing session ID for GET request' },
        id: null,
      });
      return;
    }

    // Unknown request
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid request' },
      id: null,
    });
  }

  /**
   * Start the HTTP server
   */
  private startHttpServer(): Promise<void> {
    const host = this.options.host || '127.0.0.1';

    return new Promise((resolve, reject) => {
      this.httpServer = this.app.listen(this.actualPort, host, () => {
        console.error(`[HTTP] Server listening on http://${host}:${this.actualPort}/mcp`);
        resolve();
      });

      this.httpServer.on('error', (error) => {
        console.error('[HTTP] Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Register all browser automation tools with the MCP server
   */
  private registerTools(): void {
    for (const tool of allTools) {
      this.registerTool(tool.name, tool.description, tool.inputSchema);
    }
  }

  /**
   * Register a single tool with the MCP server
   */
  private registerTool(
    name: string,
    description: string,
    inputSchema: z.ZodType<unknown>
  ): void {
    const zodShape = this.extractZodShape(inputSchema);
    const toolName = name;

    this.mcpServer.tool(
      name,
      description,
      zodShape,
      async (args) => {
        return this.executeTool(toolName, args as Record<string, unknown>);
      }
    );
  }

  /**
   * Extract the shape from a Zod object schema for MCP SDK compatibility
   */
  private extractZodShape(schema: z.ZodType<unknown>): Record<string, z.ZodType<unknown>> {
    if (schema instanceof z.ZodObject) {
      return schema.shape as Record<string, z.ZodType<unknown>>;
    }
    return {};
  }

  /**
   * Execute a tool by sending request to Chrome and waiting for response
   */
  private async executeTool(
    tool: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const id = String(++this.requestId);

    // Transform args for specific tools
    const transformedArgs = this.transformArgs(tool, args);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingToolRequests.delete(id);
        resolve({
          content: [{ type: 'text', text: `Error: Tool execution timed out after ${TOOL_TIMEOUT_MS}ms` }],
        });
      }, TOOL_TIMEOUT_MS);

      this.pendingToolRequests.set(id, { resolve, reject, timeout });

      // Send tool request to Chrome via native host
      this.nativeHost.sendToolRequest(tool, transformedArgs);
    });
  }

  /**
   * Transform tool arguments to match Chrome extension expectations
   */
  private transformArgs(
    tool: string,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const transformed = { ...args };

    // For computer tool's "key" action, the extension expects the key in "text" param
    if (tool === 'computer' && args.action === 'key' && args.key && !args.text) {
      transformed.text = args.key;
      delete transformed.key;
    }

    return transformed;
  }

  /**
   * Format tool response from Chrome into MCP content format
   */
  private formatToolResponse(result: { content: unknown; tabContext?: TabContext }): ToolResult {
    const content: McpContent[] = [];

    // Handle content
    if (result.content) {
      if (typeof result.content === 'string') {
        content.push({ type: 'text', text: result.content });
      } else if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (typeof item === 'object' && item !== null) {
            const contentItem = item as { type?: string; text?: string; data?: string; mimeType?: string };
            if (contentItem.type === 'text' && contentItem.text) {
              content.push({ type: 'text', text: contentItem.text });
            } else if (contentItem.type === 'image' && contentItem.data) {
              content.push({
                type: 'image',
                data: contentItem.data,
                mimeType: contentItem.mimeType || 'image/png',
              });
            }
          }
        }
      }
    }

    // Add tab context if available
    if (result.tabContext) {
      const ctx = result.tabContext;
      const tabList = ctx.availableTabs
        .map((t) => `  • tabId ${t.tabId}: "${t.title}" (${t.url})`)
        .join('\n');
      
      const contextText = [
        '',
        '',
        'Tab Context:',
        `- Executed on tabId: ${ctx.executedOnTabId ?? ctx.currentTabId}`,
        '- Available tabs:',
        tabList,
      ].join('\n');
      
      content.push({ type: 'text', text: contextText });
    }

    // Ensure we have at least one content item
    if (content.length === 0) {
      content.push({ type: 'text', text: 'Tool executed successfully.' });
    }

    return { content };
  }

  /**
   * Cleanup a specific session
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.error(`[HTTP] Cleaning up session: ${sessionId}`);
      session.transport.close().catch(() => {});
      this.sessions.delete(sessionId);

      // Notify Chrome if no more sessions
      if (this.sessions.size === 0) {
        this.nativeHost.sendMcpDisconnected();
      }
    }
  }

  /**
   * Cleanup all sessions
   */
  private cleanupAllSessions(): void {
    for (const sessionId of this.sessions.keys()) {
      this.cleanupSession(sessionId);
    }
  }
}
