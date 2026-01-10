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
import { 
  installNativeHost, 
  uninstallNativeHost, 
  getInstallationInfo 
} from './install.js';

interface CliOptions {
  install: boolean;
  uninstall: boolean;
  status: boolean;
  help: boolean;
  extensionId?: string;
  port?: number;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    install: false,
    uninstall: false,
    status: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          options.extensionId = args[i + 1];
          i++;
        } else {
          console.error('Error: --extension-id requires a value');
          process.exit(1);
        }
        break;

      case '--port':
        if (args[i + 1] && /^\d+$/.test(args[i + 1])) {
          options.port = parseInt(args[i + 1], 10);
          i++;
        } else {
          console.error('Error: --port requires a numeric value');
          process.exit(1);
        }
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

function printHelp(): void {
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
  --port <port>           HTTP server port (default: 3456, fallback to random if busy)

INSTALLATION
  1. Install the package globally:
     npm install -g claude-chrome-mcp

  2. Register as native host:
     claude-chrome-mcp --install

  3. Restart Chrome completely

  4. Configure your MCP client:
     {
       "mcpServers": {
         "claude_chrome": {
           "transport": {
             "type": "http",
             "url": "http://localhost:3456/mcp"
           }
         }
       }
     }

HOW IT WORKS
  When Chrome Extension connects to the native host:
  1. Chrome launches this process via native messaging
  2. HTTP server starts on port 3456 (or next available)
  3. MCP clients can connect via HTTP to control the browser
  4. Tool requests are routed: MCP Client → HTTP → Native Host → Chrome Extension

AVAILABLE TOOLS
  - navigate          Navigate to URL, back/forward
  - computer          Click, type, scroll, screenshot, keyboard
  - form_input        Fill text inputs, select dropdowns
  - find              Search for elements by text
  - read_page         Get DOM with element references
  - get_page_text     Extract visible text
  - tabs_context_mcp  List tabs in MCP group
  - tabs_create_mcp   Create tab in MCP group
  - resize_window     Resize browser window
  - read_console_messages  Read browser console
  - read_network_requests  Read network activity
  - upload_image      Upload image via drag-drop
  - gif_creator       Record actions as GIF
  - javascript_tool   Execute JS in page

EXAMPLES
  # Install native host
  claude-chrome-mcp --install

  # Install with custom extension ID
  claude-chrome-mcp --install --extension-id abcdefghijklmnop

  # Check installation status
  claude-chrome-mcp --status

  # Uninstall
  claude-chrome-mcp --uninstall

For more information: https://github.com/anthropics/claude-chrome-mcp
`);
}

function printStatus(): void {
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

async function runServer(options: CliOptions): Promise<void> {
  // Running as native host (launched by Chrome)
  // All logging must go to stderr (stdout is for Chrome protocol)
  
  const server = new UnifiedServer({
    port: options.port,
  });

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
  } catch (error) {
    console.error('[CLI] Failed to start server:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
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
