/**
 * Tool Definitions for Claude Browser Extension
 * 
 * These definitions are derived from the extension's mcpPermissions module
 * and provide MCP-compatible schemas for all 20 browser automation tools.
 * 
 * Note: Claude Code only exposes 17 of these via MCP (excludes tabs_context,
 * tabs_create, and turn_answer_start), but the extension can execute all 20.
 */

import { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
}

// ============================================================================
// Navigation Tools
// ============================================================================

export const navigateTool: ToolDefinition = {
  name: 'navigate',
  description: 'Navigate to a URL in the browser. Use "back" or "forward" to navigate history.',
  inputSchema: z.object({
    url: z.string().describe('The URL to navigate to, or "back"/"forward" for history navigation'),
  }),
};

// ============================================================================
// Interaction Tools
// ============================================================================

export const computerTool: ToolDefinition = {
  name: 'computer',
  description: `Perform browser interactions like clicking, typing, scrolling, and taking screenshots.

Actions:
- left_click, right_click, double_click, triple_click: Click at coordinates or element reference
- type: Type text (use with coordinate or after clicking an input)
- scroll: Scroll the page (direction: up, down, left, right)
- scroll_to: Scroll to specific coordinates
- key: Press a key or key combination (e.g., "Enter", "Ctrl+a")
- hover: Hover over an element
- screenshot: Take a screenshot of the current page
- wait: Wait for a specified duration
- left_click_drag: Drag from one point to another
- zoom: Zoom in or out (direction: in, out, reset)`,
  inputSchema: z.object({
    action: z.enum([
      'left_click',
      'right_click',
      'double_click',
      'triple_click',
      'type',
      'scroll',
      'scroll_to',
      'key',
      'hover',
      'screenshot',
      'wait',
      'left_click_drag',
      'zoom',
    ]).describe('The action to perform'),
    coordinate: z.array(z.number()).length(2).optional()
      .describe('The [x, y] coordinates for the action'),
    ref: z.string().optional()
      .describe('Element reference from read_page (e.g., "ref_1")'),
    text: z.string().optional()
      .describe('Text to type (for "type" action)'),
    direction: z.enum(['up', 'down', 'left', 'right', 'in', 'out', 'reset']).optional()
      .describe('Direction for scroll or zoom actions'),
    key: z.string().optional()
      .describe('Key or key combination to press (for "key" action)'),
    duration: z.number().optional()
      .describe('Duration in milliseconds (for "wait" action)'),
    startCoordinate: z.array(z.number()).length(2).optional()
      .describe('Start coordinates for drag action'),
    endCoordinate: z.array(z.number()).length(2).optional()
      .describe('End coordinates for drag action'),
  }),
};

export const formInputTool: ToolDefinition = {
  name: 'form_input',
  description: 'Fill form fields including text inputs, dropdowns, checkboxes, and radio buttons.',
  inputSchema: z.object({
    ref: z.string().describe('Element reference from read_page (e.g., "ref_1")'),
    value: z.string().describe('Value to set in the form field'),
    action: z.enum(['fill', 'select', 'check', 'uncheck']).optional()
      .describe('Action type: fill for text, select for dropdown, check/uncheck for checkboxes'),
  }),
};

export const findTool: ToolDefinition = {
  name: 'find',
  description: 'Search for elements on the page by text content.',
  inputSchema: z.object({
    text: z.string().describe('Text to search for on the page'),
    exact: z.boolean().optional().describe('Whether to match exactly'),
  }),
};

// ============================================================================
// Content Tools
// ============================================================================

export const readPageTool: ToolDefinition = {
  name: 'read_page',
  description: `Parse the current page DOM and return structured content with element references.
Returns interactive elements (buttons, links, inputs) with references like "ref_1", "ref_2" that can be used with other tools.`,
  inputSchema: z.object({
    selector: z.string().optional()
      .describe('CSS selector to scope the reading (optional)'),
  }),
};

export const getPageTextTool: ToolDefinition = {
  name: 'get_page_text',
  description: 'Extract all visible text content from the current page.',
  inputSchema: z.object({
    selector: z.string().optional()
      .describe('CSS selector to scope the text extraction (optional)'),
  }),
};

// ============================================================================
// Tab Management Tools
// ============================================================================

export const tabsContextTool: ToolDefinition = {
  name: 'tabs_context',
  description: 'Get information about the current tab and available tabs in the conversation tab group.',
  inputSchema: z.object({}),
};

export const tabsCreateTool: ToolDefinition = {
  name: 'tabs_create',
  description: 'Create a new tab in the conversation tab group.',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to open in the new tab (optional)'),
  }),
};

export const tabsContextMcpTool: ToolDefinition = {
  name: 'tabs_context_mcp',
  description: 'Get information about tabs in the MCP-specific tab group.',
  inputSchema: z.object({}),
};

export const tabsCreateMcpTool: ToolDefinition = {
  name: 'tabs_create_mcp',
  description: 'Create a new tab specifically in the MCP tab group.',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to open in the new tab (optional)'),
  }),
};

