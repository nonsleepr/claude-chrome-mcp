#!/usr/bin/env node

/**
 * Comprehensive MCP Test with Native Host
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

async function runTest(client, testName, tool, args) {
  console.log(`\n=== ${testName} ===`);
  try {
    console.log(`Executing: ${tool}(${JSON.stringify(args)})`);
    const result = await client.executeTool({ tool, args });
    console.log('✓ Success!');
    
    if (result.content) {
      const content = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content, null, 2);
      console.log('Response:', content.substring(0, 500));
      if (content.length > 500) console.log('... (truncated)');
    }
    if (result.error) {
      console.log('Error from tool:', result.error);
    }
    if (result.tabContext) {
      console.log('Tab context:', JSON.stringify(result.tabContext, null, 2));
    }
    return true;
  } catch (err) {
    console.error('✗ Failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('=== Claude Chrome MCP Comprehensive Test ===\n');

  const username = process.env.USER || process.env.USERNAME || 'unknown';
  const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

  console.log(`Using socket: ${socketPath}`);
  console.log('Creating MCP server...');

  const server = new ChromeMcpServer({
    socketPath: socketPath,
    spawnNativeHost: false,
    requestTimeout: 30000,
  });

  try {
    console.log('Connecting to native host...');
    await server.connect();
    console.log('✓ Connected successfully!\n');

    const client = server.getNativeClient();

    // Test 1: Navigate
    await runTest(
      client,
      'Test 1: Navigate to example.com',
      'navigate',
      { url: 'https://example.com' }
    );

    await question('\nPress Enter to continue to next test...');

    // Test 2: Read Page
    await runTest(
      client,
      'Test 2: Read Page Content',
      'read_page',
      {}
    );

    await question('\nPress Enter to continue to next test...');

    // Test 3: Get Page Text
    await runTest(
      client,
      'Test 3: Get Page Text',
      'get_page_text',
      {}
    );

    await question('\nPress Enter to continue to next test...');

    // Test 4: Take Screenshot
    const screenshotSuccess = await runTest(
      client,
      'Test 4: Take Screenshot',
      'computer',
      { action: 'screenshot' }
    );

    if (screenshotSuccess) {
      console.log('Note: Screenshot data is base64-encoded image');
    }

    await question('\nPress Enter to continue to next test...');

    // Test 5: Find Element
    await runTest(
      client,
      'Test 5: Find "Example" on page',
      'find',
      { text: 'Example' }
    );

    await question('\nPress Enter to continue to next test...');

    // Test 6: Tab Context
    await runTest(
      client,
      'Test 6: Get Tab Context',
      'tabs_context_mcp',
      {}
    );

    await question('\nPress Enter to continue to next test...');

    // Test 7: JavaScript Execution
    await runTest(
      client,
      'Test 7: Execute JavaScript (get page title)',
      'javascript_tool',
      { action: 'javascript_exec', code: 'document.title' }
    );

    await question('\nPress Enter to continue to next test...');

    // Test 8: Console Messages
    await runTest(
      client,
      'Test 8: Read Console Messages',
      'read_console_messages',
      { limit: 10 }
    );

    await question('\nPress Enter to continue to next test...');

    // Test 9: Network Requests
    await runTest(
      client,
      'Test 9: Read Network Requests',
      'read_network_requests',
      { limit: 5 }
    );

    await question('\nPress Enter to continue to next test...');

    // Test 10: Scroll
    await runTest(
      client,
      'Test 10: Scroll Down',
      'computer',
      { action: 'scroll', direction: 'down' }
    );

    console.log('\n=== All Tests Complete ===');
    console.log('\nEntering interactive mode. Type "quit" to exit, "help" for commands.\n');

    // Interactive mode
    while (true) {
      const input = await question('Tool> ');
      
      if (input.trim() === 'quit') {
        break;
      }
      
      if (input.trim() === 'help') {
        console.log('\nAvailable commands:');
        console.log('  navigate <url>  - Navigate to URL');
        console.log('  read            - Read current page');
        console.log('  text            - Get page text');
        console.log('  screenshot      - Take screenshot');
        console.log('  find <text>     - Find text on page');
        console.log('  js <code>       - Execute JavaScript');
        console.log('  scroll <dir>    - Scroll (up/down/left/right)');
        console.log('  tabs            - Get tab context');
        console.log('  console         - Read console messages');
        console.log('  network         - Read network requests');
        console.log('  quit            - Exit');
        continue;
      }

      const parts = input.trim().split(' ');
      const cmd = parts[0];
      const rest = parts.slice(1).join(' ');

      try {
        switch (cmd) {
          case 'navigate':
            await runTest(client, 'Navigate', 'navigate', { url: rest });
            break;
          case 'read':
            await runTest(client, 'Read Page', 'read_page', {});
            break;
          case 'text':
            await runTest(client, 'Get Text', 'get_page_text', {});
            break;
          case 'screenshot':
            await runTest(client, 'Screenshot', 'computer', { action: 'screenshot' });
            break;
          case 'find':
            await runTest(client, 'Find', 'find', { text: rest });
            break;
          case 'js':
            await runTest(client, 'JavaScript', 'javascript_tool', { 
              action: 'javascript_exec', 
              code: rest 
            });
            break;
          case 'scroll':
            await runTest(client, 'Scroll', 'computer', { 
              action: 'scroll', 
              direction: rest || 'down' 
            });
            break;
          case 'tabs':
            await runTest(client, 'Tab Context', 'tabs_context_mcp', {});
            break;
          case 'console':
            await runTest(client, 'Console', 'read_console_messages', { limit: 10 });
            break;
          case 'network':
            await runTest(client, 'Network', 'read_network_requests', { limit: 5 });
            break;
          default:
            console.log('Unknown command. Type "help" for available commands.');
        }
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
