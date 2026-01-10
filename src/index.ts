/**
 * Claude Chrome MCP
 * 
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */

// Main server components
export { UnifiedServer, UnifiedServerOptions } from './unified-server.js';
export { NativeHost, ToolResponse, TabContext, ChromeMessage } from './native-host.js';

// Tool definitions
export { allTools, toolsByName, ToolDefinition } from './tools.js';

// Installation utilities
export { 
  installNativeHost, 
  uninstallNativeHost, 
  isNativeHostInstalled,
  getInstallationInfo,
  InstallOptions 
} from './install.js';
