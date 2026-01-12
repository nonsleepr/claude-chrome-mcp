# Claude Chrome MCP

MCP server for browser automation via the Claude Chrome Extension.

## Quick Start

### 1. Install Claude Browser Extension

Install from [claude.com/chrome](https://claude.com/chrome) or directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)

### 2. Install MCP Server

**Option A: Install with Bun (Recommended)**
```bash
bun install -g git+https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git

# Register native host (secure by default - auto-generates auth token)
claude-chrome-mcp --install

# Restart Chrome completely
```

**Option B: Clone and Install**
```bash
git clone https://gitea.bishop-musical.ts.net/nonsleepr/claude-chrome-mcp.git
cd claude-chrome-mcp
bun install
bun run build
bun link

# Register native host (secure by default - auto-generates auth token)
claude-chrome-mcp --install

# Restart Chrome completely
```

### 3. Get Your Authentication Token

After installation, your auto-generated authentication token is displayed in the terminal output.

You can also retrieve it anytime with:

```bash
claude-chrome-mcp --status
```

The status command displays your token and ready-to-use configuration examples.

### 4. Configure MCP Client

Use the authentication token from the installation output or `--status` command.

The server runs on `http://localhost:3456/mcp` by default.

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

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"],
      "env": {
        "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer YOUR_AUTO_GENERATED_TOKEN_HERE\"}"
      }
    }
  }
}
```

## Insecure Mode (Local Development Only)

For local development without sensitive data, you can skip authentication:

```bash
claude-chrome-mcp --install --insecure
```

**WARNING:** This allows anyone with localhost access to control your browser.

**Client configuration without auth:**

**Client configuration without auth:**

**OpenCode:**
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

**Claude Desktop:**
```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"]
    }
  }
}
```

## Advanced Configuration

### Custom Authentication Token

To use your own token instead of auto-generated:

### Custom Authentication Token

To use your own token instead of auto-generated:

```bash
# Generate a secure 256-bit token
AUTH_TOKEN=$(openssl rand -hex 32)

# Install with custom token
claude-chrome-mcp --install --auth-token "$AUTH_TOKEN"
```

### Custom Port

```bash
claude-chrome-mcp --install --port 8080
```

### Custom CORS Origins

By default, only localhost origins are allowed. To allow specific domains:

```bash
claude-chrome-mcp --install --cors-origins "https://app.example.com,https://api.example.com"
```

### Client Configuration Examples

#### OpenCode

`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "chrome": {
      "type": "remote",
      "url": "http://localhost:3456/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

#### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3456/mcp"],
      "env": {
        "MCP_REMOTE_HEADERS": "{\"Authorization\": \"Bearer YOUR_TOKEN_HERE\"}"
      }
    }
  }
}
```

#### Cline (VS Code Extension)

`.vscode/settings.json` or User Settings:

```json
{
  "cline.mcpServers": {
    "chrome": {
      "type": "http",
      "url": "http://localhost:3456/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

#### Continue.dev

`~/.continue/config.json`:

```json
{
  "mcpServers": {
    "chrome": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3456/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN_HERE"
        }
      }
    }
  }
}
```

#### Generic MCP Client (HTTP Transport)

```json
{
  "mcpServers": {
    "chrome": {
      "type": "http",
      "url": "http://localhost:3456/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Security Best Practices

1. **Auto-Generated Tokens**: Default installation generates secure 256-bit tokens
2. **Retrieve Token**: Use `claude-chrome-mcp --status` to view your token anytime
3. **Localhost Only**: Server binds to `127.0.0.1` by default - don't expose to network
4. **Token Rotation**: Periodically regenerate tokens by reinstalling
5. **Validate Access**: Monitor Chrome extension background console for connection attempts
6. **Secure Storage**: Never commit tokens to version control - use environment variables or secure vaults

### Additional Security Resources

- [MCP Authorization Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Auth Implementation Guide](https://blog.logto.io/mcp-auth-implementation-guide-2025-06-18)
- [GitHub: Secure and Scalable Remote MCP Servers](https://github.blog/ai-and-ml/generative-ai/how-to-build-secure-and-scalable-remote-mcp-servers/)
- [OAuth 2.1 Best Practices for MCP](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/)

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

## CLI Commands

```bash
claude-chrome-mcp --install              # Install (secure by default)
claude-chrome-mcp --install --insecure   # Install without auth (local dev)
claude-chrome-mcp --status               # Check status & view token
claude-chrome-mcp --uninstall            # Uninstall
claude-chrome-mcp --help                 # Show help
```

## Troubleshooting

**Check status and view token**:
```bash
claude-chrome-mcp --status
```

**Port already in use**:
If you see an error about the port being busy:
1. Find what's using the port: `lsof -i :3456` (Mac/Linux) or `netstat -ano | findstr :3456` (Windows)
2. Stop the conflicting process, or
3. Reinstall with a different port: `claude-chrome-mcp --install --port 8080`

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
bun install
bun run build
```

**Test**:
```bash
bun test
```

## License

MIT License - see [LICENSE](./LICENSE)
