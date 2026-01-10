#!/usr/bin/env node

/**
 * Simple connection test - just try to establish connection
 */

import { NativeHostClient } from './dist/index.js';

async function test() {
  console.log('Testing native host connection...\n');
  
  // Try different socket paths
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  const paths = [
    `/tmp/claude-code-mcp-${username}.sock`,
    `/tmp/claude-mcp-browser-bridge-${username}`,
    `/tmp/claude-browser-extension-${username}`,
  ];
  
  for (const socketPath of paths) {
    console.log(`Trying socket: ${socketPath}`);
    const client = new NativeHostClient({ socketPath, requestTimeout: 5000 });
    
    // Suppress error events during testing
    client.on('error', () => {});
    
    try {
      await client.connect();
      console.log(`✓ Connected successfully to: ${socketPath}\n`);
      
      // Try a simple command
      console.log('Testing navigate command...');
      const result = await client.executeTool({
        tool: 'navigate',
        args: { url: 'https://example.com' },
      });
      console.log('Result:', JSON.stringify(result, null, 2));
      
      client.disconnect();
      return;
    } catch (err) {
      console.log(`✗ Failed: ${err.message}\n`);
      client.disconnect();
    }
  }
  
  console.log('\nAll connection attempts failed.');
  console.log('\nTroubleshooting:');
  console.log('1. Make sure the Claude Browser Extension is installed and active in Chrome');
  console.log('2. The extension must be enabled and have permissions');
  console.log('3. You may need to start the native host manually with:');
  console.log('   claude --chrome-native-host');
}

test().catch(console.error);
