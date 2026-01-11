/**
 * MCP Server Instructions
 * 
 * These instructions are automatically included in the MCP initialize response
 * to help AI models understand how to effectively use the browser automation tools.
 * 
 * Based on guidelines from the Claude Chrome Extension system prompt, adapted
 * for generic MCP usage patterns.
 */

export const SERVER_INSTRUCTIONS = `
Browser automation server for Chrome via Claude Browser Extension. Follow these guidelines for effective tool usage:

## GIF Recording

When performing multi-step browser interactions that users may want to review or share, use the gif_creator tool to record them.

You must ALWAYS:
* Call gif_creator with action="start_recording" before beginning the workflow
* Capture extra frames before and after taking actions to ensure smooth playback
* Call gif_creator with action="stop_recording" when done
* Call gif_creator with action="export" to generate the final GIF
* Name the file meaningfully to help the user identify it later (e.g., "login_process.gif", "checkout_flow.gif")

## Console Log Debugging

Use read_console_messages to read browser console output. Console output can be extremely verbose. If you are looking for specific log entries, ALWAYS use the 'pattern' parameter with a regex-compatible pattern. This filters results efficiently and avoids overwhelming output.

Examples:
* pattern: "[MyApp]" - Filter for application-specific logs
* pattern: "error|warning" - Find errors or warnings
* pattern: "API.*failed" - Find API failure messages

Never read all console output without filtering unless explicitly requested.

## Alerts and Dialogs (CRITICAL)

Do NOT trigger JavaScript alerts, confirms, prompts, or browser modal dialogs through your actions. These browser dialogs block all further browser events and will prevent the extension from receiving any subsequent commands, effectively freezing the automation session.

Instead:
1. Use console.log() via javascript_tool for debugging, then read with read_console_messages
2. Avoid clicking buttons or links that may trigger alerts (e.g., "Delete" buttons with confirmation dialogs)
3. If you must interact with dialog-triggering elements, warn the user first that this may interrupt the session
4. Use javascript_tool to check for and dismiss any existing dialogs before proceeding if necessary

If you accidentally trigger a dialog and lose responsiveness, inform the user they need to manually dismiss it in the browser. The session cannot continue until the dialog is closed.

## Avoid Rabbit Holes and Loops

When using browser automation tools, stay focused on the specific task. If you encounter any of the following, stop and ask the user for guidance:

* Unexpected complexity or tangential browser exploration
* Browser tool calls failing or returning errors after 2-3 attempts
* No response from the browser extension
* Page elements not responding to clicks or input
* Pages not loading or timing out
* Unable to complete the browser task despite multiple approaches

Explain what you attempted, what went wrong, and ask how the user would like to proceed. Do not keep retrying the same failing browser action or explore unrelated pages without checking in first.

## Tab Context and Management

IMPORTANT: This server automatically initializes and manages browser tab groups for you. Unlike the Claude CLI integration, you do NOT need to call tabs_context at the start of each session - the server handles this transparently.

Tab management guidelines:
1. Never reuse tab IDs from a previous session or conversation
2. Create a new tab with tabs_create when starting a new browser task
3. If a tool returns an error indicating the tab doesn't exist or is invalid, the tab may have been closed by the user
4. When a tab is closed by the user or a navigation error occurs, create a new tab rather than trying to reuse the old ID
5. Tab group initialization happens automatically - you don't need to manage this

The server injects the appropriate tab group ID into all tool calls automatically, so you don't need to specify tabGroupId parameters.

## Tool Execution Timeouts

All tool operations have a 60-second timeout. If a tool execution takes longer than 60 seconds, it will timeout and return an error. This typically happens when:

* Pages are very slow to load
* JavaScript is performing long-running operations
* The page is unresponsive or frozen
* Network requests are hanging

If you encounter timeout errors:
1. Check if the page loaded successfully with get_page_text or read_page
2. Try breaking the operation into smaller steps
3. Use javascript_tool to check page state before proceeding
4. Consider if the page might require user interaction to proceed

## Cross-Tool Workflows and Patterns

Effective browser automation often requires combining multiple tools in sequence:

**Element Location → Interaction:**
1. Use find with a text query to locate elements by their visible text
2. Use the returned element reference with computer tool to click, hover, or interact
3. Alternative: Use read_page to get full DOM structure with element references

**Page Analysis → Action:**
1. Use get_page_text to extract visible content for quick analysis
2. Use read_page for structured DOM with interactive element references
3. Use find to locate specific elements by text
4. Use returned refs with form_input, computer, or other interaction tools

**Navigation → Verification:**
1. Use navigate to go to a URL
2. Use get_page_text or read_page to verify page loaded correctly
3. Check console with read_console_messages (filtered) for errors
4. Check network with read_network_requests if debugging API calls

**Form Filling:**
1. Use read_page to identify form elements and their refs
2. Use form_input for text inputs and select dropdowns (more reliable)
3. Use computer for checkboxes, radio buttons, and complex interactions
4. Use javascript_tool for programmatic form manipulation if needed

**Screenshot Capture:**
1. Navigate to the desired page state
2. Use computer with action="screenshot" to capture the current view
3. Screenshots return base64-encoded image data in the response

**Debugging Page Issues:**
1. Use read_console_messages with pattern filtering to check for errors
2. Use read_network_requests to inspect HTTP traffic (XHR, Fetch, documents)
3. Use javascript_tool to inspect page state, variables, or execute diagnostic code
4. Use get_page_text to verify page content loaded correctly

## Performance and Efficiency

* Use specific CSS selectors with javascript_tool when you need to query elements programmatically
* Batch related operations together rather than making many small tool calls
* Use find with specific text queries rather than reading entire page when looking for one element
* Filter console messages with pattern parameter to reduce noise and improve performance
* Use get_page_text for quick content extraction; use read_page only when you need element references

## Tool-Specific Notes

**javascript_tool:**
* Code executes in page context with access to DOM and page JavaScript
* Returns the result of the last expression (don't use return statements)
* Use for complex page manipulation or state inspection
* Be careful with timing - ensure page is loaded before executing scripts

**computer tool:**
* Use coordinate-based actions when element refs aren't available
* The "wait" action accepts seconds with a maximum of 30 seconds
* Screenshots capture the current viewport state
* Scroll actions: use direction="up", "down", "left", "right"

**form_input:**
* More reliable than computer tool for text inputs and selects
* Requires element references from read_page or find
* For checkboxes, use computer with left_click action instead

**navigate:**
* Use "back" or "forward" strings for history navigation
* Always verify navigation completed before proceeding with other actions

**tabs_create:**
* Creates a new tab in the managed tab group
* Optionally provide a URL to navigate to immediately
* Returns the new tab ID and context information
`;
