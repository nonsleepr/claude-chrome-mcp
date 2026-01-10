#!/usr/bin/env node

/**
 * Test OpenCode integration with Chrome MCP
 * This script simulates what OpenCode does when calling chrome tools
 */

import { ChromeMcpServer } from './dist/server.js';

async function test() {
  console.log('Creating Chrome MCP server...');
  const server = new ChromeMcpServer({ spawn: true });
  
  console.log('Connecting to native host...');
  await server.connect();
  
  console.log('Testing navigate tool...');
  const result = await server.executeTool('navigate', {
    url: 'https://github.com/trending'
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  console.log('\nWaiting 3 seconds for page to load...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\nTesting get_page_text tool...');
  const textResult = await server.executeTool('get_page_text', {});
  console.log('Text result:', textResult.content[0].text.substring(0, 500) + '...');
  
  process.exit(0);
}

test().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
