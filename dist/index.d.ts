/**
 * Claude Chrome MCP
 *
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */
export { UnifiedServer, UnifiedServerOptions } from './unified-server.js';
export { NativeHost, ToolResponse, TabContext, ChromeMessage } from './native-host.js';
export { allTools, toolsByName, ToolDefinition } from './tools.js';
export { installNativeHost, uninstallNativeHost, isNativeHostInstalled, getInstallationInfo, InstallOptions } from './install.js';
//# sourceMappingURL=index.d.ts.map