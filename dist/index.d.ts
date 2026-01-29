/**
 * Claude Chrome MCP
 *
 * A unified native host and MCP HTTP server that exposes Claude Browser Extension's
 * browser automation tools via the Model Context Protocol.
 */
export { McpHttpServer, McpServerOptions, UnifiedServer, UnifiedServerOptions } from './mcp-server.js';
export { ChromeProtocol, NativeHost, ToolResponse, TabContext, ChromeMessage } from './chrome-protocol.js';
export { allTools, toolsByName, ToolDefinition } from './tools.js';
export * from './constants.js';
export { installNativeHost, uninstallNativeHost, isNativeHostInstalled, getInstallationInfo, InstallOptions } from './install.js';
//# sourceMappingURL=index.d.ts.map