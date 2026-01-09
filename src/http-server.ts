/**
 * HTTP/SSE Server for Claude Chrome MCP
 * 
 * Implements the MCP Streamable HTTP transport for network-accessible
 * browser automation.
 */

import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ChromeMcpServer } from './server.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export interface HttpServerOptions {
  port: number;
  host?: string;
  socketPath?: string;
  spawnNativeHost?: boolean;
}

interface Session {
  id: string;
  transport: SSEServerTransport;
  server: ChromeMcpServer;
  response: Response;
  createdAt: Date;
}

const sessions = new Map<string, Session>();

/**
 * Start the HTTP/SSE MCP server
 */
export async function startHttpServer(options: HttpServerOptions): Promise<void> {
  const app = express();
  const host = options.host || '127.0.0.1';
  const port = options.port;

  // Middleware
  app.use(express.json());

  // Security: Validate Origin header to prevent DNS rebinding
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const url = new URL(origin);
      if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        console.error(`[HTTP] Rejected request from origin: ${origin}`);
        res.status(403).json({ error: 'Forbidden: Invalid origin' });
        return;
      }
    }
    next();
  });

  // CORS headers for local development
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:*');
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

  // SSE endpoint - establishes SSE connection and returns session ID
  app.get('/sse', async (req: Request, res: Response) => {
    const sessionId = randomUUID();

    console.error(`[HTTP] New SSE connection: ${sessionId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Mcp-Session-Id', sessionId);

    // Create server and transport for this session
    const server = new ChromeMcpServer({
      socketPath: options.socketPath,
      spawnNativeHost: options.spawnNativeHost,
    });

    try {
      // Connect to native host
      await server.connect();

      // Create SSE transport
      // The SSE transport needs the response object and message endpoint
      const transport = new SSEServerTransport(`/message?sessionId=${sessionId}`, res);

      // Store session
      const session: Session = {
        id: sessionId,
        transport,
        server,
        response: res,
        createdAt: new Date(),
      };
      sessions.set(sessionId, session);

      // Connect MCP server to transport
      await server.getMcpServer().connect(transport);

      // Handle client disconnect
      req.on('close', () => {
        console.error(`[HTTP] SSE connection closed: ${sessionId}`);
        cleanupSession(sessionId);
      });

      // Send keep-alive pings
      const pingInterval = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`event: ping\ndata: {"timestamp":${Date.now()}}\n\n`);
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

    } catch (error) {
      console.error(`[HTTP] Failed to establish SSE connection:`, error);
      sessions.delete(sessionId);
      server.disconnect();
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to connect to native host' });
      }
    }
  });

  // Message endpoint - receives MCP messages
  app.post('/message', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string || req.headers['mcp-session-id'] as string;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      // Forward message to transport
      await session.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error(`[HTTP] Error handling message:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Session termination endpoint
  app.delete('/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (sessions.has(sessionId)) {
      cleanupSession(sessionId);
      res.json({ status: 'terminated' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // List available tools (convenience endpoint)
  app.get('/tools', (req: Request, res: Response) => {
    // Import tools dynamically to avoid circular dependency issues
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
      console.error(`[HTTP] SSE endpoint: http://${host}:${port}/sse`);
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
    if (!session.response.writableEnded) {
      session.response.end();
    }
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
