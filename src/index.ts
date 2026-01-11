/**
 * Claude Chrome MCP
 * 
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */

// Main server components
export { McpHttpServer, McpServerOptions, UnifiedServer, UnifiedServerOptions } from './mcp-server.js';
export { ChromeProtocol, NativeHost, ToolResponse, TabContext, ChromeMessage } from './chrome-protocol.js';

// Tool definitions
export { allTools, toolsByName, ToolDefinition } from './tools.js';

// Constants
export * from './constants.js';

// Installation utilities
export { 
  installNativeHost, 
  uninstallNativeHost, 
  isNativeHostInstalled,
  getInstallationInfo,
  InstallOptions 
} from './install.js';
