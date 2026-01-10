#!/usr/bin/env node

/**
 * Debug test for navigate command
 */

import { ChromeMcpServer } from './dist/server.js';

async function test() {
  console.log('Creating Chrome MCP server...');
  const server = new ChromeMcpServer({ spawn: false }); // Use existing native host
  
  console.log('Connecting to native host...');
  await server.connect();
  
  console.log('Connected! Testing navigate tool...');
  
  try {
    const result = await server.executeTool('navigate', {
      url: 'https://github.com/trending'
    });
    
    console.log('\n=== SUCCESS ===');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('\n=== ERROR ===');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.log('Error object:', error);
  }
  
  process.exit(0);
}

test().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
