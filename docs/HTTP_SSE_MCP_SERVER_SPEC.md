# HTTP/SSE MCP Server Specification

This document specifies an HTTP/SSE-based MCP server that exposes the Chrome Extension's browser automation tools, enabling MCP clients to connect without requiring the native messaging bridge.

## Table of Contents

1. [Overview](#overview)
2. [Design Goals](#design-goals)
3. [Architecture](#architecture)
4. [Connection Flow](#connection-flow)
5. [HTTP API Specification](#http-api-specification)
6. [SSE Event Specification](#sse-event-specification)
7. [MCP Protocol Mapping](#mcp-protocol-mapping)
8. [Extension Modifications](#extension-modifications)
9. [Security Considerations](#security-considerations)
10. [Implementation Guide](#implementation-guide)

---

## Overview

This specification defines an HTTP/SSE transport layer for the MCP protocol, allowing the Chrome Extension to function as an MCP server that any MCP-compatible client can connect to.

### Current Architecture (Native Messaging)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  MCP Client  │────▶│ Native Host  │────▶│  Extension   │
│              │     │ (stdio/sock) │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
      Unix Socket        stdin/stdout
```

### Proposed Architecture (HTTP/SSE)

```
┌──────────────┐              ┌──────────────┐
│  MCP Client  │─────────────▶│  Extension   │
│              │   HTTP/SSE   │  MCP Server  │
└──────────────┘              └──────────────┘
     Direct HTTP connection
```

---

## Design Goals

1. **Standard MCP Compliance**: Follow the [MCP HTTP/SSE Transport Specification](https://spec.modelcontextprotocol.io/specification/basic/transports/#http-with-sse)
2. **No External Dependencies**: Server runs entirely within the extension
3. **Backward Compatibility**: Existing native messaging can coexist
4. **Security**: Localhost-only binding, optional authentication
5. **Simplicity**: Minimal changes to existing extension code

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Chrome Extension                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Service Worker                                    ││
│  │                                                                          ││
│  │  ┌────────────────────┐     ┌────────────────────────────────────────┐  ││
│  │  │  HTTP/SSE Server   │     │  Tool Executor                         │  ││
│  │  │                    │     │                                        │  ││
│  │  │  - POST /message   │────▶│  - navigate                            │  ││
│  │  │  - GET /sse        │     │  - computer                            │  ││
│  │  │  - GET /health     │     │  - read_page                           │  ││
│  │  │                    │◀────│  - ... (23 tools)                      │  ││
│  │  └────────────────────┘     └────────────────────────────────────────┘  ││
│  │                                                                          ││
│  │  ┌────────────────────┐     ┌────────────────────────────────────────┐  ││
│  │  │  Session Manager   │     │  Native Messaging Handler              │  ││
│  │  │                    │     │  (existing, unchanged)                 │  ││
│  │  │  - Client sessions │     │                                        │  ││
│  │  │  - Tab groups      │     │                                        │  ││
│  │  └────────────────────┘     └────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Responsibility |
|-----------|----------------|
| HTTP/SSE Server | Accept HTTP requests, manage SSE connections |
| Session Manager | Track client sessions, map to tab groups |
| Tool Executor | Execute browser tools (existing) |
| MCP Protocol Handler | Translate MCP messages to tool calls |

---

## Connection Flow

### MCP Client Connection Sequence

```
┌──────────────┐                              ┌──────────────┐
│  MCP Client  │                              │  Extension   │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │  1. GET /sse                                │
       │────────────────────────────────────────────▶│
       │                                             │
       │  2. SSE connection established              │
       │◀────────────────────────────────────────────│
       │     event: endpoint                         │
       │     data: /message?sessionId=xxx            │
       │                                             │
       │  3. POST /message?sessionId=xxx             │
       │     {method: "initialize", ...}             │
       │────────────────────────────────────────────▶│
       │                                             │
       │  4. SSE event with response                 │
       │◀────────────────────────────────────────────│
       │     event: message                          │
       │     data: {result: {serverInfo: ...}}       │
       │                                             │
       │  5. POST /message?sessionId=xxx             │
       │     {method: "tools/call", ...}             │
       │────────────────────────────────────────────▶│
       │                                             │
       │  6. SSE event with tool result              │
       │◀────────────────────────────────────────────│
       │     event: message                          │
       │     data: {result: {content: [...]}}        │
       │                                             │
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  Client connects to /sse                                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server generates sessionId                                      │
│  Server creates tab group for session (optional)                 │
│  Server sends endpoint event with sessionId                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Client sends initialize request                                 │
│  Server responds with capabilities                               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Normal operation: tool calls via POST /message                  │
│  Responses/notifications via SSE                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Client disconnects (SSE closes) or sends shutdown               │
│  Server cleans up session, optionally closes tab group          │
└─────────────────────────────────────────────────────────────────┘
```

---

## HTTP API Specification

### Base URL

```
http://localhost:3456/
```

The port is configurable. Default: `3456`

### Endpoints

#### GET /sse

Establishes an SSE connection for receiving server responses.

**Request Headers**:
```
Accept: text/event-stream
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Session-Id: session_abc123

event: endpoint
data: /message?sessionId=session_abc123

```

**SSE Events**: See [SSE Event Specification](#sse-event-specification)

---

#### POST /message

Sends an MCP message to the server.

**Query Parameters**:
| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionId` | Yes | Session ID from SSE endpoint event |

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**: MCP JSON-RPC message

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

**Response**:
```
HTTP/1.1 202 Accepted
Content-Type: application/json

{"status": "accepted"}
```

The actual result is sent via SSE.

---

#### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "activeSessions": 2
}
```

---

#### GET /tools

Returns available tools (convenience endpoint, not part of MCP spec).

**Response**:
```json
{
  "tools": [
    {
      "name": "navigate",
      "description": "Navigate to a URL",
      "inputSchema": {...}
    },
    ...
  ]
}
```

---

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request (malformed JSON, missing parameters) |
| 401 | Unauthorized (if auth enabled) |
| 404 | Session not found |
| 500 | Internal server error |

```json
{
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  }
}
```

---

## SSE Event Specification

### Event Types

#### endpoint

Sent immediately after SSE connection, provides the message endpoint URL.

```
event: endpoint
data: /message?sessionId=session_abc123
```

#### message

MCP JSON-RPC response or notification.

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Navigation successful"}]}}
```

#### ping

Keep-alive signal (sent every 30 seconds).

```
event: ping
data: {"timestamp":1704067200000}
```

#### error

Server-side error notification.

```
event: error
data: {"code":-32603,"message":"Internal error"}
```

### Message Format

All SSE data payloads are JSON-encoded strings on a single line.

---

## MCP Protocol Mapping

### Server Information

```json
{
  "name": "claude-browser-extension",
  "version": "1.0.36",
  "protocolVersion": "2024-11-05"
}
```

### Capabilities

```json
{
  "capabilities": {
    "tools": {}
  }
}
```

### Tool Definitions

The extension exposes 23 tools. Each tool maps to an MCP tool definition:

```json
{
  "name": "navigate",
  "description": "Navigates to a URL in the browser",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL to navigate to"
      }
    },
    "required": ["url"]
  }
}
```

### MCP Method Mapping

| MCP Method | Extension Handler |
|------------|-------------------|
| `initialize` | Return server info and capabilities |
| `tools/list` | Return tool definitions |
| `tools/call` | Execute tool via `h()` function |
| `ping` | Return `pong` |

### Tool Call Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": {
      "url": "https://example.com"
    }
  }
}
```

### Tool Call Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Navigated to https://example.com"
      }
    ],
    "isError": false
  }
}
```

---

## Extension Modifications

### Required Changes

#### 1. HTTP Server in Service Worker

Service workers can create HTTP servers using the `fetch` event listener pattern with a self-hosted approach, or by using an offscreen document.

**Option A: Offscreen Document HTTP Server**

Since service workers cannot bind to ports directly, use an offscreen document:

```javascript
// offscreen.js
const http = require('http'); // Not available in browser

// Alternative: Use a companion native host just for HTTP
```

**Option B: WebSocket from External Process**

A lightweight external process provides HTTP interface and communicates with extension via WebSocket:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  MCP Client  │────▶│  HTTP Server │────▶│  Extension   │
│              │HTTP │  (external)  │ WS  │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Option C: Chrome Extension with `externally_connectable`**

Use `chrome.runtime.sendMessage` from a web page:

```json
// manifest.json
{
  "externally_connectable": {
    "matches": ["http://localhost:3456/*"]
  }
}
```

#### 2. MCP Protocol Handler

New module to handle MCP protocol:

```javascript
// mcpHandler.js

class MCPHandler {
  constructor(toolExecutor) {
    this.toolExecutor = toolExecutor;
    this.sessions = new Map();
  }

  async handleMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    switch (message.method) {
      case 'initialize':
        return this.handleInitialize(session, message);
      case 'tools/list':
        return this.handleToolsList(message);
      case 'tools/call':
        return this.handleToolsCall(session, message);
      case 'ping':
        return { jsonrpc: '2.0', id: message.id, result: {} };
      default:
        throw new Error(`Unknown method: ${message.method}`);
    }
  }

  handleInitialize(session, message) {
    session.initialized = true;
    session.clientInfo = message.params?.clientInfo;
    
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'claude-browser-extension',
          version: chrome.runtime.getManifest().version
        },
        capabilities: {
          tools: {}
        }
      }
    };
  }

  async handleToolsList(message) {
    const tools = this.toolExecutor.getToolSchemas();
    
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: { tools }
    };
  }

  async handleToolsCall(session, message) {
    const { name, arguments: args } = message.params;
    
    try {
      const result = await this.toolExecutor.execute({
        toolName: name,
        args: args || {},
        tabGroupId: session.tabGroupId,
        clientId: session.id
      });
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: this.formatContent(result),
          isError: !!result.error
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{ type: 'text', text: error.message }],
          isError: true
        }
      };
    }
  }

  formatContent(result) {
    if (typeof result.content === 'string') {
      return [{ type: 'text', text: result.content }];
    }
    if (Array.isArray(result.content)) {
      return result.content;
    }
    return [{ type: 'text', text: JSON.stringify(result) }];
  }
}
```

#### 3. Session Manager

```javascript
// sessionManager.js

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sseConnections = new Map();
  }

  createSession() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      initialized: false,
      tabGroupId: null,
      clientInfo: null
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this.sseConnections.delete(sessionId);
  }

  registerSSE(sessionId, connection) {
    this.sseConnections.set(sessionId, connection);
  }

  sendToSession(sessionId, message) {
    const connection = this.sseConnections.get(sessionId);
    if (connection) {
      connection.send('message', JSON.stringify(message));
    }
  }
}
```

---

## Security Considerations

### 1. Localhost Binding Only

```javascript
server.listen(3456, '127.0.0.1');  // Only accept local connections
```

### 2. Optional Authentication

Token-based authentication for additional security:

```javascript
// Header: Authorization: Bearer <token>

const AUTH_TOKEN = process.env.CLAUDE_BROWSER_AUTH_TOKEN;

function authenticate(req) {
  if (!AUTH_TOKEN) return true;  // Auth disabled
  
  const header = req.headers.authorization;
  if (!header) return false;
  
  const [type, token] = header.split(' ');
  return type === 'Bearer' && token === AUTH_TOKEN;
}
```

### 3. CORS Configuration

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

### 4. Rate Limiting

```javascript
const rateLimiter = new Map();
const RATE_LIMIT = 100;  // requests per minute
const RATE_WINDOW = 60000;  // 1 minute

function checkRateLimit(clientId) {
  const now = Date.now();
  const client = rateLimiter.get(clientId) || { count: 0, windowStart: now };
  
  if (now - client.windowStart > RATE_WINDOW) {
    client.count = 0;
    client.windowStart = now;
  }
  
  client.count++;
  rateLimiter.set(clientId, client);
  
  return client.count <= RATE_LIMIT;
}
```

---

## Implementation Guide

### Phase 1: HTTP Bridge (External Process)

The simplest implementation uses a lightweight external process:

```javascript
// mcp-http-bridge.js
const http = require('http');
const net = require('net');

const PORT = 3456;
const SOCKET_PATH = `/tmp/claude-code-mcp-${process.env.USER}.sock`;

// SSE connections
const sseClients = new Map();

// Connect to existing native host socket
const nativeSocket = net.connect(SOCKET_PATH);

const server = http.createServer((req, res) => {
  if (req.url === '/sse' && req.method === 'GET') {
    handleSSE(req, res);
  } else if (req.url.startsWith('/message') && req.method === 'POST') {
    handleMessage(req, res);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

function handleSSE(req, res) {
  const sessionId = `session_${Date.now()}`;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Session-Id': sessionId
  });
  
  sseClients.set(sessionId, res);
  
  res.write(`event: endpoint\ndata: /message?sessionId=${sessionId}\n\n`);
  
  req.on('close', () => {
    sseClients.delete(sessionId);
  });
}

function handleMessage(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const message = JSON.parse(body);
    
    // Forward to native socket
    sendToNative({
      method: 'execute_tool',
      params: {
        tool: message.params.name,
        args: message.params.arguments
      }
    });
    
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'accepted' }));
  });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MCP HTTP Bridge listening on port ${PORT}`);
});
```

### Phase 2: Extension-Native Integration

Modify the extension to communicate directly with the HTTP bridge:

1. Add WebSocket client to service worker
2. Forward tool requests to existing tool executor
3. Return results via WebSocket

### Phase 3: Full MCP Server in Extension

For maximum independence, implement the HTTP server as part of the extension using:

1. Chrome Sockets API (if available)
2. Companion native messaging host (minimal)
3. Offscreen document with WebSocket

---

## Configuration

### Extension Options

```json
{
  "mcpServer": {
    "enabled": true,
    "port": 3456,
    "host": "127.0.0.1",
    "authToken": null,
    "corsOrigins": ["http://localhost:*"]
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_BROWSER_MCP_PORT` | HTTP server port | `3456` |
| `CLAUDE_BROWSER_AUTH_TOKEN` | Authentication token | (none) |

---

## Client Configuration

### Example MCP Client Configuration

```json
{
  "mcpServers": {
    "claude-browser": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3456/sse"
      }
    }
  }
}
```

### Claude Code Configuration

```json
{
  "claude-browser": {
    "type": "sse",
    "url": "http://localhost:3456/sse",
    "scope": "dynamic"
  }
}
```

---

## Appendix: Complete Tool List

| Tool Name | Description |
|-----------|-------------|
| `navigate` | Navigate to a URL |
| `computer` | Mouse/keyboard interaction |
| `read_page` | Parse page DOM |
| `find` | Search page elements |
| `form_input` | Form field interaction |
| `get_page_text` | Extract all visible text |
| `tabs_context` | Get current tab information |
| `tabs_create` | Create new tab |
| `tabs_context_mcp` | Get MCP tab context |
| `tabs_create_mcp` | Create tab in MCP group |
| `resize_window` | Control window dimensions |
| `read_console_messages` | Browser console debugging |
| `read_network_requests` | HTTP network monitoring |
| `upload_image` | Image upload to pages |
| `gif_creator` | GIF recording and export |
| `update_plan` | Workflow planning |
| `shortcuts_list` | List saved shortcuts |
| `shortcuts_execute` | Run saved shortcuts |
| `javascript_tool` | Execute JavaScript |
| `turn_answer_start` | Mark response start |
| `turn_answer_complete` | Mark response end |
| `dev_utils` | Development testing |
| `permissions_check` | Permission verification |
