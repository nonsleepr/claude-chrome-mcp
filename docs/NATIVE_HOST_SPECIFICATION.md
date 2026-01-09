# Native Host Specification

This document provides a complete reverse-engineered specification of the Claude Code native host process (`--chrome-native-host`), enabling implementation of compatible native hosts or alternative transport mechanisms.

## Table of Contents

1. [Overview](#overview)
2. [Process Architecture](#process-architecture)
3. [Stdio Handler Specification](#stdio-handler-specification)
4. [Socket Server Specification](#socket-server-specification)
5. [Message Routing Logic](#message-routing-logic)
6. [State Management](#state-management)
7. [Pseudocode Implementation](#pseudocode-implementation)
8. [Error Handling](#error-handling)

---

## Overview

The native host is a bridge process that:

1. **Communicates with Chrome Extension** via stdin/stdout using Chrome's native messaging protocol
2. **Accepts MCP client connections** via Unix socket (or Windows named pipe)
3. **Routes messages** bidirectionally between the extension and MCP clients

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Native Host Process                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Message Router                                    ││
│  │                                                                          ││
│  │   Chrome Extension ◄────────────────────────────────► MCP Clients       ││
│  │   (stdin/stdout)                                      (Unix socket)      ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌────────────────────────┐          ┌─────────────────────────────────────┐│
│  │   StdioHandler         │          │   SocketServer                      ││
│  │                        │          │                                     ││
│  │   - Read from stdin    │          │   - Listen on socket                ││
│  │   - Write to stdout    │          │   - Accept client connections       ││
│  │   - Parse messages     │          │   - Manage client sessions          ││
│  │   - Serialize messages │          │   - Broadcast to clients            ││
│  └────────────────────────┘          └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Process Architecture

### Entry Point

```
node cli.js --chrome-native-host
```

### Initialization Sequence

```
1. Create SocketServer instance
2. Create StdioHandler instance
3. Start SocketServer (begin listening)
4. Enter main message loop:
   a. Read message from stdin
   b. Process message (route to clients or handle locally)
   c. Repeat until stdin closes
5. Stop SocketServer
6. Exit process
```

### Process Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  Process Start                                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Initialize Socket Server                                        │
│  - Determine socket path based on platform                       │
│  - Clean up stale socket file if exists                          │
│  - Create server and bind to socket                              │
│  - Set socket permissions to 0600                                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main Loop (runs until stdin closes)                             │
│  - Read length-prefixed message from stdin                       │
│  - Parse JSON payload                                            │
│  - Route message based on type                                   │
│  - Send responses to stdout                                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cleanup                                                         │
│  - Close all MCP client connections                              │
│  - Close socket server                                           │
│  - Remove socket file                                            │
│  - Exit                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stdio Handler Specification

### Class: StdioHandler

Handles reading from stdin using Chrome's native messaging protocol.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `buffer` | Buffer | Accumulates incoming data |
| `pendingResolve` | Function \| null | Promise resolver for async reads |
| `closed` | boolean | Whether stdin has closed |

#### Wire Format

```
┌────────────────────────────────────────────────────────────────┐
│  4 bytes          │  N bytes                                   │
│  (Little-endian   │  (UTF-8 encoded JSON)                      │
│   uint32 length)  │                                            │
└────────────────────────────────────────────────────────────────┘
```

#### Reading Algorithm

```
function read():
    if closed:
        return null
    
    # Check if we have a complete message in buffer
    if buffer.length >= 4:
        length = buffer.readUInt32LE(0)
        if length > 0 AND length <= MAX_MESSAGE_SIZE:
            if buffer.length >= 4 + length:
                payload = buffer.slice(4, 4 + length)
                buffer = buffer.slice(4 + length)
                return payload.toString('utf-8')
    
    # Wait for more data
    return new Promise(resolve => {
        pendingResolve = resolve
        tryProcessMessage()
    })

function tryProcessMessage():
    if not pendingResolve:
        return
    
    if buffer.length < 4:
        return
    
    length = buffer.readUInt32LE(0)
    
    # Validate length
    if length == 0 OR length > MAX_MESSAGE_SIZE:
        pendingResolve(null)
        pendingResolve = null
        return
    
    if buffer.length < 4 + length:
        return
    
    payload = buffer.slice(4, 4 + length)
    buffer = buffer.slice(4 + length)
    
    pendingResolve(payload.toString('utf-8'))
    pendingResolve = null
```

#### Writing Algorithm

```
function write(message):
    payload = Buffer.from(message, 'utf-8')
    header = Buffer.alloc(4)
    header.writeUInt32LE(payload.length, 0)
    
    process.stdout.write(header)
    process.stdout.write(payload)
```

#### Constants

```javascript
const MAX_MESSAGE_SIZE = 1024 * 1024;  // 1 MB
```

---

## Socket Server Specification

### Class: SocketServer

Manages Unix socket (or Windows named pipe) for MCP client connections.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `mcpClients` | Map<number, ClientInfo> | Connected clients |
| `nextClientId` | number | Auto-incrementing client ID |
| `server` | net.Server \| null | Node.js server instance |
| `running` | boolean | Server running state |

#### ClientInfo Structure

```typescript
interface ClientInfo {
    id: number;           // Unique client identifier
    socket: net.Socket;   // TCP socket connection
    buffer: Buffer;       // Incoming data buffer
}
```

#### Socket Path Determination

```javascript
function getSocketPath() {
    const username = process.env.USER || process.env.USERNAME || 'unknown';
    
    switch (process.platform) {
        case 'win32':
            return `\\\\.\\pipe\\claude-code-mcp-${username}`;
        case 'darwin':
        case 'linux':
        default:
            return `/tmp/claude-code-mcp-${username}.sock`;
    }
}
```

#### Start Server Algorithm

```
function start():
    if running:
        return
    
    socketPath = getSocketPath()
    
    # Cleanup stale socket on Unix
    if platform != 'win32' AND fileExists(socketPath):
        if isSocket(socketPath):
            unlink(socketPath)
    
    server = createServer(handleClient)
    
    await server.listen(socketPath)
    
    # Set permissions on Unix
    if platform != 'win32':
        chmod(socketPath, 0o600)
    
    running = true
```

#### Handle Client Connection Algorithm

```
function handleClient(socket):
    clientId = nextClientId++
    client = {
        id: clientId,
        socket: socket,
        buffer: Buffer.alloc(0)
    }
    mcpClients.set(clientId, client)
    
    # Notify Chrome extension
    writeToStdout({type: "mcp_connected"})
    
    socket.on('data', (data) => {
        client.buffer = Buffer.concat([client.buffer, data])
        processClientBuffer(client)
    })
    
    socket.on('error', (err) => {
        log("Client error:", err)
    })
    
    socket.on('close', () => {
        mcpClients.delete(clientId)
        writeToStdout({type: "mcp_disconnected"})
    })
```

#### Process Client Buffer Algorithm

```
function processClientBuffer(client):
    while client.buffer.length >= 4:
        length = client.buffer.readUInt32LE(0)
        
        # Validate length
        if length == 0 OR length > MAX_MESSAGE_SIZE:
            client.socket.destroy()
            return
        
        if client.buffer.length < 4 + length:
            break
        
        payload = client.buffer.slice(4, 4 + length)
        client.buffer = client.buffer.slice(4 + length)
        
        try:
            message = JSON.parse(payload.toString('utf-8'))
            
            # Forward to Chrome extension
            writeToStdout({
                type: "tool_request",
                method: message.method,
                params: message.params
            })
        catch error:
            log("Failed to parse client message:", error)
```

#### Broadcast to Clients Algorithm

```
function broadcastToClients(message):
    payload = Buffer.from(JSON.stringify(message), 'utf-8')
    header = Buffer.alloc(4)
    header.writeUInt32LE(payload.length, 0)
    
    packet = Buffer.concat([header, payload])
    
    for [clientId, client] of mcpClients:
        try:
            client.socket.write(packet)
        catch error:
            log("Failed to send to client:", clientId, error)
```

---

## Message Routing Logic

### Incoming Messages (from Chrome Extension)

```
function handleChromeMessage(messageStr):
    message = JSON.parse(messageStr)
    
    switch message.type:
        case "ping":
            writeToStdout({
                type: "pong",
                timestamp: Date.now()
            })
        
        case "get_status":
            writeToStdout({
                type: "status_response",
                native_host_version: VERSION
            })
        
        case "tool_response":
            # Forward to MCP clients (strip 'type' field)
            {type, ...rest} = message
            broadcastToClients(rest)
        
        case "notification":
            # Forward to MCP clients (strip 'type' field)
            {type, ...rest} = message
            broadcastToClients(rest)
        
        default:
            writeToStdout({
                type: "error",
                error: "Unknown message type: " + message.type
            })
```

### Incoming Messages (from MCP Clients)

```
function handleMcpClientMessage(message):
    # Wrap and forward to Chrome extension
    writeToStdout({
        type: "tool_request",
        method: message.method,
        params: message.params
    })
```

---

## State Management

### Global State

```javascript
// Connection state
let chromeConnected = false;      // Always true when process is running
let mcpClientCount = 0;           // Number of connected MCP clients

// Client tracking
const mcpClients = new Map();     // clientId -> ClientInfo
let nextClientId = 1;             // Auto-incrementing ID
```

### State Transitions

```
┌────────────────────────────────────────────────────────────────┐
│                    State Diagram                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Process Start]                                                │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                           │
│  │  INITIALIZING   │                                           │
│  │  - Start socket │                                           │
│  │  - Setup stdio  │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐        MCP Client        ┌──────────────┐ │
│  │   RUNNING       │◄───── connects ─────────▶│ mcp_connected│ │
│  │   (no clients)  │                          │ sent         │ │
│  └────────┬────────┘                          └──────────────┘ │
│           │                                                     │
│           │ MCP Client disconnects                              │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                          ┌──────────────┐ │
│  │   RUNNING       │◄───── disconnects ──────▶│mcp_disconnect│ │
│  │   (no clients)  │                          │ sent         │ │
│  └────────┬────────┘                          └──────────────┘ │
│           │                                                     │
│           │ stdin closes                                        │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │  SHUTTING DOWN  │                                           │
│  │  - Close socket │                                           │
│  │  - Cleanup      │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  [Process Exit]                                                 │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Pseudocode Implementation

### Complete Native Host Implementation

```javascript
const net = require('net');
const fs = require('fs');
const path = require('path');

const VERSION = "1.0.0";
const MAX_MESSAGE_SIZE = 1024 * 1024;

// ============================================================================
// Stdio Handler
// ============================================================================

class StdioHandler {
    constructor() {
        this.buffer = Buffer.alloc(0);
        this.pendingResolve = null;
        this.closed = false;
        
        process.stdin.on('data', (data) => {
            this.buffer = Buffer.concat([this.buffer, data]);
            this.tryProcessMessage();
        });
        
        process.stdin.on('end', () => {
            this.closed = true;
            if (this.pendingResolve) {
                this.pendingResolve(null);
                this.pendingResolve = null;
            }
        });
    }
    
    tryProcessMessage() {
        if (!this.pendingResolve) return;
        if (this.buffer.length < 4) return;
        
        const length = this.buffer.readUInt32LE(0);
        
        if (length === 0 || length > MAX_MESSAGE_SIZE) {
            this.pendingResolve(null);
            this.pendingResolve = null;
            return;
        }
        
        if (this.buffer.length < 4 + length) return;
        
        const payload = this.buffer.subarray(4, 4 + length);
        this.buffer = this.buffer.subarray(4 + length);
        
        this.pendingResolve(payload.toString('utf-8'));
        this.pendingResolve = null;
    }
    
    async read() {
        if (this.closed) return null;
        
        // Check for complete message already in buffer
        if (this.buffer.length >= 4) {
            const length = this.buffer.readUInt32LE(0);
            if (length > 0 && length <= MAX_MESSAGE_SIZE && 
                this.buffer.length >= 4 + length) {
                const payload = this.buffer.subarray(4, 4 + length);
                this.buffer = this.buffer.subarray(4 + length);
                return payload.toString('utf-8');
            }
        }
        
        return new Promise((resolve) => {
            this.pendingResolve = resolve;
            this.tryProcessMessage();
        });
    }
}

function writeToStdout(message) {
    const payload = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    process.stdout.write(header);
    process.stdout.write(payload);
}

// ============================================================================
// Socket Server
// ============================================================================

class SocketServer {
    constructor() {
        this.mcpClients = new Map();
        this.nextClientId = 1;
        this.server = null;
        this.running = false;
    }
    
    getSocketPath() {
        const username = process.env.USER || process.env.USERNAME || 'unknown';
        if (process.platform === 'win32') {
            return `\\\\.\\pipe\\claude-code-mcp-${username}`;
        }
        return `/tmp/claude-code-mcp-${username}.sock`;
    }
    
    async start() {
        if (this.running) return;
        
        const socketPath = this.getSocketPath();
        
        // Cleanup stale socket on Unix
        if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
            try {
                if (fs.statSync(socketPath).isSocket()) {
                    fs.unlinkSync(socketPath);
                }
            } catch (e) {}
        }
        
        this.server = net.createServer((socket) => this.handleClient(socket));
        
        await new Promise((resolve, reject) => {
            this.server.listen(socketPath, () => {
                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(socketPath, 0o600);
                    } catch (e) {}
                }
                this.running = true;
                resolve();
            });
            this.server.on('error', reject);
        });
    }
    
    async stop() {
        if (!this.running) return;
        
        for (const [, client] of this.mcpClients) {
            client.socket.destroy();
        }
        this.mcpClients.clear();
        
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => resolve());
            });
            this.server = null;
        }
        
        const socketPath = this.getSocketPath();
        if (process.platform !== 'win32' && fs.existsSync(socketPath)) {
            try {
                fs.unlinkSync(socketPath);
            } catch (e) {}
        }
        
        this.running = false;
    }
    
    handleClient(socket) {
        const clientId = this.nextClientId++;
        const client = {
            id: clientId,
            socket: socket,
            buffer: Buffer.alloc(0)
        };
        this.mcpClients.set(clientId, client);
        
        // Notify Chrome extension
        writeToStdout({ type: "mcp_connected" });
        
        socket.on('data', (data) => {
            client.buffer = Buffer.concat([client.buffer, data]);
            this.processClientBuffer(client);
        });
        
        socket.on('error', (err) => {
            console.error(`Client ${clientId} error:`, err);
        });
        
        socket.on('close', () => {
            this.mcpClients.delete(clientId);
            writeToStdout({ type: "mcp_disconnected" });
        });
    }
    
    processClientBuffer(client) {
        while (client.buffer.length >= 4) {
            const length = client.buffer.readUInt32LE(0);
            
            if (length === 0 || length > MAX_MESSAGE_SIZE) {
                client.socket.destroy();
                return;
            }
            
            if (client.buffer.length < 4 + length) break;
            
            const payload = client.buffer.subarray(4, 4 + length);
            client.buffer = client.buffer.subarray(4 + length);
            
            try {
                const message = JSON.parse(payload.toString('utf-8'));
                
                // Forward to Chrome extension
                writeToStdout({
                    type: "tool_request",
                    method: message.method,
                    params: message.params
                });
            } catch (e) {
                console.error("Failed to parse client message:", e);
            }
        }
    }
    
    broadcastToClients(message) {
        const payload = Buffer.from(JSON.stringify(message), 'utf-8');
        const header = Buffer.alloc(4);
        header.writeUInt32LE(payload.length, 0);
        const packet = Buffer.concat([header, payload]);
        
        for (const [clientId, client] of this.mcpClients) {
            try {
                client.socket.write(packet);
            } catch (e) {
                console.error(`Failed to send to client ${clientId}:`, e);
            }
        }
    }
}

// ============================================================================
// Message Router
// ============================================================================

async function handleMessage(socketServer, messageStr) {
    const message = JSON.parse(messageStr);
    
    switch (message.type) {
        case "ping":
            writeToStdout({
                type: "pong",
                timestamp: Date.now()
            });
            break;
        
        case "get_status":
            writeToStdout({
                type: "status_response",
                native_host_version: VERSION
            });
            break;
        
        case "tool_response": {
            const { type, ...rest } = message;
            socketServer.broadcastToClients(rest);
            break;
        }
        
        case "notification": {
            const { type, ...rest } = message;
            socketServer.broadcastToClients(rest);
            break;
        }
        
        default:
            writeToStdout({
                type: "error",
                error: `Unknown message type: ${message.type}`
            });
    }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const socketServer = new SocketServer();
    const stdioHandler = new StdioHandler();
    
    await socketServer.start();
    
    while (true) {
        const message = await stdioHandler.read();
        if (message === null) break;
        
        await handleMessage(socketServer, message);
    }
    
    await socketServer.stop();
}

main().catch(console.error);
```

---

## Error Handling

### Fatal Errors

| Error | Cause | Behavior |
|-------|-------|----------|
| Socket bind failure | Path in use | Exit with error |
| Stdin closed | Chrome killed native host | Graceful shutdown |
| Invalid message length | Protocol violation | Close connection |

### Recoverable Errors

| Error | Cause | Behavior |
|-------|-------|----------|
| JSON parse failure | Malformed message | Log and continue |
| Client disconnect | Network issue | Remove from map |
| Write failure | Client buffer full | Log and continue |

### Logging

The native host logs to stderr (which Chrome captures):

```javascript
function log(...args) {
    const timestamp = new Date().toISOString();
    console.error(`[Claude Chrome Native Host] ${timestamp}`, ...args);
}
```

---

## Testing

### Manual Testing with netcat

```bash
# Connect to socket
nc -U /tmp/claude-code-mcp-$USER.sock

# Send a tool request (need to send length prefix manually)
# Use a helper script or test client
```

### Test Client Implementation

```javascript
const net = require('net');

function sendMessage(socket, message) {
    const payload = Buffer.from(JSON.stringify(message), 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);
    socket.write(header);
    socket.write(payload);
}

const socket = net.connect('/tmp/claude-code-mcp-' + process.env.USER + '.sock');

socket.on('connect', () => {
    console.log('Connected');
    
    // Send a tool request
    sendMessage(socket, {
        method: 'execute_tool',
        params: {
            tool: 'navigate',
            args: { url: 'https://example.com' }
        }
    });
});

socket.on('data', (data) => {
    // Parse length-prefixed messages
    let offset = 0;
    while (offset < data.length) {
        const length = data.readUInt32LE(offset);
        const payload = data.subarray(offset + 4, offset + 4 + length);
        console.log('Received:', JSON.parse(payload.toString()));
        offset += 4 + length;
    }
});
```
