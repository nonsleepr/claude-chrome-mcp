# Developer Documentation

This directory contains technical documentation for developers working with or extending `claude-chrome-mcp`.

## Documentation Files

### [Advanced Setup](./ADVANCED_SETUP.md)

Manual installation and troubleshooting guide for advanced users who need to customize their setup or debug native messaging issues.

**When to use:**
- Custom Chrome extension IDs
- Platform-specific bash paths (e.g., NixOS)
- Troubleshooting native messaging errors
- Understanding the wrapper script mechanism

### [Native Messaging Architecture](./NATIVE_MESSAGING_ARCHITECTURE.md)

Technical overview of how the Chrome Extension communicates via Chrome's Native Messaging API.

**Topics covered:**
- Wire protocol (length-prefixed JSON)
- Message types and formats
- Tool execution flow
- Complete list of available tools

### [Native Host Specification](./NATIVE_HOST_SPECIFICATION.md)

Internal protocol specification for the native host process.

**Topics covered:**
- Process lifecycle and architecture
- Stdio handler (Chrome native messaging)
- Socket server (MCP client connections)
- Message routing logic

### [HTTP/SSE MCP Server Specification](./HTTP_SSE_MCP_SERVER_SPEC.md)

Design specification for an alternative HTTP/SSE-based MCP transport implementation (not currently used).

> **Note**: The current implementation uses HTTP transport. This document describes a proposed SSE-based design.

**Topics covered:**
- HTTP API endpoints
- SSE event specification (proposed)
- MCP protocol mapping
- Implementation details

## Quick Reference

### Architecture

```
MCP Client → HTTP → Native Host → Chrome Extension → Browser
            (port 3456)   (stdio)         (CDP)
```

### Wire Protocol

Native messaging uses **length-prefixed JSON**:

```
[4 bytes length (little-endian)] [N bytes JSON (UTF-8)]
```

### Tool Categories

- **Navigation**: navigate
- **Interaction**: computer, form_input, find
- **Content**: read_page, get_page_text
- **Tab Management**: tabs_context_mcp, tabs_create_mcp, resize_window
- **Debugging**: read_console_messages, read_network_requests
- **Media**: upload_image, gif_creator
- **Code Execution**: javascript_tool

## For Contributors

See the main [AGENTS.md](../AGENTS.md) for development guidelines and coding standards.
