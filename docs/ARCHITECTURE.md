# Architecture

This document describes the technical architecture of `claude-chrome-mcp`.

## Overview

`claude-chrome-mcp` is a self-contained MCP server that acts as a native messaging host for the [Claude Browser Extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn).

```mermaid
graph LR
    A[MCP Client<br/>any] <-->|HTTP| B[claude-chrome-mcp<br/>Native Host + HTTP]
    B <-->|stdio| C[Chrome Extension<br/>Browser Tools]
```

## Key Components

### 1. Chrome Protocol (`src/chrome-protocol.ts`)
- Implements Chrome native messaging protocol
- Reads/writes length-prefixed JSON on stdin/stdout
- Launched automatically by Chrome when extension connects
- Event-driven architecture using Node.js EventEmitter

### 2. MCP Server (`src/mcp-server.ts`)
- Exposes MCP tools via HTTP endpoint `/mcp`
- Handles multiple concurrent client connections
- Routes requests to Chrome extension via chrome protocol
- Manages session lifecycle and tool execution

### 3. Tool Definitions (`src/tools.ts`)
- 14 browser automation tools with Zod schemas
- MCP-compliant tool registration
- Input validation and type safety
- Maps MCP tool names to Chrome extension tools

### 4. Installation (`src/install/`)
- Creates native messaging manifest
- Generates wrapper script
- Platform-aware (Linux, macOS, Windows)
- Runtime detection (Bun vs Node.js)

### 5. Constants (`src/constants.ts`)
- Shared constants across the codebase
- Version information
- Default configuration values
- Extension and manifest identifiers

## Wire Protocol

### Chrome Native Messaging

Messages consist of two parts:

| Component | Size | Format |
|-----------|------|--------|
| Length | 4 bytes | Little-endian unsigned integer |
| Payload | N bytes | UTF-8 encoded JSON |

**Message Flow**:
- Chrome sends: `ping`, `get_status`, `tool_response`, `mcp_connected`, `mcp_disconnected`
- We send: `pong`, `status_response`, `tool_request`

### HTTP/MCP

Standard HTTP POST requests to `/mcp` endpoint with JSON-RPC 2.0 format.

**Session Management**:
- Sessions identified by `Mcp-Session-Id` header
- Each session has its own StreamableHTTPServerTransport
- Sessions automatically cleaned up on disconnect

## Available Tools

| Category | Tools |
|----------|-------|
| **Navigation** | navigate |
| **Interaction** | computer, form_input, find |
| **Content** | read_page, get_page_text |
| **Tab Management** | tabs_context, tabs_create, resize_window |
| **Debugging** | read_console_messages, read_network_requests |
| **Media** | upload_image, gif_creator |
| **Code Execution** | javascript_tool |

## Installation Workflow

1. User runs: `claude-chrome-mcp --install`
2. Script creates:
   - Wrapper script at `~/.local/share/claude-chrome-mcp/wrapper.sh`
   - Native messaging manifest in browser's config directory
3. User restarts Chrome
4. Extension connects → Chrome launches wrapper → wrapper starts `claude-chrome-mcp`
5. Native host accepts extension connection on stdin/stdout
6. HTTP server starts on port 3456
7. MCP clients can connect

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Linux | ✅ Tested | Uses `~/.config/google-chrome/` or `chromium/` |
| macOS | ✅ Supported | Uses `~/Library/Application Support/` |
| Windows | ✅ Supported | Uses LocalAppData directory |

## Security

- HTTP server binds to `127.0.0.1` (localhost only)
- Native messaging manifest restricts to specific extension ID
- Wrapper script uses absolute paths
- No external network access required
- Optional Bearer token authentication
- Configurable CORS origins

## Message Flow Example

```
MCP Client → HTTP POST /mcp
    ↓
MCP Server (validates session, parses tool request)
    ↓
Chrome Protocol (sends tool_request via stdout)
    ↓
Chrome Extension (executes browser automation)
    ↓
Chrome Protocol (receives tool_response via stdin)
    ↓
MCP Server (formats response)
    ↓
MCP Client ← HTTP Response
```

## Error Handling

- **Timeout**: All tool operations have 60-second timeout
- **FIFO Queue**: Tool responses matched to requests in order
- **Session Cleanup**: Automatic cleanup on client disconnect
- **Port Conflicts**: Explicit error messages with resolution steps
