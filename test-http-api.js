#!/usr/bin/env node

/**
 * HTTP API Test for Claude Chrome MCP
 */

async function testHttpApi() {
  const baseUrl = 'http://localhost:3456';
  
  console.log('=== Claude Chrome MCP HTTP API Test ===\n');
  
  // Test 1: Health check
  console.log('Test 1: Health Check');
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log('✓ Health:', JSON.stringify(health));
  } catch (err) {
    console.error('✗ Health check failed:', err.message);
    return;
  }
  
  // Test 2: List tools
  console.log('\nTest 2: List Tools');
  try {
    const toolsRes = await fetch(`${baseUrl}/tools`);
    const tools = await toolsRes.json();
    console.log(`✓ Found ${tools.tools.length} tools`);
    console.log('Tools:', tools.tools.map(t => t.name).join(', '));
  } catch (err) {
    console.error('✗ List tools failed:', err.message);
  }
  
  // Test 3: Execute navigate tool
  console.log('\nTest 3: Navigate to example.com');
  try {
    const navMsg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'navigate',
        arguments: { url: 'https://example.com' }
      }
    };
    
    const navRes = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(navMsg)
    });
    
    const navResult = await navRes.json();
    console.log('✓ Navigation result:', JSON.stringify(navResult, null, 2));
  } catch (err) {
    console.error('✗ Navigation failed:', err.message);
  }
  
  // Test 4: Read page
  console.log('\nTest 4: Read Page Content');
  try {
    const readMsg = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'read_page',
        arguments: {}
      }
    };
    
    const readRes = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readMsg)
    });
    
    const readResult = await readRes.json();
    console.log('✓ Read page result (truncated):');
    const resultStr = JSON.stringify(readResult);
    console.log(resultStr.substring(0, 500) + '...');
  } catch (err) {
    console.error('✗ Read page failed:', err.message);
  }
  
  // Test 5: Take screenshot
  console.log('\nTest 5: Take Screenshot');
  try {
    const screenshotMsg = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'computer',
        arguments: { action: 'screenshot' }
      }
    };
    
    const screenshotRes = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(screenshotMsg)
    });
    
    const screenshotResult = await screenshotRes.json();
    if (screenshotResult.result && screenshotResult.result.content) {
      const hasImage = screenshotResult.result.content.some(c => c.type === 'image');
      console.log(`✓ Screenshot ${hasImage ? 'captured' : 'failed'}`);
      if (hasImage) {
        const img = screenshotResult.result.content.find(c => c.type === 'image');
        console.log(`  Image size: ${img.data.length} bytes`);
      }
    }
  } catch (err) {
    console.error('✗ Screenshot failed:', err.message);
  }
  
  // Test 6: Get page text
  console.log('\nTest 6: Get Page Text');
  try {
    const textMsg = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_page_text',
        arguments: {}
      }
    };
    
    const textRes = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textMsg)
    });
    
    const textResult = await textRes.json();
    console.log('✓ Page text (truncated):');
    const textStr = JSON.stringify(textResult);
    console.log(textStr.substring(0, 300) + '...');
  } catch (err) {
    console.error('✗ Get page text failed:', err.message);
  }
  
  console.log('\n=== Test Complete ===');
}

testHttpApi().catch(console.error);
