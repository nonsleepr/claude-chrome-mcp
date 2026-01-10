# Claude Chrome MCP

> Model Context Protocol server for browser automation via the Claude Chrome Extension

A unified native host and MCP HTTP server that enables programmatic control of Chrome through the [Claude Browser Extension](https://claude.com/chrome). Connect any MCP-compatible client to automate browser interactions.

## Features

- **Works with Claude.com Extension**: Integrates seamlessly with the official [Claude Chrome Extension](https://claude.com/chrome)
- **Zero Configuration**: Automatic native host installation and Chrome integration
- **MCP Standard**: Full compliance with Model Context Protocol over HTTP
- **14 Browser Tools**: Navigate, interact, read content, manage tabs, debug, and more
- **Multi-Client**: Support multiple simultaneous MCP client connections
- **Type-Safe**: Built with TypeScript for reliability

## Architecture

```mermaid
graph LR
    A[MCP Client] <-->|HTTP<br/>localhost:3456| B[claude-chrome-mcp<br/>Native Host + MCP Server]
    B <-->|Chrome Native<br/>Messaging| C[Chrome<br/>Extension]
```

## Quick Start

### 1. Install the Claude Browser Extension

Visit [claude.com/chrome](https://claude.com/chrome) to install the official Claude Browser Extension.

> **Note**: Simply having the extension installed is sufficient - you don't need to be logged in to Claude.com for the MCP server to work. The extension will automatically connect to the native host.

### 2. Install and Configure MCP Server

#### Option A: Install from npm (Public Registry)

```bash
# Install globally
npm install -g claude-chrome-mcp

# Register as Chrome native messaging host
claude-chrome-mcp --install

# Restart Chrome completely (required for native host registration)
```

#### Option B: Install from Git URL (Bun - Recommended)

```bash
# Install globally with Bun (works with any git URL)
bun install -g git+https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git

# Register as Chrome native messaging host
claude-chrome-mcp --install

# Restart Chrome completely
```

#### Option C: Install from Git URL (npm - via tarball)

Due to npm's limitations with git dependencies, you'll need to create a tarball first:

```bash
# Clone and build
git clone https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git
cd claude-chrome-mcp
npm install
npm run build
npm pack

# Install the tarball globally
npm install -g ./claude-chrome-mcp-*.tgz

# Register as Chrome native messaging host
claude-chrome-mcp --install

# Restart Chrome completely
```

**Note**: npm has known issues with git URL installations. We recommend using Bun for direct git URL installations, or installing from npm registry when available.

That's it! Chrome will now automatically launch the MCP server when the extension connects.

### 3. Configure Your MCP Client

The native host automatically starts an HTTP server on port 3456. Configure your MCP client to connect:

#### Claude Desktop

Add to `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

#### Claude Code CLI

```bash
claude mcp add --transport http claude_chrome http://localhost:3456/mcp
```

#### Other MCP Clients (Cline, Continue, etc.)

Refer to your client's documentation. Most support HTTP transport with this configuration:

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

**Note**: For private installations (from git URLs), the native host must be installed globally first using one of the installation methods above. npx/bunx won't work for installing the native host from git URLs.

## Prerequisites

### Required

1. **Claude Browser Extension** - Install from [claude.com/chrome](https://claude.com/chrome)
   - Official extension ID: `fcoeoabgfenejglbffodgkkbkcdhcgfn`
   - Required for browser automation capabilities

2. **Node.js** 18.0.0 or later
   - [Download from nodejs.org](https://nodejs.org/)

### Supported Browsers

- Google Chrome
- Chromium
- Brave (Chromium-based)
- Microsoft Edge (Chromium-based)

> **Note**: The extension must be installed and active in your browser for the MCP server to function.

## CLI Reference

```bash
# Install native host manifest
claude-chrome-mcp --install

# Install with security settings (RECOMMENDED)
claude-chrome-mcp --install \
  --port 3456 \
  --auth-token "your-secret-token" \
  --cors-origins "https://app.example.com"

# Install with custom extension ID
claude-chrome-mcp --install --extension-id YOUR_EXTENSION_ID

# Check installation status
claude-chrome-mcp --status

# Uninstall
claude-chrome-mcp --uninstall

# Show help
claude-chrome-mcp --help
```

## Security

⚠️ **IMPORTANT**: Security settings are configured at **INSTALL TIME**, not at runtime. When Chrome launches the native host, it uses the configuration stored in the wrapper script.

### Quick Start: Secure Installation

```bash
# Generate a secure random token
TOKEN=$(openssl rand -hex 32)

# Install with authentication
claude-chrome-mcp --install --auth-token "$TOKEN"

# Configure your MCP client with the token
{
  "mcpServers": {
    "claude_chrome": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"],
      "env": {
        "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN_HERE\"}"
      }
    }
  }
}
```

### Bearer Token Authentication

By default, the MCP server has **no authentication** - anyone with access to localhost can control your browser. For security, enable Bearer token authentication during installation:

```bash
# Install with authentication
claude-chrome-mcp --install --auth-token "my-secret-token-12345"
```

The auth token is stored as an environment variable in the wrapper script (not visible in `ps aux`). Your MCP client must include the token in requests:

```json
{
  "headers": {
    "Authorization": "Bearer my-secret-token-12345"
  }
}
```

**Security tokens are stored at:**
- Linux/macOS: `~/.local/share/claude-chrome-mcp/claude-chrome-mcp-native-host`
- Windows: `%USERPROFILE%\.claude-chrome-mcp\claude-chrome-mcp-native-host.bat`

### CORS Configuration

By default, only `localhost` origins are allowed. To allow specific external origins:

```bash
claude-chrome-mcp --install \
  --auth-token "token" \
  --cors-origins "https://app.example.com,https://api.example.com"
```

### Port Configuration

The default port is 3456. To use a different port:

```bash
claude-chrome-mcp --install --port 8080 --auth-token "token"
```

**Note**: After changing the port, update your MCP client configuration to use the new URL.

### Updating Security Settings

To change any security settings, simply reinstall:

```bash
# Update auth token
claude-chrome-mcp --install --auth-token "new-token"

# Change port
claude-chrome-mcp --install --port 8080 --auth-token "token"

# After reinstalling, restart Chrome completely
```

### Security Best Practices

✅ **Do:**
- Always use `--auth-token` for production/shared environments
- Generate strong random tokens: `openssl rand -hex 32`
- Use HTTPS origins in `--cors-origins` for production
- Restart Chrome after changing security settings
- Store tokens securely (they're in the wrapper script)

❌ **Don't:**
- Run without authentication on shared/public networks
- Use weak or predictable tokens
- Share tokens between different users or environments
- Commit tokens to source control

### Security Architecture

```
Chrome Extension connects
    ↓
Launches wrapper script (~/.local/share/claude-chrome-mcp/...)
    ↓
Wrapper sets environment variables:
  - MCP_PORT=3456
  - MCP_AUTH_TOKEN="secret"
  - MCP_CORS_ORIGINS="https://app.example.com"
    ↓
Starts native host with security enabled
    ↓
MCP clients must include Authorization header
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
| `tabs_context` | List tabs in browser tab group (auto-creates group if needed) |
| `tabs_create` | Create new tab with optional URL navigation |
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
    "ref": "ref_1"
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

### Execute JavaScript

```json
{
  "tool": "javascript_tool",
  "arguments": {
    "action": "javascript_exec",
    "text": "document.title"
  }
}
```

## Architecture

## Architecture

### Message Flow

```mermaid
sequenceDiagram
    participant MC as MCP Client
    participant CCP as claude-chrome-mcp
    participant CE as Chrome Extension
    participant B as Browser
    
    MC->>CCP: POST /mcp (tool call)
    CCP->>CE: tool_request (native messaging)
    CE->>B: Execute via CDP
    B-->>CE: Result
    CE-->>CCP: tool_response
    CCP-->>MC: HTTP Response
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

If using a custom or development version of the Chrome extension:

```bash
claude-chrome-mcp --install --extension-id YOUR_EXTENSION_ID
```

### Debugging

Check native host logs (all logging goes to stderr):
- Chrome intercepts and logs native host stderr to the extension console
- Open `chrome://extensions` → Claude Extension → Details → Inspect views → Service Worker
- Look for native host connection messages

## Contributing

Contributions are welcome! Please see:
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines and workflow
- [AGENTS.md](./AGENTS.md) - Development guidelines and coding standards
- [docs/](./docs/) - Technical architecture and developer documentation

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Related Projects

- [Claude Browser Extension](https://claude.com/chrome) - Official Chrome extension for browser automation
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification and documentation
- [Claude Desktop](https://claude.ai/download) - Desktop app with built-in MCP client support
