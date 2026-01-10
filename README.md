# Claude Chrome MCP

An MCP (Model Context Protocol) server adapter that exposes Claude Browser Extension's browser automation tools to any MCP-compatible client.

## Overview

This package bridges the gap between the Claude Browser Extension's native messaging protocol and the standard MCP protocol, allowing any MCP client (Claude Desktop, Cline, Continue, custom clients, etc.) to control Chrome browser automation.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  MCP Client  │────▶│ claude-chrome│────▶│ Native Host  │────▶│  Extension   │
│  (any)       │ MCP │     -mcp     │sock │ (claude CLI) │stdio│  (Chrome)    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## Installation

```bash
npm install -g claude-chrome-mcp
```

Or run directly with npx:

```bash
npx claude-chrome-mcp
```

## Prerequisites

1. **Claude Browser Extension** installed in Chrome
2. **Claude Code CLI** installed (`npm install -g @anthropic-ai/claude-code`)
3. Chrome running with the extension active
4. **Native messaging configured** - see [Chrome Extension Setup](./CHROME_EXTENSION_SETUP.md)

## Usage

### stdio Transport (Recommended)

For MCP clients that spawn servers as subprocesses:

```bash
claude-chrome-mcp
```

With native host auto-spawn:

```bash
claude-chrome-mcp --spawn
```

### HTTP/SSE Transport

For network-accessible server:

```bash
claude-chrome-mcp --http
```

With custom port:

```bash
claude-chrome-mcp --http 8080
```

## MCP Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claude-chrome": {
      "command": "claude-chrome-mcp",
      "args": ["--spawn"]
    }
  }
}
```

### Cline / Continue

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "claude-chrome": {
      "command": "npx",
      "args": ["claude-chrome-mcp", "--spawn"]
    }
  }
}
```

### HTTP Transport

For clients supporting HTTP/SSE:

```json
{
  "mcpServers": {
    "claude-chrome": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3456/sse"
      }
    }
  }
}
```

## Available Tools

The server exposes 20 browser automation tools (the extension supports all 20, though Claude Code only exposes 17 via its MCP interface):

### Navigation
- **navigate** - Navigate to URLs or browser history

### Interaction
- **computer** - Mouse clicks, keyboard input, scrolling, screenshots
- **form_input** - Fill form fields (text, dropdown, checkbox)
- **find** - Search for elements by text

### Content
- **read_page** - Parse page DOM with element references
- **get_page_text** - Extract visible text content

### Tab Management
- **tabs_context** - Get current tab information
- **tabs_create** - Create new tabs
- **tabs_context_mcp** - Get MCP tab group info
- **tabs_create_mcp** - Create tab in MCP group
- **resize_window** - Resize browser window

### Debugging
- **read_console_messages** - Read browser console
- **read_network_requests** - Monitor network requests

### Media
- **upload_image** - Upload images via drag-drop
- **gif_creator** - Record and export GIFs

### Workflow
- **update_plan** - Create/update task plans
- **shortcuts_list** - List saved shortcuts
- **shortcuts_execute** - Run shortcuts

### Code Execution
- **javascript_tool** - Execute JavaScript in page context

### Utility
- **turn_answer_start** - Mark response start (UI coordination)

## Examples

### Navigate to a URL

```json
{
  "tool": "navigate",
  "arguments": {
    "url": "https://example.com"
  }
}
```

### Click an Element

```json
{
  "tool": "computer",
  "arguments": {
    "action": "left_click",
    "coordinate": [500, 300]
  }
}
```

### Read Page Content

```json
{
  "tool": "read_page",
  "arguments": {}
}
```

### Fill a Form Field

```json
{
  "tool": "form_input",
  "arguments": {
    "ref": "ref_1",
    "value": "Hello World"
  }
}
```

### Take a Screenshot

```json
{
  "tool": "computer",
  "arguments": {
    "action": "screenshot"
  }
}
```

## API Reference

### CLI Options

| Option | Description |
|--------|-------------|
| `--help, -h` | Show help message |
| `--http [port]` | Use HTTP/SSE transport (default port: 3456) |
| `--spawn, -s` | Spawn native host if not running |
| `--socket <path>` | Custom socket path |

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sse` | GET | Establish SSE connection |
| `/message` | POST | Send MCP message |
| `/health` | GET | Health check |
| `/tools` | GET | List available tools |

## Architecture

### Protocol Translation

The adapter translates between:

**MCP Format (input):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": {"url": "https://example.com"}
  }
}
```

