#!/usr/bin/env bun
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

import { McpHttpServer } from './mcp-server.js';
import { 
  installNativeHost, 
  uninstallNativeHost, 
  getInstallationInfo 
} from './install.js';
import {
  title,
  section,
  command,
  dim,
  insecure,
  insecureWithBg,
  success as successColor,
  code,
  url,
  highlightJSON,
  warning,
  warningBlock,
  symbols,
  labelValue,
  path as pathColor,
  secure,
} from './utils/format.js';

interface CliOptions {
  install: boolean;
  uninstall: boolean;
  status: boolean;
  help: boolean;
  insecure: boolean;
  extensionId?: string;
  port?: number;
  authToken?: string;
  corsOrigins?: string[];
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    install: false,
    uninstall: false,
    status: false,
    help: false,
    insecure: false,
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

      case '--insecure':
        options.insecure = true;
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

function printHelp(): void {
  console.log(title('Claude Chrome MCP - Browser Automation via Model Context Protocol'));
  console.log('');
  
  console.log(section('DESCRIPTION'));
  console.log('  A unified native host and MCP HTTP server that enables browser automation');
  console.log('  through the Claude Chrome Extension.');
  console.log('');
  
  console.log(section('USAGE'));
  console.log('  claude-chrome-mcp [options]');
  console.log('');
  
  console.log(section('OPTIONS'));
  console.log(`  ${command('--help, -h')}              Show this help message`);
  console.log(`  ${command('--install')}               Install native host manifest`);
  console.log(`  ${command('--uninstall')}             Remove native host manifest`);
  console.log(`  ${command('--status')}                Check installation status`);
  console.log('');
  
  console.log(section('INSTALL CONFIGURATION'));
  console.log(dim('  These options are only used with --install:'));
  console.log('');
  console.log(`  ${command('--insecure')}              Skip authentication (local dev only)`);
  console.log(dim('                          WARNING: Anyone on localhost can control browser'));
  console.log('');
  console.log(`  ${command('--auth-token')} <token>    Use custom authentication token`);
  console.log(dim('                          (default: auto-generated 256-bit token)'));
  console.log('');
  console.log(`  ${command('--extension-id')} <id>     Custom Chrome extension ID`);
  console.log(dim('                          (default: official Claude extension)'));
  console.log('');
  console.log(`  ${command('--port')} <port>           HTTP server port`);
  console.log(dim('                          (default: 3456)'));
  console.log('');
  console.log(`  ${command('--cors-origins')} <list>   Comma-separated allowed CORS origins`);
  console.log(dim('                          (default: localhost only)'));
  console.log('');
  
  console.log(section('INSTALLATION'));
  console.log('  1. Install the package globally:');
  console.log(`     ${dim('$')} ${code('npm install -g claude-chrome-mcp')}`);
  console.log('');
  console.log('  2. Register as native host (secure by default):');
  console.log(`     ${dim('$')} ${code('claude-chrome-mcp --install')}`);
  console.log('');
  console.log('  3. Restart Chrome completely (quit and reopen)');
  console.log('');
  console.log('  4. Configure your MCP client (see EXAMPLES below)');
  console.log('');
  
  console.log(section('SECURITY'));
  console.log(`  ${warning('[!]')} IMPORTANT: Security settings are configured at INSTALL time, not runtime.`);
  console.log('');
  console.log('  Authentication:');
  console.log('    By default, installation auto-generates a secure 256-bit token.');
  console.log('    Token is stored in the wrapper script as an environment variable.');
  console.log('');
  console.log('    Default (secure):');
  console.log(`      ${dim('$')} ${code('claude-chrome-mcp --install')}`);
  console.log('');
  console.log('    Custom token:');
  console.log(`      ${dim('$')} ${code('claude-chrome-mcp --install --auth-token "$(openssl rand -hex 32)"')}`);
  console.log('');
  console.log('    Insecure mode (local dev only):');
  console.log(`      ${dim('$')} ${code('claude-chrome-mcp --install --insecure')}`);
  console.log('');
  console.log('  CORS Origins:');
  console.log('    By default, only localhost origins are allowed.');
  console.log('    To allow specific domains:');
  console.log(`      ${dim('$')} ${code('claude-chrome-mcp --install --cors-origins "https://app.example.com"')}`);
  console.log('');
  console.log('  Custom Port:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install --port 8080')}`);
  console.log('');
  console.log('    Check port availability:');
  console.log(`      ${dim('Linux/Mac:')} lsof -i :3456`);
  console.log(`      ${dim('Windows:')} netstat -ano | findstr :3456`);
  console.log('');
  console.log('  To update settings:');
  console.log('    Reinstall with new parameters - installation overwrites existing config.');
  console.log('');
  
  console.log(section('AVAILABLE TOOLS (14)'));
  console.log(`  Navigation:    ${code('navigate')}, ${code('tabs_context')}, ${code('tabs_create')}`);
  console.log(`  Interaction:   ${code('computer')}, ${code('form_input')}, ${code('find')}`);
  console.log(`  Content:       ${code('read_page')}, ${code('get_page_text')}`);
  console.log(`  Debugging:     ${code('read_console_messages')}, ${code('read_network_requests')}, ${code('javascript_tool')}`);
  console.log(`  Media:         ${code('gif_creator')}, ${code('upload_image')}`);
  console.log(`  Window:        ${code('resize_window')}`);
  console.log('');
  
  console.log(section('EXAMPLES'));
  console.log(`  Install with default settings ${successColor('(SECURE - recommended)')}:`);
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install')}`);
  console.log('');
  console.log(`  Install without authentication ${insecure('(INSECURE - local dev only)')}:`);
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install --insecure')}`);
  console.log('');
  console.log('  Install with custom token:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install --auth-token "my-secret-token-12345"')}`);
  console.log('');
  console.log('  Install with full configuration:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install \\')}`);
  console.log(`        ${code('--port 8080 \\')}`);
  console.log(`        ${code('--auth-token "secret" \\')}`);
  console.log(`        ${code('--cors-origins "https://app.example.com,https://api.example.com"')}`);
  console.log('');
  console.log('  Install with custom extension:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --install \\')}`);
  console.log(`        ${code('--extension-id abcdefghijklmnop')}`);
  console.log('');
  console.log('  Check installation status:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --status')}`);
  console.log('');
  console.log('  Uninstall:');
  console.log(`    ${dim('$')} ${code('claude-chrome-mcp --uninstall')}`);
  console.log('');
  
  console.log(section('MCP CLIENT CONFIGURATION'));
  console.log(dim('After installation, the auth token is displayed in the output.'));
  console.log(dim('You can also view it anytime with: claude-chrome-mcp --status'));
  console.log('');
  const mcpConfig = {
    mcpServers: {
      chrome: {
        transport: {
          type: 'http',
          url: 'http://localhost:3456/mcp',
          headers: {
            Authorization: 'Bearer your-auto-generated-token-here',
          },
        },
      },
    },
  };
  console.log(highlightJSON(mcpConfig));
  console.log('');
  
  console.log(`For more information: ${url('https://github.com/nonsleepr/claude-chrome-mcp')}`);
  console.log('');
}

