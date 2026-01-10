#!/usr/bin/env node
/**
 * Test Chrome Extension Integration
 * 
 * Verifies that:
 * 1. Chrome extension is installed and running
 * 2. Native host connects to the extension
 * 3. MCP server can call tools through the extension
 */

import { ChromeMcpServer } from './dist/server.js';

async function testExtensionConnection() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Chrome Extension Integration Test Suite            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log('Prerequisites:');
  console.log('  1. Chrome browser is running');
  console.log('  2. Claude Browser Extension is installed and enabled');
  console.log('  3. Extension has permissions to access browser tabs\n');
  
  const server = new ChromeMcpServer({
    requestTimeout: 10000,
    spawnNativeHost: true,
  });

  try {
    // Test 1: Connection
    console.log('=== Test 1: Spawn Native Host and Connect ===');
    await server.connect();
    console.log('✓ Native host spawned and connected\n');
    
    const client = server.getNativeClient();
    
    // Test 2: List Pages (verify extension is connected)
    console.log('=== Test 2: List Browser Pages ===');
    console.log('Calling list_pages tool...');
    
    const listResult = await client.executeTool({
      tool: 'list_pages',
      args: {},
    });
    
    if (listResult.error) {
      console.error('✗ Error:', listResult.error);
      console.error('\nPossible causes:');
      console.error('  - Chrome extension is not installed');
      console.error('  - Chrome extension is disabled');
      console.error('  - Chrome browser is not running');
      console.error('  - Extension does not have necessary permissions\n');
      return false;
    }
    
    console.log('✓ list_pages successful');
    
    // Parse the response
    let pages = [];
    if (Array.isArray(listResult.content)) {
      const textContent = listResult.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        console.log('\nPages found:');
        console.log(textContent.text);
        
        // Try to extract page count
        const match = textContent.text.match(/(\d+)\s+open\s+(?:page|tab)/i);
        if (match) {
          const pageCount = parseInt(match[1]);
          console.log(`\n✓ Chrome extension is active with ${pageCount} tab(s) open`);
        }
      }
    }
    
    console.log('\n=== Test 3: Navigate to Test Page ===');
    console.log('Navigating to https://example.com...');
    
    const navResult = await client.executeTool({
      tool: 'navigate',
      args: { url: 'https://example.com' },
    });
    
    if (navResult.error) {
      console.error('✗ Navigation failed:', navResult.error);
      return false;
    }
    
    console.log('✓ Navigation successful');
    
    // Wait a bit for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== Test 4: Read Page Content ===');
    console.log('Reading page content...');
    
    const readResult = await client.executeTool({
      tool: 'read_page',
      args: {},
    });
    
    if (readResult.error) {
      console.error('✗ Read page failed:', readResult.error);
      return false;
    }
    
    console.log('✓ Page read successful');
    
    // Check if we got content
    if (Array.isArray(readResult.content)) {
      const textContent = readResult.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        const preview = textContent.text.substring(0, 200);
        console.log('\nPage content preview:');
        console.log(preview + '...');
        
        // Verify it's example.com
        if (textContent.text.toLowerCase().includes('example')) {
          console.log('\n✓ Content verified - we are on example.com');
        }
      }
    }
    
    console.log('\n=== Test 5: Get Page Text ===');
    console.log('Getting page text...');
    
    const textResult = await client.executeTool({
      tool: 'get_page_text',
      args: {},
    });
    
    if (textResult.error) {
      console.error('✗ Get page text failed:', textResult.error);
      return false;
    }
    
    console.log('✓ Get page text successful');
    
    if (Array.isArray(textResult.content)) {
      const textContent = textResult.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        const preview = textContent.text.substring(0, 150);
        console.log('\nText preview:');
        console.log(preview + '...');
      }
    }
    
    console.log('\n=== Test 6: Take Screenshot ===');
    console.log('Taking screenshot...');
    
    const screenshotResult = await client.executeTool({
      tool: 'take_screenshot',
      args: {},
    });
    
    if (screenshotResult.error) {
      console.error('✗ Screenshot failed:', screenshotResult.error);
      return false;
    }
    
    console.log('✓ Screenshot successful');
    
    // Check if we got an image
    if (Array.isArray(screenshotResult.content)) {
      const imageContent = screenshotResult.content.find(c => c.type === 'image');
      if (imageContent && imageContent.data) {
        const dataLength = imageContent.data.length;
        console.log(`✓ Screenshot captured (${dataLength} bytes, ${imageContent.mimeType || 'image/png'})`);
      }
    }
    
    // Cleanup
    console.log('\n=== Cleanup ===');
    server.disconnect();
    console.log('✓ Disconnected\n');
    
    // Summary
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                   All Tests Passed!                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('✓ Chrome extension is properly connected');
    console.log('✓ Native host communication works');
    console.log('✓ MCP server can call tools successfully');
    console.log('✓ Navigation, reading, and screenshots all work\n');
    
    return true;
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error('\nFull error:', error);
    server.disconnect();
    return false;
  }
}

async function main() {
  const success = await testExtensionConnection();
  
  if (success) {
    process.exit(0);
  } else {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                    Tests Failed                           ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    console.error('Troubleshooting steps:');
    console.error('1. Open Chrome and check if the Claude Browser Extension is installed');
    console.error('2. Go to chrome://extensions and verify the extension is enabled');
    console.error('3. Make sure Chrome has at least one tab open');
    console.error('4. Check the extension permissions');
    console.error('5. Try restarting Chrome\n');
    process.exit(1);
  }
}

main();