**Native Host Format (internal):**
```json
{
  "method": "execute_tool",
  "params": {
    "tool": "navigate",
    "args": {"url": "https://example.com"}
  }
}
```

### Wire Protocol

Communication with the native host uses length-prefixed JSON:

```
┌────────────────┬────────────────────────────────────┐
│  Length (4B)   │  JSON Payload                      │
│  Little-endian │  UTF-8 encoded                     │
└────────────────┴────────────────────────────────────┘
```

## Troubleshooting

### "Claude CLI not found"

Ensure Claude Code is installed:

```bash
npm install -g @anthropic-ai/claude-code
which claude
```

### "Socket not available"

1. Make sure Chrome is running with the extension
2. Check socket exists: `ls /tmp/claude-mcp-browser-bridge-*`
3. Use `--spawn` flag to auto-start the native host:

```bash
claude-chrome-mcp --spawn
```

### "Not connected to native host"

The native host may not be running. Use `--spawn` flag to auto-start it:

```bash
claude-chrome-mcp --spawn
```

### Chrome Extension Integration

For detailed setup instructions including native messaging configuration, see:

**[Chrome Extension Setup Guide](./CHROME_EXTENSION_SETUP.md)**

This covers:
- Native messaging manifest installation
- Platform-specific configuration (Linux, macOS, Windows)
- NixOS-specific notes
- Verification and diagnostics

### "No tab available" Error

The extension needs at least one open tab to execute tools:

1. Open Chrome/Chromium
2. Navigate to any website (e.g., https://example.com)
3. Ensure the extension is active
4. Try the tool again

### Permission Errors

The extension requires permissions for each domain. When you first interact with a new domain, you may need to approve it in Chrome.

## Development

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-browser-extension
cd claude-chrome-mcp

# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev
```

## Testing

### Prerequisites

Before testing, ensure the native host is running:

```bash
# Start the native host in a separate terminal
claude --chrome-native-host
```

You should see:
```
[Claude Chrome Native Host] Initializing...
[Claude Chrome Native Host] Creating socket listener: /tmp/claude-mcp-browser-bridge-<username>
[Claude Chrome Native Host] Socket server listening for connections
[Claude Chrome Native Host] Socket permissions set to 0600
```

### Running Tests

The project includes several test scripts:

#### 1. Simple Connection Test

Tests socket connectivity:

```bash
node simple-test.js
```

#### 2. Comprehensive Test Suite

Interactive test suite that tests all major tools:

```bash
node test-comprehensive.js
```

This will test:
- Navigation (`navigate`)
- Page reading (`read_page`, `get_page_text`)
- Screenshots (`computer`)
- Element finding (`find`)
- Tab management (`tabs_context_mcp`)
- JavaScript execution (`javascript_tool`)
- Console messages (`read_console_messages`)
- Network requests (`read_network_requests`)
- Scrolling (`computer`)

After running the automated tests, the script enters interactive mode where you can manually test commands.

#### 3. HTTP API Test

Test the HTTP/SSE transport:

```bash
# Start the HTTP server (in separate terminal)
node dist/cli.js --http 3456

# Run HTTP tests
node test-http-api.js
```

### Troubleshooting Tests

**Socket not found:**
- Ensure `claude --chrome-native-host` is running
- Check socket exists: `ls -la /tmp/claude-mcp-browser-bridge-*`
- Verify Chrome is running with the extension enabled

**Connection timeout:**
- The Chrome extension must be installed and active
- The extension needs to connect to the native host first
- Try opening a new tab or refreshing the extension
- Check Chrome extension logs (chrome://extensions > Details > Inspect views)

**Tool execution fails:**
- Verify the extension has permissions for the current domain
- Check the browser console for errors
- Ensure you're on a valid webpage (not chrome:// URLs)

### Test Files

- `simple-test.js` - Socket connection diagnostics
- `test-comprehensive.js` - Full interactive test suite
- `test-http-api.js` - HTTP/SSE transport tests
- `test-mcp.js` - Alternative interactive test interface

## License

MIT
