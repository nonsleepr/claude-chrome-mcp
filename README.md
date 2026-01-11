# Claude Chrome MCP

MCP server for browser automation via the Claude Chrome Extension.

## Quick Start

### 1. Install Claude Browser Extension

Install from [claude.com/chrome](https://claude.com/chrome) or directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)

### 2. Install MCP Server

**Option A: Install with Bun (Recommended)**
```bash
bun install -g git+https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git

# Register native host
claude-chrome-mcp --install

# Restart Chrome completely
```

**Option B: Clone and Install**
```bash
git clone https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git
cd claude-chrome-mcp
npm install
npm run build
npm install -g .

# Register native host
claude-chrome-mcp --install

# Restart Chrome completely
```

### 3. Configure MCP Client

The server runs on `http://localhost:3456/mcp` by default.

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "claude_chrome": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"]
    }
  }
}
```

**Other MCP Clients**:
```json
{
  "mcpServers": {
    "claude_chrome": {
      "type": "http",
      "url": "http://localhost:3456/mcp"
    }
  }
}
```

## Security (Optional)

Install with authentication:

```bash
claude-chrome-mcp --install --auth-token "$(openssl rand -hex 32)" --port 3456
```

Then configure your MCP client to send the token:
```json
{
  "env": {
    "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN_HERE\"}"
  }
}
```

**Port Configuration**:
- The configured port must be available when the native host starts
- If the port is busy, the service will fail with an error message
- To use a different port, reinstall with `--port <different-port>`
- Check what's using a port:
  - Linux/Mac: `lsof -i :3456`
  - Windows: `netstat -ano | findstr :3456`

## Available Tools

- `navigate` - Navigate to URLs, back/forward
- `computer` - Click, type, scroll, screenshot, keyboard
- `form_input` - Fill inputs, select dropdowns
- `find` - Search elements by text
- `read_page` - Get DOM with element refs
- `get_page_text` - Extract visible text
- `tabs_context` - List tabs
- `tabs_create` - Create new tab
- `resize_window` - Resize window
- `read_console_messages` - Read console
- `read_network_requests` - Read network
- `upload_image` - Upload via drag-drop
- `gif_creator` - Record as GIF
- `javascript_tool` - Execute JS

## Server Instructions

This MCP server includes built-in instructions that help AI models use the browser automation tools effectively. These instructions are automatically delivered via the MCP protocol's `initialize` response and cover:

- **GIF Recording Best Practices** - Frame capture timing and meaningful file naming
- **Console Debugging** - Using pattern filtering to reduce verbose output
- **Critical Warnings** - Avoiding browser alerts and dialogs that freeze automation
- **Tab Management** - Automatic initialization and proper tab ID handling
- **Error Handling** - Timeout behavior and recovery strategies
- **Cross-Tool Workflows** - Effective patterns for combining tools (e.g., find → computer, read_page → form_input)

The instructions are comprehensive (~600 words) and focus on tool relationships, operational patterns, and constraints that aren't conveyed by tool descriptions alone.

For more information about MCP server instructions, see the [MCP blog post](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/).

## CLI Commands

```bash
claude-chrome-mcp --install              # Install native host
claude-chrome-mcp --install --auth-token "token"  # With auth
claude-chrome-mcp --status               # Check status
claude-chrome-mcp --uninstall            # Uninstall
claude-chrome-mcp --help                 # Show help
```

## Troubleshooting

**Check status**:
```bash
claude-chrome-mcp --status
```

**Port already in use**:
If you see an error about the port being busy:
1. Find what's using the port: `lsof -i :3456` (Mac/Linux) or `netstat -ano | findstr :3456` (Windows)
2. Stop the conflicting process, or
3. Reinstall with a different port: `claude-chrome-mcp --install --port 8080 --auth-token "token"`

**Connection issues**:
1. Restart Chrome completely after installation
2. Check extension is installed at `chrome://extensions`
3. Verify manifest exists: `~/.config/chromium/NativeMessagingHosts/`

**Custom extension ID**:
```bash
claude-chrome-mcp --install --extension-id YOUR_EXTENSION_ID
```

## Development

**Build**:
```bash
npm install
npm run build
```

**Test**:
```bash
npm test
```

See [AGENTS.md](./AGENTS.md) for development guidelines.

## License

MIT License - see [LICENSE](./LICENSE)
