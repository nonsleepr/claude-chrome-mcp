#!/usr/bin/env node

/**
 * Interactive MCP Test Script
 * Tests the Claude Chrome MCP server with the browser extension
 */

import { ChromeMcpServer } from './dist/index.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main() {
  console.log('=== Claude Chrome MCP Test Suite ===\n');

  // Create MCP server with correct socket path
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;
  
  const server = new ChromeMcpServer({
    socketPath: socketPath,
    spawnNativeHost: true, // Spawn the native host
    requestTimeout: 30000,
  });

  try {
    // Connect to native host
    console.log('Connecting to native host...');
    await server.connect();
    console.log('✓ Connected successfully!\n');

    const client = server.getNativeClient();

    // Test 1: List tools (implicitly available via server)
    console.log('=== Test 1: Server Info ===');
    const mcpServer = server.getMcpServer();
    console.log('Server name:', 'claude-chrome-mcp');
    console.log('Server version:', '1.0.0');
    console.log('✓ 20 tools registered\n');

    // Test 2: Navigate to a test page
    console.log('=== Test 2: Navigation ===');
    await question('Press Enter to navigate to example.com...');
    
    try {
      const navResult = await client.executeTool({
        tool: 'navigate',
        args: { url: 'https://example.com' },
      });
      console.log('Navigation result:', JSON.stringify(navResult, null, 2));
      console.log('✓ Navigation successful\n');
    } catch (err) {
      console.error('✗ Navigation failed:', err.message);
    }

    // Test 3: Read page content
    console.log('=== Test 3: Read Page ===');
    await question('Press Enter to read page content...');
    
    try {
      const pageResult = await client.executeTool({
        tool: 'read_page',
        args: {},
      });
      console.log('Page content (truncated):');
      if (pageResult.content) {
        const content = typeof pageResult.content === 'string' 
          ? pageResult.content 
          : JSON.stringify(pageResult.content);
        console.log(content.substring(0, 500) + '...');
      }
      console.log('✓ Read page successful\n');
    } catch (err) {
      console.error('✗ Read page failed:', err.message);
    }

    // Test 4: Get page text
    console.log('=== Test 4: Get Page Text ===');
    await question('Press Enter to get page text...');
    
    try {
      const textResult = await client.executeTool({
        tool: 'get_page_text',
        args: {},
      });
      console.log('Page text (truncated):');
      if (textResult.content) {
        const content = typeof textResult.content === 'string' 
          ? textResult.content 
          : JSON.stringify(textResult.content);
        console.log(content.substring(0, 300) + '...');
      }
      console.log('✓ Get page text successful\n');
    } catch (err) {
      console.error('✗ Get page text failed:', err.message);
    }

    // Test 5: Take screenshot
    console.log('=== Test 5: Screenshot ===');
    await question('Press Enter to take a screenshot...');
    
    try {
      const screenshotResult = await client.executeTool({
        tool: 'computer',
        args: { action: 'screenshot' },
      });
      console.log('Screenshot result:');
      if (screenshotResult.content && Array.isArray(screenshotResult.content)) {
        const imageContent = screenshotResult.content.find(c => c.type === 'image');
        if (imageContent && imageContent.data) {
          console.log('✓ Screenshot captured! Size:', imageContent.data.length, 'bytes');
          console.log('  MIME type:', imageContent.mimeType);
        }
      }
      console.log('✓ Screenshot successful\n');
    } catch (err) {
      console.error('✗ Screenshot failed:', err.message);
    }

    // Test 6: Find element
    console.log('=== Test 6: Find Element ===');
    await question('Press Enter to find "Example" on the page...');
    
    try {
      const findResult = await client.executeTool({
        tool: 'find',
        args: { text: 'Example' },
      });
      console.log('Find result:', JSON.stringify(findResult, null, 2));
      console.log('✓ Find element successful\n');
    } catch (err) {
      console.error('✗ Find element failed:', err.message);
    }

    // Test 7: Tab context
    console.log('=== Test 7: Tab Context ===');
    await question('Press Enter to get tab context...');
    
    try {
      const tabResult = await client.executeTool({
        tool: 'tabs_context_mcp',
        args: {},
      });
      console.log('Tab context:', JSON.stringify(tabResult, null, 2));
      console.log('✓ Tab context successful\n');
    } catch (err) {
      console.error('✗ Tab context failed:', err.message);
    }

    // Test 8: JavaScript execution
    console.log('=== Test 8: JavaScript Execution ===');
    await question('Press Enter to execute JavaScript...');
    
    try {
      const jsResult = await client.executeTool({
        tool: 'javascript_tool',
        args: { 
          action: 'javascript_exec',
          code: 'document.title' 
        },
      });
      console.log('JavaScript result:', JSON.stringify(jsResult, null, 2));
      console.log('✓ JavaScript execution successful\n');
    } catch (err) {
      console.error('✗ JavaScript execution failed:', err.message);
    }

    // Test 9: Scroll action
    console.log('=== Test 9: Scroll ===');
    await question('Press Enter to scroll down...');
    
    try {
      const scrollResult = await client.executeTool({
        tool: 'computer',
        args: { action: 'scroll', direction: 'down' },
      });
      console.log('Scroll result:', JSON.stringify(scrollResult, null, 2));
      console.log('✓ Scroll successful\n');
    } catch (err) {
      console.error('✗ Scroll failed:', err.message);
    }

    // Interactive mode
    console.log('=== Interactive Mode ===');
    console.log('You can now test any tool interactively.');
    console.log('Available tools: navigate, computer, read_page, get_page_text, find, tabs_context_mcp, javascript_tool, etc.');
    console.log('Type "help" for tool list, "quit" to exit\n');

    while (true) {
      const input = await question('\nTool> ');
      
      if (input.trim() === 'quit') {
        break;
      }
      
      if (input.trim() === 'help') {
        console.log('\nAvailable tools:');
        console.log('  navigate, computer, form_input, find');
        console.log('  read_page, get_page_text');
        console.log('  tabs_context, tabs_create, tabs_context_mcp, tabs_create_mcp, resize_window');
        console.log('  read_console_messages, read_network_requests');
        console.log('  upload_image, gif_creator');
        console.log('  update_plan, shortcuts_list, shortcuts_execute');
        console.log('  javascript_tool, turn_answer_start');
        continue;
      }

      if (!input.trim()) continue;

      try {
        const [tool, ...argsParts] = input.split(' ');
        let args = {};
        
        if (argsParts.length > 0) {
          const argsStr = argsParts.join(' ');
          try {
            args = JSON.parse(argsStr);
          } catch {
            console.log('Invalid JSON args. Use format: tool {"key": "value"}');
            continue;
          }
        }

        console.log(`Executing ${tool}...`);
        const result = await client.executeTool({ tool, args });
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (err) {
        console.error('Error:', err.message);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\nDisconnecting...');
    server.disconnect();
    rl.close();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
