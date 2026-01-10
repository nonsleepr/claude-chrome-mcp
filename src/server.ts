/**
 * MCP Server for Claude Browser Extension
 * 
 * Implements the Model Context Protocol server that translates MCP tool calls
 * to native host protocol and exposes browser automation capabilities.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NativeHostClient, ToolResponse } from './native-client.js';
import { allTools } from './tools.js';

// MCP content types
type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: string };
type McpContent = TextContent | ImageContent;
type ToolResult = { content: McpContent[] };

export interface ServerOptions {
  socketPath?: string;
  requestTimeout?: number;
  spawnNativeHost?: boolean;
}

export class ChromeMcpServer {
  private server: McpServer;
  private nativeClient: NativeHostClient;
  private options: ServerOptions;

  constructor(options: ServerOptions = {}) {
    this.options = options;
    
    this.server = new McpServer({
      name: 'claude-chrome-mcp',
      version: '1.0.0',
    });

    this.nativeClient = new NativeHostClient({
      socketPath: options.socketPath,
      requestTimeout: options.requestTimeout,
    });

    this.registerTools();
  }

  /**
   * Register all browser automation tools with the MCP server
   */
  private registerTools(): void {
    for (const tool of allTools) {
      this.registerTool(tool.name, tool.description, tool.inputSchema);
    }
  }

  /**
   * Register a single tool with the MCP server
   */
  private registerTool(
    name: string,
    description: string,
    inputSchema: z.ZodType<unknown>
  ): void {
    // Convert Zod schema to a plain object schema for MCP
    // The MCP SDK expects a record of zod schemas for each parameter
    const zodShape = this.extractZodShape(inputSchema);
    const toolName = name; // Capture for closure

    this.server.tool(
      name,
      description,
      zodShape,
      async (args) => {
        return this.executeTool(toolName, args as Record<string, unknown>);
      }
    );
  }

  /**
   * Extract the shape from a Zod object schema for MCP SDK compatibility
   */
  private extractZodShape(schema: z.ZodType<unknown>): Record<string, z.ZodType<unknown>> {
    if (schema instanceof z.ZodObject) {
      return schema.shape as Record<string, z.ZodType<unknown>>;
    }
    // For non-object schemas, wrap in an object
    return {};
  }

  /**
   * Transform tool arguments to match native host expectations
   */
  private transformArgs(
    name: string,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const transformed = { ...args };

    // For computer tool's "key" action, the extension expects the key in "text" param
    if (name === 'computer' && args.action === 'key' && args.key && !args.text) {
      transformed.text = args.key;
      delete transformed.key;
    }

    return transformed;
  }

  /**
   * Execute a tool via the native host
   */
  private async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    try {
      // Ensure connected
      if (!this.nativeClient.isConnected()) {
        throw new Error('Not connected to native host. Call connect() first.');
      }

      // Transform args to match native host expectations
      const transformedArgs = this.transformArgs(name, args);

      // Execute tool via native host
      const response = await this.nativeClient.executeTool({
        tool: name,
        args: transformedArgs,
      });

      // Convert native host response to MCP format
      return this.formatResponse(response);
    } catch (error) {
      const message = error instanceof Error 
        ? error.message 
        : (typeof error === 'string' ? error : JSON.stringify(error));
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
      };
    }
  }

  /**
   * Format native host response to MCP content format
   */
  private formatResponse(response: ToolResponse): ToolResult {
    const content: McpContent[] = [];

    // Handle error response
    if (response.error) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : JSON.stringify(response.error);
      content.push({ type: 'text' as const, text: `Error: ${errorMessage}` });
      return { content };
    }

    // Handle content
    if (response.content) {
      if (typeof response.content === 'string') {
        content.push({ type: 'text' as const, text: response.content });
      } else if (Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === 'text' && item.text) {
            content.push({ type: 'text' as const, text: item.text });
          } else if (item.type === 'image' && item.data) {
            content.push({
              type: 'image' as const,
              data: item.data,
              mimeType: item.mimeType || 'image/png',
            });
          }
        }
      }
    }

    // Add tab context if available
    if (response.tabContext) {
      const ctx = response.tabContext;
      const tabInfo = `Tab: ${ctx.currentTabId} (${ctx.tabCount} tabs available)`;
      content.push({ type: 'text' as const, text: tabInfo });
    }

    // Ensure we have at least one content item
    if (content.length === 0) {
      content.push({ type: 'text' as const, text: 'Tool executed successfully.' });
    }

    return { content };
  }

  /**
   * Connect to the native host
   */
  async connect(): Promise<void> {
    if (this.options.spawnNativeHost) {
      console.error('[ChromeMcpServer] Spawning native host...');
      await this.nativeClient.spawnNativeHost();
    }

    console.error('[ChromeMcpServer] Connecting to native host...');
    await this.nativeClient.connect();
    console.error('[ChromeMcpServer] Connected to native host');
  }

  /**
   * Disconnect from the native host
   */
  disconnect(): void {
    this.nativeClient.disconnect();
  }

  /**
   * Get the underlying MCP server instance
   */
  getMcpServer(): McpServer {
    return this.server;
  }

  /**
   * Get the native client instance
   */
  getNativeClient(): NativeHostClient {
    return this.nativeClient;
  }
}
