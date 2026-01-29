/**
 * Tool Definitions for Claude Browser Extension MCP
 *
 * These definitions provide MCP-compatible schemas for browser automation tools.
 * Tool schemas match Claude CLI native browser tools exactly.
 */
import { z } from 'zod';
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodType<unknown>;
}
export declare const readPageTool: ToolDefinition;
export declare const findTool: ToolDefinition;
export declare const formInputTool: ToolDefinition;
export declare const computerTool: ToolDefinition;
export declare const navigateTool: ToolDefinition;
export declare const getPageTextTool: ToolDefinition;
export declare const tabsCreateTool: ToolDefinition;
export declare const tabsContextTool: ToolDefinition;
export declare const uploadImageTool: ToolDefinition;
export declare const readConsoleMessagesTool: ToolDefinition;
export declare const readNetworkRequestsTool: ToolDefinition;
export declare const resizeWindowTool: ToolDefinition;
export declare const gifCreatorTool: ToolDefinition;
export declare const javascriptTool: ToolDefinition;
export declare const allTools: ToolDefinition[];
export declare const toolsByName: Map<string, ToolDefinition>;
//# sourceMappingURL=tools.d.ts.map