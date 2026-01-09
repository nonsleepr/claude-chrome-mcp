# Chrome Extension MCP Integration Documentation

This documentation provides comprehensive technical specifications for integrating with the Claude Browser Extension's browser automation capabilities.

## Documents

### 1. [Native Messaging Architecture](./NATIVE_MESSAGING_ARCHITECTURE.md)

A complete overview of how the Chrome Extension communicates with external processes using Chrome's Native Messaging API.

**Key Topics:**
- Architecture components and data flow
- Native host installation process
- Wire protocol (length-prefixed JSON)
- Message types and formats
- Tool execution flow
- Connection lifecycle
- Available tools (23 browser automation tools)

### 2. [Native Host Specification](./NATIVE_HOST_SPECIFICATION.md)

Reverse-engineered specification of the Claude Code native host process (`--chrome-native-host`), enabling implementation of compatible native hosts.

**Key Topics:**
- Process architecture and lifecycle
- Stdio handler specification (Chrome native messaging)
- Socket server specification (MCP client connections)
- Message routing logic
- Complete pseudocode implementation
- Error handling patterns

### 3. [HTTP/SSE MCP Server Specification](./HTTP_SSE_MCP_SERVER_SPEC.md)

Specification for an HTTP/SSE-based MCP server that exposes the extension's tools without requiring the native messaging bridge.

**Key Topics:**
- Design goals and architecture
- HTTP API endpoints (`/sse`, `/message`, `/health`)
- SSE event specification
- MCP protocol mapping
- Extension modifications required
- Security considerations
- Implementation phases

---

## Quick Reference

### Connection Methods

| Method | Transport | Use Case |
|--------|-----------|----------|
| Native Messaging | stdio + Unix socket | Claude Code, Claude Desktop |
| HTTP/SSE | HTTP + Server-Sent Events | Any MCP client, web applications |

### Message Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Connection Options                                │
│                                                                          │
│  Option 1: Native Messaging (Current)                                   │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │MCP Client│───▶│ Native Host  │───▶│  Extension   │                  │
│  └──────────┘    │(Unix socket) │    │(stdin/stdout)│                  │
│                  └──────────────┘    └──────────────┘                  │
│                                                                          │
│  Option 2: HTTP/SSE (Proposed)                                          │
│  ┌──────────┐              ┌──────────────┐                             │
│  │MCP Client│─────────────▶│  Extension   │                             │
│  └──────────┘   HTTP/SSE   │  MCP Server  │                             │
│                            └──────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Wire Protocol

All native messaging uses length-prefixed JSON:

```
┌────────────────┬────────────────────────────────────┐
│  Length (4B)   │  JSON Payload                      │
│  Little-endian │  UTF-8 encoded                     │
│  uint32        │                                    │
└────────────────┴────────────────────────────────────┘
```

### Tool Request Format

```json
{
  "type": "tool_request",
  "method": "execute_tool",
  "params": {
    "tool": "navigate",
    "args": {
      "url": "https://example.com"
    }
  }
}
```

### Tool Response Format

```json
{
  "type": "tool_response",
  "result": {
    "content": "Navigation successful"
  }
}
```

---

## Getting Started

### For MCP Client Developers

1. Read [Native Host Specification](./NATIVE_HOST_SPECIFICATION.md) for socket connection details
2. Connect to `/tmp/claude-code-mcp-{username}.sock` (Unix) or `\\.\pipe\claude-code-mcp-{username}` (Windows)
3. Use length-prefixed JSON protocol
4. Send tool requests, receive tool responses

### For HTTP/SSE Implementation

1. Read [HTTP/SSE MCP Server Specification](./HTTP_SSE_MCP_SERVER_SPEC.md)
2. Choose implementation approach (external bridge or extension-integrated)
3. Follow MCP transport specification for SSE
4. Configure MCP clients to connect via `http://localhost:3456/sse`

### For Extension Modification

1. Understand current architecture via [Native Messaging Architecture](./NATIVE_MESSAGING_ARCHITECTURE.md)
2. Review tool execution in `assets/service-worker.ts-Bo1zOX7Y.js`
3. Review tool definitions in `assets/mcpPermissions-njmGsNbg.js`
4. Implement MCP protocol handler as described in HTTP/SSE spec

---

## Available Tools

The extension exposes 23 browser automation tools:

| Category | Tools |
|----------|-------|
| **Navigation** | `navigate` |
| **Interaction** | `computer`, `form_input`, `find` |
| **Content** | `read_page`, `get_page_text` |
| **Tab Management** | `tabs_context`, `tabs_create`, `tabs_context_mcp`, `tabs_create_mcp`, `resize_window` |
| **Debugging** | `read_console_messages`, `read_network_requests` |
| **Media** | `upload_image`, `gif_creator` |
| **Workflow** | `update_plan`, `shortcuts_list`, `shortcuts_execute` |
| **Code Execution** | `javascript_tool` |
| **Utility** | `turn_answer_start`, `turn_answer_complete`, `dev_utils`, `permissions_check` |

---

## Security Notes

1. **Localhost Only**: All servers bind to `127.0.0.1`
2. **Permission System**: Domain-based tool permission checking
3. **Socket Permissions**: Unix sockets created with `0600` permissions
4. **Restricted URLs**: Blocks `chrome://`, `chrome-extension://`, `devtools://`

---

## Contributing

When extending this documentation:

1. Keep specifications precise and implementation-agnostic where possible
2. Include code examples in pseudocode or JavaScript
3. Document all message types and their fields
4. Include sequence diagrams for complex flows
