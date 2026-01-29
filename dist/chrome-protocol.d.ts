/**
 * Chrome Native Messaging Protocol Handler
 *
 * Implements bidirectional communication with Chrome extension via stdio.
 * Wire format: [4 bytes length (LE uint32)][N bytes JSON (UTF-8)]
 *
 * Message flow:
 * - Chrome sends: ping, get_status, tool_response, mcp_connected, mcp_disconnected
 * - We send: pong, status_response, tool_request
 */
import { EventEmitter } from 'events';
export interface ToolResponseMessage {
    type: 'tool_response';
    result?: {
        content: unknown;
        tabContext?: TabContext;
    };
    error?: {
        content: string;
    };
}
export interface PingMessage {
    type: 'ping';
}
export interface PongMessage {
    type: 'pong';
    timestamp: number;
}
export interface StatusResponseMessage {
    type: 'status_response';
    native_host_version?: string;
}
export interface McpConnectedMessage {
    type: 'mcp_connected';
}
export interface McpDisconnectedMessage {
    type: 'mcp_disconnected';
}
export interface GetStatusMessage {
    type: 'get_status';
}
export type ChromeMessage = ToolResponseMessage | PingMessage | PongMessage | GetStatusMessage | StatusResponseMessage | McpConnectedMessage | McpDisconnectedMessage;
export interface TabContext {
    currentTabId: number;
    executedOnTabId?: number;
    availableTabs: Array<{
        tabId: number;
        title: string;
        url: string;
    }>;
    tabCount: number;
    tabGroupId?: number;
}
export interface ToolResponse {
    content?: unknown;
    error?: string;
    tabContext?: TabContext;
}
export interface ChromeProtocolEvents {
    'tool_response': (response: ToolResponseMessage) => void;
    'ping': (message: PingMessage) => void;
    'pong': (message: PongMessage) => void;
    'get_status': (message: GetStatusMessage) => void;
    'status_response': (message: StatusResponseMessage) => void;
    'mcp_connected': () => void;
    'mcp_disconnected': () => void;
    'close': () => void;
    'error': (error: Error) => void;
}
export type NativeHostEvents = ChromeProtocolEvents;
export declare class ChromeProtocol extends EventEmitter {
    private buffer;
    private running;
    constructor();
    /**
     * Start reading from stdin (Chrome sends messages here)
     */
    start(): void;
    /**
     * Stop the native host
     */
    stop(): void;
    /**
     * Send a message to Chrome (via stdout)
     */
    send(message: unknown): void;
    /**
     * Send a tool request to Chrome for execution
     */
    sendToolRequest(tool: string, args: Record<string, unknown>, clientId?: string): void;
    /**
     * Send ping to check if Chrome is alive
     */
    sendPing(): void;
    /**
     * Send pong in response to ping
     */
    sendPong(): void;
    /**
     * Request status from Chrome
     */
    sendGetStatus(): void;
    /**
     * Send status response
     */
    sendStatusResponse(version: string): void;
    /**
     * Notify Chrome that an MCP client connected
     */
    sendMcpConnected(): void;
    /**
     * Notify Chrome that an MCP client disconnected
     */
    sendMcpDisconnected(): void;
    /**
     * Read available data from stdin
     */
    private readFromStdin;
    /**
     * Process buffered data and extract complete messages
     */
    private processBuffer;
    /**
     * Handle a parsed message from Chrome
     */
    private handleMessage;
}
export { ChromeProtocol as NativeHost };
//# sourceMappingURL=chrome-protocol.d.ts.map