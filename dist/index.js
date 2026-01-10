/**
 * Claude Chrome MCP
 *
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */
// Main server components
export { UnifiedServer } from './unified-server.js';
export { NativeHost } from './native-host.js';
// Tool definitions
export { allTools, toolsByName } from './tools.js';
// Installation utilities
export { installNativeHost, uninstallNativeHost, isNativeHostInstalled, getInstallationInfo } from './install.js';
//# sourceMappingURL=index.js.map