export const resizeWindowTool: ToolDefinition = {
  name: 'resize_window',
  description: 'Resize the browser window to specified dimensions.',
  inputSchema: z.object({
    width: z.number().describe('Window width in pixels (max 8192)'),
    height: z.number().describe('Window height in pixels (max 8192)'),
  }),
};

// ============================================================================
// Debugging Tools
// ============================================================================

export const readConsoleMessagesTool: ToolDefinition = {
  name: 'read_console_messages',
  description: 'Read browser console messages with optional filtering.',
  inputSchema: z.object({
    pattern: z.string().optional()
      .describe('Regex pattern to filter messages'),
    errorsOnly: z.boolean().optional()
      .describe('Only return error messages'),
    limit: z.number().optional()
      .describe('Maximum number of messages to return'),
  }),
};

export const readNetworkRequestsTool: ToolDefinition = {
  name: 'read_network_requests',
  description: 'Read network requests (XHR, Fetch, documents) with optional URL filtering.',
  inputSchema: z.object({
    pattern: z.string().optional()
      .describe('Regex pattern to filter by URL'),
    limit: z.number().optional()
      .describe('Maximum number of requests to return'),
  }),
};

// ============================================================================
// Media Tools
// ============================================================================

export const uploadImageTool: ToolDefinition = {
  name: 'upload_image',
  description: 'Upload an image to the page by simulating drag-and-drop.',
  inputSchema: z.object({
    ref: z.string().describe('Element reference for the drop target'),
    imageData: z.string().describe('Base64-encoded image data'),
    mimeType: z.string().optional().describe('Image MIME type (default: image/png)'),
    filename: z.string().optional().describe('Filename for the uploaded image'),
  }),
};

export const gifCreatorTool: ToolDefinition = {
  name: 'gif_creator',
  description: `Record browser actions and export as GIF.

Actions:
- start_recording: Begin capturing frames
- stop_recording: Stop capturing frames
- export: Generate GIF with optional enhancements
- clear: Discard recorded frames`,
  inputSchema: z.object({
    action: z.enum(['start_recording', 'stop_recording', 'export', 'clear'])
      .describe('GIF recording action'),
    options: z.object({
      showClicks: z.boolean().optional().describe('Show click indicators'),
      showDragPaths: z.boolean().optional().describe('Show drag path arrows'),
      showLabels: z.boolean().optional().describe('Show action labels'),
      showProgressBar: z.boolean().optional().describe('Show progress bar'),
      showWatermark: z.boolean().optional().describe('Show Claude watermark'),
      quality: z.number().optional().describe('GIF quality (1-100)'),
    }).optional().describe('Export options'),
  }),
};

// ============================================================================
// Workflow Tools
// ============================================================================

export const updatePlanTool: ToolDefinition = {
  name: 'update_plan',
  description: 'Create or update a workflow plan with structured tasks.',
  inputSchema: z.object({
    plan: z.string().describe('Plan content in markdown or structured format'),
  }),
};

export const shortcutsListTool: ToolDefinition = {
  name: 'shortcuts_list',
  description: 'List saved shortcuts/workflows.',
  inputSchema: z.object({}),
};

export const shortcutsExecuteTool: ToolDefinition = {
  name: 'shortcuts_execute',
  description: 'Execute a saved shortcut/workflow.',
  inputSchema: z.object({
    name: z.string().describe('Name of the shortcut to execute'),
    params: z.record(z.unknown()).optional().describe('Parameters to pass to the shortcut'),
  }),
};

// ============================================================================
// Code Execution Tools
// ============================================================================

export const javascriptTool: ToolDefinition = {
  name: 'javascript_tool',
  description: 'Execute JavaScript code in the context of the current page.',
  inputSchema: z.object({
    action: z.literal('javascript_exec').describe('Action type'),
    code: z.string().describe('JavaScript code to execute'),
  }),
};

// ============================================================================
// Utility Tools
// ============================================================================

export const turnAnswerStartTool: ToolDefinition = {
  name: 'turn_answer_start',
  description: 'Mark the start of a response (UI coordination).',
  inputSchema: z.object({}),
};

// ============================================================================
// All Tools Export
// ============================================================================

export const allTools: ToolDefinition[] = [
  // Navigation
  navigateTool,
  
  // Interaction
  computerTool,
  formInputTool,
  findTool,
  
  // Content
  readPageTool,
  getPageTextTool,
  
  // Tab Management
  tabsContextTool,
  tabsCreateTool,
  tabsContextMcpTool,
  tabsCreateMcpTool,
  resizeWindowTool,
  
  // Debugging
  readConsoleMessagesTool,
  readNetworkRequestsTool,
  
  // Media
  uploadImageTool,
  gifCreatorTool,
  
  // Workflow
  updatePlanTool,
  shortcutsListTool,
  shortcutsExecuteTool,
  
  // Code Execution
  javascriptTool,
  
  // Utility
  turnAnswerStartTool,
];

export const toolsByName = new Map(allTools.map(t => [t.name, t]));
