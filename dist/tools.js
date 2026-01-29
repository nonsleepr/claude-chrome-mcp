/**
 * Tool Definitions for Claude Browser Extension MCP
 *
 * These definitions provide MCP-compatible schemas for browser automation tools.
 * Tool schemas match Claude CLI native browser tools exactly.
 */
import { z } from 'zod';
// ============================================================================
// Content Tools
// ============================================================================
export const readPageTool = {
    name: 'read_page',
    description: 'Get an accessibility tree representation of elements on the page. By default returns all elements including non-visible ones. Output is limited to 50000 characters. If the output exceeds this limit, you will receive an error asking you to specify a smaller depth or focus on a specific element using ref_id. Optionally filter for only interactive elements. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        depth: z.number().optional()
            .describe('Maximum depth of the tree to traverse (default: 15). Use a smaller depth if output is too large.'),
        tabId: z.number()
            .describe('Tab ID to read from. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        filter: z.enum(['interactive', 'all']).optional()
            .describe('Filter elements: "interactive" for buttons/links/inputs only, "all" for all elements including non-visible ones (default: all elements)'),
        ref_id: z.string().optional()
            .describe('Reference ID of a parent element to read. Will return the specified element and all its children. Use this to focus on a specific part of the page when output is too large.'),
    }),
};
export const findTool = {
    name: 'find',
    description: 'Find elements on the page using natural language. Can search for elements by their purpose (e.g., "search bar", "login button") or by text content (e.g., "organic mango product"). Returns up to 20 matching elements with references that can be used with other tools. If more than 20 matches exist, you\'ll be notified to use a more specific query. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        query: z.string()
            .describe('Natural language description of what to find (e.g., "search bar", "add to cart button", "product title containing organic")'),
        tabId: z.number()
            .describe('Tab ID to search in. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
    }),
};
export const formInputTool = {
    name: 'form_input',
    description: 'Set values in form elements using element reference ID from the read_page tool. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        ref: z.string()
            .describe('Element reference ID from the read_page tool (e.g., "ref_1", "ref_2")'),
        tabId: z.number()
            .describe('Tab ID to set form value in. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        value: z.union([z.string(), z.boolean(), z.number()])
            .describe('The value to set. For checkboxes use boolean, for selects use option value or text, for other inputs use appropriate string/number'),
    }),
};
export const computerTool = {
    name: 'computer',
    description: `Use a mouse and keyboard to interact with a web browser, and take screenshots. If you don't have a valid tab ID, use tabs_context first to get available tabs.
* Whenever you intend to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor.
* If you tried clicking on a program or link but it failed to load, even after waiting, try adjusting your click location so that the tip of the cursor visually falls on the element that you want to click.
* Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.`,
    inputSchema: z.object({
        ref: z.string().optional()
            .describe('Element reference ID from read_page or find tools (e.g., "ref_1", "ref_2"). Required for `scroll_to` action. Can be used as alternative to `coordinate` for click actions.'),
        text: z.string().optional()
            .describe('The text to type (for `type` action) or the key(s) to press (for `key` action). For `key` action: Provide space-separated keys (e.g., "Backspace Backspace Delete"). Supports keyboard shortcuts using the platform\'s modifier key (use "cmd" on Mac, "ctrl" on Windows/Linux, e.g., "cmd+a" or "ctrl+a" for select all).'),
        tabId: z.number()
            .describe('Tab ID to execute the action on. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        action: z.enum([
            'left_click',
            'right_click',
            'type',
            'screenshot',
            'wait',
            'scroll',
            'key',
            'left_click_drag',
            'double_click',
            'triple_click',
            'zoom',
            'scroll_to',
            'hover',
        ]).describe(`The action to perform:
* \`left_click\`: Click the left mouse button at the specified coordinates.
* \`right_click\`: Click the right mouse button at the specified coordinates to open context menus.
* \`double_click\`: Double-click the left mouse button at the specified coordinates.
* \`triple_click\`: Triple-click the left mouse button at the specified coordinates.
* \`type\`: Type a string of text.
* \`screenshot\`: Take a screenshot of the screen.
* \`wait\`: Wait for a specified number of seconds.
* \`scroll\`: Scroll up, down, left, or right at the specified coordinates.
* \`key\`: Press a specific keyboard key.
* \`left_click_drag\`: Drag from start_coordinate to coordinate.
* \`zoom\`: Take a screenshot of a specific region for closer inspection.
* \`scroll_to\`: Scroll an element into view using its element reference ID from read_page or find tools.
* \`hover\`: Move the mouse cursor to the specified coordinates or element without clicking. Useful for revealing tooltips, dropdown menus, or triggering hover states.`),
        region: z.array(z.number()).length(4).optional()
            .describe('(x0, y0, x1, y1): The rectangular region to capture for `zoom`. Coordinates define a rectangle from top-left (x0, y0) to bottom-right (x1, y1) in pixels from the viewport origin. Required for `zoom` action. Useful for inspecting small UI elements like icons, buttons, or text.'),
        repeat: z.number().min(1).max(100).optional()
            .describe('Number of times to repeat the key sequence. Only applicable for `key` action. Must be a positive integer between 1 and 100. Default is 1. Useful for navigation tasks like pressing arrow keys multiple times.'),
        duration: z.number().min(0).max(30).optional()
            .describe('The number of seconds to wait. Required for `wait`. Maximum 30 seconds.'),
        modifiers: z.string().optional()
            .describe('Modifier keys for click actions. Supports: "ctrl", "shift", "alt", "cmd" (or "meta"), "win" (or "windows"). Can be combined with "+" (e.g., "ctrl+shift", "cmd+alt"). Optional.'),
        coordinate: z.array(z.number()).length(2).optional()
            .describe('(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates. Required for `left_click`, `right_click`, `double_click`, `triple_click`, and `scroll`. For `left_click_drag`, this is the end position.'),
        scroll_amount: z.number().min(1).max(10).optional()
            .describe('The number of scroll wheel ticks. Optional for `scroll`, defaults to 3.'),
        scroll_direction: z.enum(['up', 'down', 'left', 'right']).optional()
            .describe('The direction to scroll. Required for `scroll`.'),
        start_coordinate: z.array(z.number()).length(2).optional()
            .describe('(x, y): The starting coordinates for `left_click_drag`.'),
    }),
};
export const navigateTool = {
    name: 'navigate',
    description: 'Navigate to a URL, or go forward/back in browser history. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        url: z.string()
            .describe('The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "forward" to go forward in history or "back" to go back in history.'),
        tabId: z.number()
            .describe('Tab ID to navigate. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
    }),
};
export const getPageTextTool = {
    name: 'get_page_text',
    description: 'Extract raw text content from the page, prioritizing article content. Ideal for reading articles, blog posts, or other text-heavy pages. Returns plain text without HTML formatting. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        tabId: z.number()
            .describe('Tab ID to extract text from. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
    }),
};
// ============================================================================
// Tab Management Tools
// ============================================================================
export const tabsCreateTool = {
    name: 'tabs_create',
    description: 'Creates a new tab in the MCP tab group. Optionally navigates to a URL immediately after creation.',
    inputSchema: z.object({
        url: z.string().optional()
            .describe('Optional URL to navigate to after creating the tab. Can be provided with or without protocol (defaults to https://). If not provided, creates an empty tab.'),
    }),
};
export const tabsContextTool = {
    name: 'tabs_context',
    description: 'Get context information about all tabs in the MCP tab group. Automatically creates the group with an empty tab if it doesn\'t exist. Returns available tab IDs that can be used with other browser tools.',
    inputSchema: z.object({}),
};
export const uploadImageTool = {
    name: 'upload_image',
    description: 'Upload a previously captured screenshot or user-uploaded image to a file input or drag & drop target. Supports two approaches: (1) ref - for targeting specific elements, especially hidden file inputs, (2) coordinate - for drag & drop to visible locations like Google Docs. Provide either ref or coordinate, not both.',
    inputSchema: z.object({
        ref: z.string().optional()
            .describe('Element reference ID from read_page or find tools (e.g., "ref_1", "ref_2"). Use this for file inputs (especially hidden ones) or specific elements. Provide either ref or coordinate, not both.'),
        tabId: z.number()
            .describe('Tab ID where the target element is located. This is where the image will be uploaded to.'),
        imageId: z.string()
            .describe('ID of a previously captured screenshot (from the computer tool\'s screenshot action) or a user-uploaded image'),
        filename: z.string().optional()
            .describe('Optional filename for the uploaded file (default: "image.png")'),
        coordinate: z.array(z.number()).optional()
            .describe('Viewport coordinates [x, y] for drag & drop to a visible location. Use this for drag & drop targets like Google Docs. Provide either ref or coordinate, not both.'),
    }),
};
export const readConsoleMessagesTool = {
    name: 'read_console_messages',
    description: 'Read browser console messages (console.log, console.error, console.warn, etc.) from a specific tab. Useful for debugging JavaScript errors, viewing application logs, or understanding what\'s happening in the browser console. Returns console messages from the current domain only. If you don\'t have a valid tab ID, use tabs_context first to get available tabs. IMPORTANT: Always provide a pattern to filter messages - without a pattern, you may get too many irrelevant messages.',
    inputSchema: z.object({
        clear: z.boolean().optional()
            .describe('If true, clear the console messages after reading to avoid duplicates on subsequent calls. Default is false.'),
        limit: z.number().optional()
            .describe('Maximum number of messages to return. Defaults to 100. Increase only if you need more results.'),
        tabId: z.number()
            .describe('Tab ID to read console messages from. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        pattern: z.string().optional()
            .describe('Regex pattern to filter console messages. Only messages matching this pattern will be returned (e.g., \'error|warning\' to find errors and warnings, \'MyApp\' to filter app-specific logs). You should always provide a pattern to avoid getting too many irrelevant messages.'),
        onlyErrors: z.boolean().optional()
            .describe('If true, only return error and exception messages. Default is false (return all message types).'),
    }),
};
export const readNetworkRequestsTool = {
    name: 'read_network_requests',
    description: 'Read HTTP network requests (XHR, Fetch, documents, images, etc.) from a specific tab. Useful for debugging API calls, monitoring network activity, or understanding what requests a page is making. Returns all network requests made by the current page, including cross-origin requests. Requests are automatically cleared when the page navigates to a different domain. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        clear: z.boolean().optional()
            .describe('If true, clear the network requests after reading to avoid duplicates on subsequent calls. Default is false.'),
        limit: z.number().optional()
            .describe('Maximum number of requests to return. Defaults to 100. Increase only if you need more results.'),
        tabId: z.number()
            .describe('Tab ID to read network requests from. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        urlPattern: z.string().optional()
            .describe('Optional URL pattern to filter requests. Only requests whose URL contains this string will be returned (e.g., \'/api/\' to filter API calls, \'example.com\' to filter by domain).'),
    }),
};
export const resizeWindowTool = {
    name: 'resize_window',
    description: 'Resize the current browser window to specified dimensions. Useful for testing responsive designs or setting up specific screen sizes. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        tabId: z.number()
            .describe('Tab ID to get the window for. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        width: z.number()
            .describe('Target window width in pixels'),
        height: z.number()
            .describe('Target window height in pixels'),
    }),
};
export const gifCreatorTool = {
    name: 'gif_creator',
    description: 'Manage GIF recording and export for browser automation sessions. Control when to start/stop recording browser actions (clicks, scrolls, navigation), then export as an animated GIF with visual overlays (click indicators, action labels, progress bar, watermark). All operations are scoped to the tab\'s group. When starting recording, take a screenshot immediately after to capture the initial state as the first frame. When stopping recording, take a screenshot immediately before to capture the final state as the last frame. For export, either provide \'coordinate\' to drag/drop upload to a page element, or set \'download: true\' to download the GIF.',
    inputSchema: z.object({
        tabId: z.number()
            .describe('Tab ID to identify which tab group this operation applies to'),
        action: z.enum(['start_recording', 'stop_recording', 'export', 'clear'])
            .describe('Action to perform: \'start_recording\' (begin capturing), \'stop_recording\' (stop capturing but keep frames), \'export\' (generate and export GIF), \'clear\' (discard frames)'),
        options: z.object({
            quality: z.number().optional()
                .describe('GIF compression quality, 1-30 (lower = better quality, slower encoding). Default: 10'),
            showDragPaths: z.boolean().optional()
                .describe('Show red arrows for drag actions (default: true)'),
            showWatermark: z.boolean().optional()
                .describe('Show Claude logo watermark (default: true)'),
            showProgressBar: z.boolean().optional()
                .describe('Show orange progress bar at bottom (default: true)'),
            showActionLabels: z.boolean().optional()
                .describe('Show black labels describing actions (default: true)'),
            showClickIndicators: z.boolean().optional()
                .describe('Show orange circles at click locations (default: true)'),
        }).optional()
            .describe('Optional GIF enhancement options for \'export\' action. Properties: showClickIndicators (bool), showDragPaths (bool), showActionLabels (bool), showProgressBar (bool), showWatermark (bool), quality (number 1-30). All default to true except quality (default: 10).'),
        download: z.boolean().optional()
            .describe('If true, download the GIF instead of drag/drop upload. For \'export\' action only.'),
        filename: z.string().optional()
            .describe('Optional filename for exported GIF (default: \'recording-[timestamp].gif\'). For \'export\' action only.'),
        coordinate: z.array(z.number()).optional()
            .describe('Viewport coordinates [x, y] for drag & drop upload. Required for \'export\' action unless \'download\' is true.'),
    }),
};
export const javascriptTool = {
    name: 'javascript_tool',
    description: 'Execute JavaScript code in the context of the current page. The code runs in the page\'s context and can interact with the DOM, window object, and page variables. Returns the result of the last expression or any thrown errors. If you don\'t have a valid tab ID, use tabs_context first to get available tabs.',
    inputSchema: z.object({
        text: z.string()
            .describe('The JavaScript code to execute. The code will be evaluated in the page context. The result of the last expression will be returned automatically. Do NOT use \'return\' statements - just write the expression you want to evaluate (e.g., \'window.myData.value\' not \'return window.myData.value\'). You can access and modify the DOM, call page functions, and interact with page variables.'),
        tabId: z.number()
            .describe('Tab ID to execute the code in. Must be a tab in the current group. Use tabs_context first if you don\'t have a valid tab ID.'),
        action: z.literal('javascript_exec')
            .describe('Must be set to \'javascript_exec\''),
    }),
};
// ============================================================================
// All Tools Export (MCP-compatible tools only)
// ============================================================================
export const allTools = [
    // Content
    readPageTool,
    findTool,
    formInputTool,
    computerTool,
    navigateTool,
    getPageTextTool,
    // Tab Management
    tabsCreateTool,
    tabsContextTool,
    uploadImageTool,
    readConsoleMessagesTool,
    readNetworkRequestsTool,
    resizeWindowTool,
    gifCreatorTool,
    // Code Execution
    javascriptTool,
];
export const toolsByName = new Map(allTools.map(t => [t.name, t]));
//# sourceMappingURL=tools.js.map