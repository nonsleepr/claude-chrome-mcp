#!/usr/bin/env node
/**
 * CLI Entry Point for Claude Chrome MCP Server
 * 
 * Supports both stdio and HTTP transports for maximum compatibility.
 * 
 * Usage:
 *   claude-chrome-mcp              # Start with stdio transport
 *   claude-chrome-mcp --http       # Start with HTTP transport
 *   claude-chrome-mcp --http 3456  # Start HTTP on specific port
 *   claude-chrome-mcp --spawn      # Spawn native host if not running
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ChromeMcpServer } from './server.js';
import { startHttpServer } from './http-server.js';

interface CliOptions {
  transport: 'stdio' | 'http';
  port: number;
  spawnNativeHost: boolean;
  socketPath?: string;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    transport: 'stdio',
    port: 3456,
    spawnNativeHost: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--http') {
      options.transport = 'http';
      // Check if next arg is a port number
      const nextArg = args[i + 1];
      if (nextArg && /^\d+$/.test(nextArg)) {
        options.port = parseInt(nextArg, 10);
        i++;
      }
    } else if (arg === '--spawn' || arg === '-s') {
      options.spawnNativeHost = true;
    } else if (arg === '--socket' && args[i + 1]) {
      options.socketPath = args[i + 1];
      i++;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Claude Chrome MCP Server

An MCP server that exposes Claude Browser Extension's browser automation tools.

Usage:
  claude-chrome-mcp [options]

Options:
  --help, -h         Show this help message
  --http [port]      Use HTTP/SSE transport instead of stdio (default port: 3456)
  --spawn, -s        Spawn native host process if not already running
  --socket <path>    Path to native host socket (default: auto-detected)

Examples:
  # Start with stdio transport (for MCP clients that spawn servers)
  claude-chrome-mcp

  # Start with HTTP transport on default port
  claude-chrome-mcp --http

  # Start with HTTP transport on custom port
  claude-chrome-mcp --http 8080

  # Start with stdio and spawn native host
  claude-chrome-mcp --spawn

MCP Client Configuration:

  For stdio transport (claude_desktop_config.json):
  {
    "mcpServers": {
      "claude-chrome": {
        "command": "claude-chrome-mcp",
        "args": ["--spawn"]
      }
    }
  }

  For HTTP transport:
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

Prerequisites:
  1. Claude Browser Extension installed in Chrome
  2. Claude Code CLI installed (for native host)
  3. Chrome running with the extension active

For more information: https://github.com/anthropics/claude-browser-extension
`);
}

async function runStdioServer(options: CliOptions): Promise<void> {
  console.error('[CLI] Starting MCP server with stdio transport...');

  const server = new ChromeMcpServer({
    socketPath: options.socketPath,
    spawnNativeHost: options.spawnNativeHost,
  });

  try {
    // Connect to native host
    await server.connect();

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect MCP server to transport
    await server.getMcpServer().connect(transport);

    console.error('[CLI] MCP server running on stdio');

    // Handle shutdown
    process.on('SIGINT', () => {
      console.error('[CLI] Received SIGINT, shutting down...');
      server.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('[CLI] Received SIGTERM, shutting down...');
      server.disconnect();
      process.exit(0);
    });
  } catch (error) {
    console.error('[CLI] Failed to start server:', error);
    process.exit(1);
  }
}

async function runHttpServer(options: CliOptions): Promise<void> {
  console.error(`[CLI] Starting MCP server with HTTP transport on port ${options.port}...`);

  try {
    await startHttpServer({
      port: options.port,
      socketPath: options.socketPath,
      spawnNativeHost: options.spawnNativeHost,
    });
  } catch (error) {
    console.error('[CLI] Failed to start HTTP server:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.transport === 'http') {
    await runHttpServer(options);
  } else {
    await runStdioServer(options);
  }
}

main().catch((error) => {
  console.error('[CLI] Fatal error:', error);
  process.exit(1);
});
