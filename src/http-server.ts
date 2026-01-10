/**
 * HTTP Server for Claude Chrome MCP
 * 
 * Implements the MCP Streamable HTTP transport for network-accessible
 * browser automation.
 */

import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ChromeMcpServer } from './server.js';
import { NativeHostClient } from './native-client.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IncomingMessage, ServerResponse } from 'node:http';

export interface HttpServerOptions {
  port: number;
  host?: string;
  socketPath?: string;
  spawnNativeHost?: boolean;
}

interface Session {
  id: string;
  transport: StreamableHTTPServerTransport;
  server: ChromeMcpServer;
  createdAt: Date;
}

const sessions = new Map<string, Session>();

// Flag to track if native host has been spawned
let nativeHostSpawned = false;

/**
 * Ensure native host is spawned (only once)
 */
async function ensureNativeHostSpawned(options: HttpServerOptions): Promise<void> {
  if (nativeHostSpawned || !options.spawnNativeHost) {
    return;
  }
  
  console.error('[HTTP] Spawning native host (once at startup)...');
  const tempClient = new NativeHostClient({ socketPath: options.socketPath });
  await tempClient.spawnNativeHost();
  // Don't connect - just spawn. Sessions will connect individually.
  nativeHostSpawned = true;
  console.error('[HTTP] Native host spawned successfully');
}

/**
 * Start the HTTP MCP server
 */
export async function startHttpServer(options: HttpServerOptions): Promise<void> {
  const app = express();
  const host = options.host || '127.0.0.1';
  const port = options.port;

  // Spawn native host once at startup if requested
  await ensureNativeHostSpawned(options);

  // Middleware - parse JSON but also keep raw body for MCP
  app.use(express.json());

  // Security: Validate Origin header to prevent DNS rebinding
  app.use((req: Request, res: Response, next: NextFunction) => {
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
  app.use((req: Request, res: Response, next: NextFunction) => {
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

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      activeSessions: sessions.size,
    });
  });

  // MCP endpoint - handles all MCP protocol messages
  // Supports both GET (for SSE streaming) and POST (for messages)
  app.all('/mcp', async (req: Request, res: Response) => {
    // Check for existing session
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    // For initialization requests (no session ID), create a new session
    if (!sessionId && req.method === 'POST') {
      const newSessionId = randomUUID();
      console.error(`[HTTP] New MCP session: ${newSessionId}`);
      
      try {
        // Create MCP server for this session (don't spawn native host - already done at startup)
        const server = new ChromeMcpServer({
          socketPath: options.socketPath,
          spawnNativeHost: false,  // Never spawn per-session, already spawned at startup
        });
        await server.connect();
        
        // Create transport with session ID generator
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });
        
        // Store session
        const session: Session = {
          id: newSessionId,
          transport,
          server,
          createdAt: new Date(),
        };
        sessions.set(newSessionId, session);
        
        // Connect MCP server to transport
        await server.getMcpServer().connect(transport);
        
        // Handle cleanup when transport closes
        transport.onclose = () => {
          console.error(`[HTTP] Transport closed for session: ${newSessionId}`);
          cleanupSession(newSessionId);
        };
        
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
            id: null
          });
        }
      }
      return;
    }
    
    // For requests with a session ID, find the existing session
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Session not found' },
          id: null
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
            id: null
          });
        }
      }
      return;
    }
    
    // GET without session ID (for SSE) - reject for now
    if (req.method === 'GET') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing session ID for GET request' },
        id: null
      });
      return;
    }
    
    // Unknown request
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid request' },
      id: null
    });
  });

  // List available tools (convenience endpoint)
  app.get('/tools', (req: Request, res: Response) => {
    import('./tools.js').then(({ allTools }) => {
      res.json({
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
        })),
      });
    });
  });

  // Start server
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.error(`[HTTP] MCP Server listening on http://${host}:${port}`);
      console.error(`[HTTP] MCP endpoint: http://${host}:${port}/mcp`);
      console.error(`[HTTP] Health check: http://${host}:${port}/health`);
      resolve();
    });

    server.on('error', (error) => {
      console.error('[HTTP] Server error:', error);
      reject(error);
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      console.error('[HTTP] Received SIGINT, shutting down...');
      cleanupAllSessions();
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.error('[HTTP] Received SIGTERM, shutting down...');
      cleanupAllSessions();
      server.close(() => {
        process.exit(0);
      });
    });
  });
}

/**
 * Cleanup a specific session
 */
function cleanupSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    console.error(`[HTTP] Cleaning up session: ${sessionId}`);
    session.server.disconnect();
    session.transport.close().catch(() => {});
    sessions.delete(sessionId);
  }
}

/**
 * Cleanup all sessions
 */
function cleanupAllSessions(): void {
  for (const sessionId of sessions.keys()) {
    cleanupSession(sessionId);
  }
}