function printStatus(): void {
  const info = getInstallationInfo();
  
  console.log(title('Claude Chrome MCP - Installation Status'));
  console.log('');
  
  if (!info.installed) {
    console.log(labelValue('Status:', `${symbols.error} Not Installed`));
    console.log('');
    console.log('To install:');
    console.log(`  ${dim('$')} ${code('claude-chrome-mcp --install')}`);
    console.log('');
    console.log('For help:');
    console.log(`  ${dim('$')} ${code('claude-chrome-mcp --help')}`);
    console.log('');
    return;
  }
  
  console.log(labelValue('Status:', `${symbols.success} Installed`));
  if (info.runtime) {
    console.log(labelValue('Runtime:', `${info.runtime}`));
  }
  console.log('');
  
  if (info.manifests.length > 0) {
    console.log(section('Manifest Files:'));
    for (const manifest of info.manifests) {
      console.log(`  ${symbols.success} ${pathColor(manifest)}`);
    }
    console.log('');
  }
  
  console.log(section('Wrapper:'));
  console.log(labelValue('  Directory:', pathColor(info.wrapperDir)));
  console.log(labelValue('  Status:', info.wrapperExists ? `${symbols.success} Exists` : `${symbols.error} Missing`));
  console.log('');
  
  console.log(section('Security Configuration:'));
  if (info.authTokenConfigured) {
    console.log(labelValue('  Auth Token:', secure('[✓] Configured')));
  } else {
    console.log(labelValue('  Auth Token:', insecureWithBg('[✗] NOT CONFIGURED - INSECURE!')));
  }
  console.log(labelValue('  Port:', String(info.port ?? 3456)));
  console.log(labelValue('  CORS:', 'localhost only'));
  console.log('');
  
  if (!info.authTokenConfigured) {
    console.log(warningBlock([
      'No authentication configured!',
      'Anyone with localhost access can control your browser.',
      '',
      'To add authentication, reinstall with:',
      `  ${code('$ claude-chrome-mcp --install')}`,
      '',
      'Or to explicitly allow insecure mode:',
      `  ${code('$ claude-chrome-mcp --install --insecure')}`,
    ]));
  }
  
  // Display token and config if available
  if (info.authToken) {
    console.log('='.repeat(70));
    console.log('Your Authentication Token:');
    console.log('='.repeat(70));
    console.log('');
    console.log(info.authToken);
    console.log('');
    console.log('='.repeat(70));
    console.log('');
    
    const port = info.port ?? 3456;
    const mcpUrl = `http://localhost:${port}/mcp`;
    
    console.log(section('MCP Client Configuration:'));
    console.log(dim('OpenCode (~/.config/opencode/opencode.json):'));
    const opencodeConfig = {
      mcp: {
        chrome: {
          type: 'remote',
          url: mcpUrl,
          enabled: true,
          headers: {
            Authorization: `Bearer ${info.authToken}`,
          },
        },
      },
    };
    console.log(highlightJSON(opencodeConfig));
    console.log('');
    
    console.log(dim('Claude Desktop / Generic MCP Client:'));
    const genericConfig = {
      mcpServers: {
        chrome: {
          transport: {
            type: 'http',
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${info.authToken}`,
            },
          },
        },
      },
    };
    console.log(highlightJSON(genericConfig));
    console.log('');
  }
  
  console.log(section('Next Steps:'));
  console.log('  - Restart Chrome/Chromium if you just installed');
  console.log(`  - Configure MCP client: ${url(`http://localhost:${info.port ?? 3456}/mcp`)}`);
  console.log(`  - Run ${code('claude-chrome-mcp --help')} for more info`);
  console.log('');
}

async function runServer(options: CliOptions): Promise<void> {
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

  const server = new McpHttpServer({
    port,
    authToken,
    corsOrigins,
  });

  // Log security configuration to stderr
  if (authToken) {
    console.error('[CLI] Bearer token authentication enabled');
  } else {
    console.error('[CLI] Warning: No authentication configured. Use --auth-token for security.');
  }

  if (corsOrigins && corsOrigins.length > 0) {
    console.error(`[CLI] CORS origins: ${corsOrigins.join(', ')}`);
  } else {
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
      port: options.port,
      authToken: options.authToken,
      corsOrigins: options.corsOrigins,
      insecure: options.insecure,
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
