/**
 * Unified Server - Native Host + MCP HTTP Server
 *
 * Single process that:
 * 1. Acts as Chrome's native messaging host (stdin/stdout)
 * 2. Exposes MCP tools via HTTP (/mcp endpoint)
 * 3. Routes tool requests between MCP clients and Chrome extension
 *
 * The Chrome extension executes all browser tools via CDP (Chrome DevTools Protocol).
 * This server is just a message router/proxy.
 */
export interface UnifiedServerOptions {
    port?: number;
    host?: string;
    authToken?: string;
    corsOrigins?: string[];
}
export declare class UnifiedServer {
    private nativeHost;
    private app;
    private httpServer;
    private mcpServer;
    private sessions;
    private pendingToolRequests;
    private requestId;
    private actualPort;
    private options;
    private mcpTabGroupId;
    private initializingGroup;
    constructor(options?: UnifiedServerOptions);
    /**
     * Start the unified server
     */
    start(): Promise<void>;
    /**
     * Stop the server
     */
    stop(): void;
    /**
     * Get the actual port the server is listening on
     */
    getPort(): number;
    /**
     * Find an available port, starting with preferred port
     */
    private findAvailablePort;
    /**
     * Set up handlers for messages from Chrome extension
     */
    private setupNativeHostHandlers;
    /**
     * Set up the Express HTTP server with /mcp endpoint
     */
    private setupHttpServer;
    /**
     * Handle MCP protocol requests
     */
    private handleMcpRequest;
    /**
     * Start the HTTP server
     */
    private startHttpServer;
    /**
     * Register all browser automation tools with the MCP server
     */
    private registerTools;
    /**
     * Register a single tool with the MCP server
     */
    private registerTool;
    /**
     * Extract the shape from a Zod object schema for MCP SDK compatibility
     */
    private extractZodShape;
    /**
     * Initialize the MCP tab group by calling tabs_context with createIfEmpty: true
     * This is called automatically before the first tool execution that needs it.
     */
    private initializeMcpGroup;
    /**
     * Translate MCP tool names to Chrome extension tool names
     */
    private translateToolName;
    /**
     * Execute a tool with a callback to receive the raw result
     */
    private executeToolDirectWithCallback;
    /**
     * Execute a tool directly without auto-initialization (used internally)
     */
    private executeToolDirect;
    /**
     * Execute a tool by sending request to Chrome and waiting for response
     */
    private executeTool;
    /**
     * Handle tabs_create when URL is provided
     * Creates the tab and immediately navigates to the URL
     */
    private handleTabsCreateWithUrl;
    /**
     * Transform tool arguments to match Chrome extension expectations
     */
    private transformArgs;
    /**
     * Format tool response from Chrome into MCP content format
     */
    private formatToolResponse;
    /**
     * Cleanup a specific session
     */
    private cleanupSession;
    /**
     * Cleanup all sessions
     */
    private cleanupAllSessions;
}
//# sourceMappingURL=unified-server.d.ts.map