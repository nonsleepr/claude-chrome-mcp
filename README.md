# Claude Chrome MCP

MCP server for browser automation via the Claude Chrome Extension.

This project integrates with [Anthropic's Claude Chrome Extension](https://claude.com/chrome) using the standard Chrome Native Messaging protocol to provide browser automation capabilities to MCP clients.

## Quick Start

### 1. Install Claude Browser Extension

Install from [claude.com/chrome](https://claude.com/chrome) or the [Chrome Web Store](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)

### 2. Install MCP Server

```bash
# Install from GitHub
bun install -g git+https://github.com/nonsleepr/claude-chrome-mcp.git

# OR clone and install locally
git clone https://github.com/nonsleepr/claude-chrome-mcp.git
cd claude-chrome-mcp
bun install
bun run build
bun link
```

### 3. Register Native Host

```bash
# Install (secure by default - auto-generates auth token)
claude-chrome-mcp --install

# Restart Chrome completely
```

After installation, your authentication token is displayed. Retrieve it anytime with:

```bash
claude-chrome-mcp --status
```

### 4. Configure MCP Client

Use the token from installation output or `--status` command.

**OpenCode** (`~/.config/opencode/opencode.json`):
```json
{
  "mcp": {
    "chrome": {
      "type": "remote",
      "url": "http://localhost:3456/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer YOUR_AUTO_GENERATED_TOKEN_HERE"
      }
    }
  }
}
```

**Claude Desktop / Generic MCP Client** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "chrome": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3456/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_AUTO_GENERATED_TOKEN_HERE"
        }
      }
    }
  }
}
```

## Configuration

Run `claude-chrome-mcp --help` for detailed configuration options including custom tokens, ports, CORS origins, and security settings.

### Insecure Mode (Local Development Only)

```bash
claude-chrome-mcp --install --insecure
```

**WARNING:** Anyone with localhost access can control your browser.

**Client config without auth:**
```json
{
  "mcp": {
    "chrome": {
      "type": "remote",
      "url": "http://localhost:3456/mcp",
      "enabled": true
    }
  }
}
```

## What Your Agent Can Do

- **Browse and research** - navigate websites, read content, extract text
- **Fill out forms** - enter text, select dropdowns, click buttons
- **Interact naturally** - click, scroll, type, keyboard shortcuts
- **Search pages semantically** - find elements by description (requires Claude subscription)
- **Debug web apps** - read console logs, inspect network requests, run JavaScript
- **Capture and share** - screenshots, record workflows as animated GIFs
- **Manage tabs** - open, switch, resize

## Troubleshooting

**Check status and view token**:
```bash
claude-chrome-mcp --status
```

**Port already in use**:
```bash
# Find what's using the port
lsof -i :3456  # Mac/Linux
netstat -ano | findstr :3456  # Windows

# OR install with different port
claude-chrome-mcp --install --port 8080
```

**Connection issues**:
1. Restart Chrome completely after installation
2. Check extension is installed at `chrome://extensions`
3. Verify manifest exists: `~/.config/chromium/NativeMessagingHosts/`

## License

MIT License - see [LICENSE](./LICENSE)

## Attribution

This MCP server provides integration with Anthropic's Claude Chrome Extension using standard Chrome Native Messaging protocols. The extension itself is a separate product developed by Anthropic, available at [claude.com/chrome](https://claude.com/chrome).
