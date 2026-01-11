#!/usr/bin/env node
/**
 * Claude Chrome MCP - CLI Entry Point
 *
 * A unified native host and MCP HTTP server for browser automation.
 *
 * Usage:
 *   claude-chrome-mcp                           # Run as native host (default, launched by Chrome)
 *   claude-chrome-mcp --install                 # Install native host manifest
 *   claude-chrome-mcp --install --extension-id X  # Install with custom extension ID
 *   claude-chrome-mcp --uninstall               # Remove native host manifest
 *   claude-chrome-mcp --status                  # Check installation status
 *   claude-chrome-mcp --help                    # Show help
 */
import { UnifiedServer } from './unified-server.js';
import { installNativeHost, uninstallNativeHost, getInstallationInfo } from './install.js';
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        install: false,
        uninstall: false,
        status: false,
        help: false,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
            case '--install':
                options.install = true;
                break;
            case '--uninstall':
                options.uninstall = true;
                break;
            case '--status':
                options.status = true;
                break;
            case '--extension-id':
                if (!nextArg || nextArg.startsWith('-')) {
                    console.error('Error: --extension-id requires a value');
                    process.exit(1);
                }
                options.extensionId = nextArg;
                i++;
                break;
            case '--port':
                if (!nextArg || !/^\d+$/.test(nextArg)) {
                    console.error('Error: --port requires a numeric value');
                    process.exit(1);
                }
                options.port = parseInt(nextArg, 10);
                i++;
                break;
            case '--auth-token':
                if (!nextArg || nextArg.startsWith('-')) {
                    console.error('Error: --auth-token requires a value');
                    process.exit(1);
                }
                options.authToken = nextArg;
                i++;
                break;
            case '--cors-origins':
                if (!nextArg || nextArg.startsWith('-')) {
                    console.error('Error: --cors-origins requires a value (comma-separated list)');
                    process.exit(1);
                }
                options.corsOrigins = nextArg.split(',').map((origin) => origin.trim());
                i++;
                break;
            default:
                if (arg.startsWith('-')) {
                    console.error(`Unknown option: ${arg}`);
                    console.error('Use --help for usage information');
                    process.exit(1);
                }
        }
    }
    return options;
}
function printHelp() {
    console.log(`
Claude Chrome MCP - Browser Automation via Model Context Protocol

DESCRIPTION
  A unified native host and MCP HTTP server that enables browser automation
  through the Claude Chrome Extension.

USAGE
  claude-chrome-mcp [options]

OPTIONS
  --help, -h              Show this help message
  --install               Install native host manifest for Chrome/Chromium
  --uninstall             Remove native host manifest
  --status                Check installation status
  --extension-id <id>     Custom Chrome extension ID (default: official Claude extension)
  --port <port>           HTTP server port (default: 3456, must be available)
  --auth-token <token>    Require Bearer token authentication (default: none)
  --cors-origins <list>   Comma-separated list of allowed CORS origins (default: localhost only)

INSTALLATION
  1. Install the package globally:
     npm install -g claude-chrome-mcp

  2. Register as native host (with security settings):
     claude-chrome-mcp --install --auth-token "your-secret-token" --port 3456

  3. Restart Chrome completely

  4. Configure your MCP client:
     {
       "mcpServers": {
         "claude_chrome": {
           "transport": {
             "type": "http",
             "url": "http://localhost:3456/mcp",
             "headers": {
               "Authorization": "Bearer your-secret-token"
             }
           }
         }
       }
     }

SECURITY
  ⚠️  IMPORTANT: Security settings are configured at INSTALL time, not runtime.
  
  Authentication:
    Use --auth-token during installation to require Bearer token authentication.
    The token is stored in the wrapper script as an environment variable (not in process args).
    
    Example:
      claude-chrome-mcp --install --auth-token "$(openssl rand -hex 32)"

  CORS:
    By default, only localhost origins are allowed. To allow specific origins:
      claude-chrome-mcp --install --cors-origins "https://app.example.com,https://api.example.com"

  Port:
    Specify a custom port during installation:
      claude-chrome-mcp --install --port 8080
    
    ⚠️  The configured port must be available when the native host starts.
    If the port is busy, the service will fail to start with an error message.
    
    To check what's using a port:
      • Linux/Mac: lsof -i :3456
      • Windows: netstat -ano | findstr :3456

  To update settings:
    Simply reinstall with new parameters - installation will overwrite existing configuration.

HOW IT WORKS
  When Chrome Extension connects to the native host:
  1. Chrome launches this process via native messaging
  2. HTTP server starts on configured port (default 3456)
  3. MCP clients can connect via HTTP to control the browser
  4. Tool requests are routed: MCP Client → HTTP → Native Host → Chrome Extension

AVAILABLE TOOLS
  - navigate          Navigate to URL, back/forward
  - computer          Click, type, scroll, screenshot, keyboard
  - form_input        Fill text inputs, select dropdowns
  - find              Search for elements by text
  - read_page         Get DOM with element references
  - get_page_text     Extract visible text
  - tabs_context      List tabs in browser tab group
  - tabs_create       Create tab in browser tab group
  - resize_window     Resize browser window
  - read_console_messages  Read browser console
  - read_network_requests  Read network activity
  - upload_image      Upload image via drag-drop
  - gif_creator       Record actions as GIF
  - javascript_tool   Execute JS in page

EXAMPLES
  # Install with default settings (INSECURE - no auth)
  claude-chrome-mcp --install

  # Install with authentication (RECOMMENDED)
  claude-chrome-mcp --install --auth-token "my-secret-token-12345"

  # Install with custom port and CORS origins
  claude-chrome-mcp --install \\
    --port 8080 \\
    --auth-token "secret" \\
    --cors-origins "https://app.example.com,https://api.example.com"

  # Install with custom extension ID
  claude-chrome-mcp --install --extension-id abcdefghijklmnop --auth-token "secret"

  # Check installation status
  claude-chrome-mcp --status

  # Uninstall
  claude-chrome-mcp --uninstall

For more information: https://github.com/anthropics/claude-chrome-mcp
`);
}
function printStatus() {
    const info = getInstallationInfo();
    console.log('Claude Chrome MCP Installation Status');
    console.log('=====================================');
    console.log('');
    console.log(`Installed: ${info.installed ? 'Yes' : 'No'}`);
    if (info.manifests.length > 0) {
        console.log('');
        console.log('Manifest files:');
        for (const manifest of info.manifests) {
            console.log(`  - ${manifest}`);
        }
    }
    console.log('');
    console.log(`Wrapper directory: ${info.wrapperDir}`);
    console.log(`Wrapper exists: ${info.wrapperExists ? 'Yes' : 'No'}`);
    if (!info.installed) {
        console.log('');
        console.log('To install, run: claude-chrome-mcp --install');
    }
}
async function runServer(options) {
    // Running as native host (launched by Chrome)
    // All logging must go to stderr (stdout is for Chrome protocol)
    // Check for port in environment if not provided via CLI
    let port = options.port;
    if (!port && process.env.MCP_PORT) {
        port = parseInt(process.env.MCP_PORT, 10);
    }
    // Check for auth token in environment if not provided via CLI
    const authToken = options.authToken || process.env.MCP_AUTH_TOKEN;
    // Check for CORS origins in environment if not provided via CLI
    let corsOrigins = options.corsOrigins;
    if (!corsOrigins && process.env.MCP_CORS_ORIGINS) {
        corsOrigins = process.env.MCP_CORS_ORIGINS.split(',').map((origin) => origin.trim());
    }
    const server = new UnifiedServer({
        port,
        authToken,
        corsOrigins,
    });
    // Log security configuration to stderr
    if (authToken) {
        console.error('[CLI] Bearer token authentication enabled');
    }
    else {
        console.error('[CLI] Warning: No authentication configured. Use --auth-token for security.');
    }
    if (corsOrigins && corsOrigins.length > 0) {
        console.error(`[CLI] CORS origins: ${corsOrigins.join(', ')}`);
    }
    else {
        console.error('[CLI] CORS: localhost only (default)');
    }
    // Handle shutdown signals
    const shutdown = () => {
        console.error('[CLI] Shutting down...');
        server.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    try {
        await server.start();
    }
    catch (error) {
        console.error('[CLI] Failed to start server:', error);
        process.exit(1);
    }
}
async function main() {
    const options = parseArgs();
    if (options.help) {
        printHelp();
        return;
    }
    if (options.status) {
        printStatus();
        return;
    }
    if (options.install) {
        await installNativeHost({
            extensionId: options.extensionId,
            port: options.port,
            authToken: options.authToken,
            corsOrigins: options.corsOrigins,
            verbose: true,
        });
        return;
    }
    if (options.uninstall) {
        await uninstallNativeHost({ verbose: true });
        return;
    }
    // Default: run as native host server
    await runServer(options);
}
main().catch((error) => {
    console.error('[CLI] Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map