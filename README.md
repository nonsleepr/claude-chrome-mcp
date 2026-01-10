# Claude Chrome MCP

A unified native host and MCP HTTP server for browser automation through the Claude Chrome Extension.

## Overview

This package provides a standalone native messaging host that bridges the Claude Chrome Extension with any MCP-compatible client. Unlike the previous approach that required the Claude CLI, this package is self-contained.

```
┌──────────────┐                    ┌─────────────────────────────────────┐                    ┌──────────────┐
│  MCP Client  │◄── HTTP/MCP ──────►│        claude-chrome-mcp            │◄── Chrome Native ──►│  Chrome      │
│  (any)       │   localhost:3456   │  (native host + HTTP MCP server)    │    Messaging        │  Extension   │
└──────────────┘                    └─────────────────────────────────────┘                    └──────────────┘
```

**Key Features:**
- **Self-contained**: No dependency on `claude --chrome-native-host`
- **Single process**: Native host and MCP server run together
- **Easy setup**: One command to install (`--install`)
- **Auto-start**: Chrome launches the native host automatically

## Installation

```bash
# Install globally
npm install -g claude-chrome-mcp

# Register as Chrome native messaging host
claude-chrome-mcp --install

# Restart Chrome completely
```

Or run directly with npx:

```bash
npx claude-chrome-mcp --install
```

## Prerequisites

1. **Claude Browser Extension** installed in Chrome/Chromium
   - Extension ID: `fcoeoabgfenejglbffodgkkbkcdhcgfn`
2. **Node.js** 18.0.0 or later

## How It Works

1. When the Chrome extension connects, Chrome automatically launches `claude-chrome-mcp`
2. The server starts listening for HTTP connections on port 3456 (or next available)
3. MCP clients connect via HTTP to `http://localhost:3456/mcp`
4. Tool requests flow: MCP Client → HTTP → Native Host → Chrome Extension → Browser

## MCP Client Configuration

Configure your MCP client to connect via HTTP:

```json
{
  "mcpServers": {
    "chrome-browser": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3456/mcp"
      }
    }
  }
}
```

## CLI Usage

```bash
# Install native host manifest
claude-chrome-mcp --install

# Install with custom extension ID
claude-chrome-mcp --install --extension-id YOUR_EXTENSION_ID

# Check installation status
claude-chrome-mcp --status

# Uninstall
claude-chrome-mcp --uninstall

# Show help
claude-chrome-mcp --help
```

## Available Tools

The server exposes 14 browser automation tools:

### Navigation
| Tool | Description |
|------|-------------|
| `navigate` | Navigate to URLs, back/forward |

### Interaction
| Tool | Description |
|------|-------------|
| `computer` | Click, type, scroll, screenshot, keyboard |
| `form_input` | Fill text inputs, select dropdowns |
| `find` | Search for elements by text |

### Content
| Tool | Description |
|------|-------------|
| `read_page` | Get DOM with element references |
| `get_page_text` | Extract visible text content |

### Tab Management
| Tool | Description |
|------|-------------|
| `tabs_context_mcp` | List tabs in MCP group (**call first with `createIfEmpty: true`**) |
| `tabs_create_mcp` | Create new tab in MCP group |
| `resize_window` | Resize browser window |

### Debugging
| Tool | Description |
|------|-------------|
| `read_console_messages` | Read browser console |
| `read_network_requests` | Read network activity |

### Media
| Tool | Description |
|------|-------------|
| `upload_image` | Upload image via drag-drop |
| `gif_creator` | Record actions as GIF |

### Code Execution
| Tool | Description |
|------|-------------|
| `javascript_tool` | Execute JavaScript in page context |

## Examples

### Initialize Tab Context (Do This First!)

```json
{
  "tool": "tabs_context_mcp",
  "arguments": {
    "createIfEmpty": true
  }
}
```

### Navigate to a URL

```json
{
  "tool": "navigate",
  "arguments": {
    "url": "https://example.com",
    "tabId": 123
  }
}
```

### Click an Element

```json
{
  "tool": "computer",
  "arguments": {
    "action": "left_click",
    "ref": "ref_1",
    "tabId": 123
  }
}
```

### Take a Screenshot

```json
{
  "tool": "computer",
  "arguments": {
    "action": "screenshot",
    "tabId": 123
  }
}
```

### Execute JavaScript

```json
{
  "tool": "javascript_tool",
  "arguments": {
    "action": "javascript_exec",
    "text": "document.title",
    "tabId": 123
  }
}
```

## Architecture

### Message Flow

```
MCP Client                    claude-chrome-mcp                    Chrome Extension
    │                               │                                     │
    │  POST /mcp (tool call)        │                                     │
    │──────────────────────────────►│                                     │
    │                               │  tool_request (stdout)              │
    │                               │────────────────────────────────────►│
    │                               │                                     │
    │                               │         [executes via CDP]          │
    │                               │                                     │
    │                               │  tool_response (stdin)              │
    │                               │◄────────────────────────────────────│
    │  HTTP Response                │                                     │
    │◄──────────────────────────────│                                     │
```

### Wire Protocol

Chrome native messaging uses length-prefixed JSON:

```
┌────────────────┬────────────────────────────────────┐
│  Length (4B)   │  JSON Payload                      │
│  Little-endian │  UTF-8 encoded                     │
└────────────────┴────────────────────────────────────┘
```

## Troubleshooting

### Check Installation Status

```bash
claude-chrome-mcp --status
```

### Native Host Not Starting

1. Ensure Chrome is completely restarted after installation
2. Check if manifest exists:
   - Linux: `~/.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
3. Verify wrapper script exists: `~/.local/share/claude-chrome-mcp/`

### Connection Issues

1. Check if port 3456 is available (or if server chose a different port)
2. Ensure Chrome extension is installed and enabled
3. Check Chrome extension logs: `chrome://extensions` → Details → Inspect views

### Permission Errors

The Chrome extension requires permissions for each domain. When first interacting with a new domain, you may need to approve it in Chrome.

### Custom Extension ID

If using a custom/development version of the Chrome extension:

```bash
claude-chrome-mcp --install --extension-id YOUR_EXTENSION_ID
```

## Development

```bash
# Clone and install
git clone https://github.com/anthropics/claude-chrome-mcp
cd claude-chrome-mcp
npm install

# Build
npm run build

# Install locally for testing
npm run install-native-host
```

### Project Structure

```
src/
├── cli.ts              # CLI entry point
├── native-host.ts      # Chrome native messaging protocol
├── unified-server.ts   # Combined native host + HTTP MCP server
├── tools.ts            # Tool definitions
├── install.ts          # Native host manifest installation
└── index.ts            # Package exports
```

## API Reference

### CLI Options

| Option | Description |
|--------|-------------|
| `--help, -h` | Show help message |
| `--install` | Install native host manifest |
| `--uninstall` | Remove native host manifest |
| `--status` | Check installation status |
| `--extension-id <id>` | Custom Chrome extension ID |
| `--port <port>` | HTTP server port (default: 3456) |

### Programmatic Usage

```typescript
import { UnifiedServer, installNativeHost } from 'claude-chrome-mcp';

// Install native host
await installNativeHost({ extensionId: 'custom-id' });

// Or create server programmatically
const server = new UnifiedServer({ port: 3456 });
await server.start();
```

## License

MIT
