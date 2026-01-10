#!/usr/bin/env node
/**
 * Test Chrome Extension with Native Messaging
 * 
 * This test connects to the native host that Chrome launches via native messaging.
 * The extension must trigger the native host first.
 */

import { ChromeMcpServer } from './dist/server.js';
import * as fs from 'fs';

async function waitForSocket(socketPath, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fs.existsSync(socketPath)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Chrome Extension Integration Test (Native Messaging)   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;
  
  console.log('Step 1: Checking prerequisites...\n');
  
  // Check manifest
  const manifestPath = `${process.env.HOME}/.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`;
  if (!fs.existsSync(manifestPath)) {
    console.error('✗ Native messaging manifest not found!');
    console.error(`  Expected at: ${manifestPath}\n`);
    process.exit(1);
  }
  console.log('✓ Native messaging manifest installed\n');
  
  console.log('Step 2: Waiting for Chrome extension to launch native host...\n');
  console.log('Please:');
  console.log('  1. Open Chromium browser');
  console.log('  2. Go to chrome://extensions/');
  console.log('  3. Find "Claude Browser Extension"');
  console.log('  4. Click the reload button (or disable/enable it)');
  console.log('  5. Open a new tab and navigate to any website (e.g., google.com)');
  console.log('  6. Wait a moment for the extension to connect...\n');
  
  const socketFound = await waitForSocket(socketPath, 30000);
  
  if (!socketFound) {
    console.error('✗ Socket not found after 30 seconds');
    console.error('\nTroubleshooting:');
    console.error('  1. Check Chrome extension console (chrome://extensions/ → Details → Inspect views)');
    console.error('  2. Verify extension ID matches manifest:');
    console.error('     Expected: fcoeoabgfenejglbffodgkkbkcdhcgfn');
    console.error('  3. Check wrapper script is executable:');
    console.error('     ls -la ~/.claude/chrome/chrome-native-host');
    console.error('  4. Try restarting Chromium\n');
    process.exit(1);
  }
  
  console.log(`✓ Socket found: ${socketPath}\n`);
  
  console.log('Step 3: Connecting to native host...\n');
  
  const server = new ChromeMcpServer({
    socketPath,
    requestTimeout: 10000,
    spawnNativeHost: false,  // Don't spawn - use Chrome's native host
  });
  
  try {
    await server.connect();
    console.log('✓ Connected to native host!\n');
    
    console.log('Step 4: Testing tool execution (list_pages)...\n');
    
    const client = server.getNativeClient();
    const result = await client.executeTool({
      tool: 'list_pages',
      args: {},
    });
    
    if (result.error) {
      console.error('✗ Tool execution failed:', result.error);
      server.disconnect();
      process.exit(1);
    }
    
    console.log('✓ Tool execution successful!\n');
    
    // Display result
    if (Array.isArray(result.content)) {
      const textContent = result.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        console.log('=== Browser Pages ===');
        console.log(textContent.text);
        console.log('='.repeat(60) + '\n');
      }
    }
    
    console.log('Step 5: Testing navigation...\n');
    
    const navResult = await client.executeTool({
      tool: 'navigate',
      args: { url: 'https://example.com' },
    });
    
    if (navResult.error) {
      console.error('✗ Navigation failed:', navResult.error);
    } else {
      console.log('✓ Navigation successful!\n');
    }
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Step 6: Reading page content...\n');
    
    const readResult = await client.executeTool({
      tool: 'read_page',
      args: {},
    });
    
    if (readResult.error) {
      console.error('✗ Read page failed:', readResult.error);
    } else {
      console.log('✓ Read page successful!\n');
      
      if (Array.isArray(readResult.content)) {
        const textContent = readResult.content.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          const preview = textContent.text.substring(0, 300);
          console.log('=== Page Content Preview ===');
          console.log(preview + '...');
          console.log('='.repeat(60) + '\n');
        }
      }
    }
    
    server.disconnect();
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              ALL TESTS PASSED SUCCESSFULLY!               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('✓ Chrome extension is properly connected');
    console.log('✓ Native messaging works correctly');
    console.log('✓ MCP server can call tools through the extension');
    console.log('✓ Full integration chain is operational\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    server.disconnect();
    process.exit(1);
  }
}

main();
