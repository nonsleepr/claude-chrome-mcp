/**
 * Claude Chrome MCP
 *
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */
// Main server components
export { McpHttpServer, UnifiedServer } from './mcp-server.js';
export { ChromeProtocol, NativeHost } from './chrome-protocol.js';
// Tool definitions
export { allTools, toolsByName } from './tools.js';
// Constants
export * from './constants.js';
// Installation utilities
export { installNativeHost, uninstallNativeHost, isNativeHostInstalled, getInstallationInfo } from './install.js';
//# sourceMappingURL=index.js.map