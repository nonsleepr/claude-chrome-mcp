#!/usr/bin/env node

/**
 * Test creating a tab and then navigating
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Testing tab creation and navigation...\n');

const socket = net.createConnection(socketPath);
let buffer = Buffer.alloc(0);
let step = 0;

function sendCommand(tool, args) {
  const message = {
    method: 'execute_tool',
    params: { tool, args }
  };
  
  console.log(`\nStep ${++step}: Sending ${tool} command`);
  console.log(JSON.stringify(message, null, 2));
  
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  
  socket.write(header);
  socket.write(payload);
}

socket.on('connect', () => {
  console.log('✓ Connected to native host socket\n');
  
  // Step 1: Create a tab in MCP tab group
  sendCommand('tabs_create_mcp', { url: 'https://github.com/trending' });
});

socket.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    
    if (buffer.length < 4 + length) {
      return;
    }
    
    const payload = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    
    try {
      const response = JSON.parse(payload.toString('utf-8'));
      
      console.log(`\n✓ Response for step ${step}:`);
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('\n✗ ERROR:', typeof response.error === 'string' ? response.error : JSON.stringify(response.error));
        socket.destroy();
        process.exit(1);
      }
      
      // After creating tab, wait a bit then take screenshot
      if (step === 1) {
        console.log('\n⏳ Waiting 3 seconds for page to load...');
        setTimeout(() => {
          sendCommand('computer', { action: 'screenshot' });
        }, 3000);
      } else if (step === 2) {
        console.log('\n✓ SUCCESS! Tab created and screenshot taken.');
        console.log('\nResponse content:', response.content);
        socket.destroy();
        process.exit(0);
      }
      
    } catch (err) {
      console.error('Failed to parse response:', err);
      socket.destroy();
      process.exit(1);
    }
  }
});

socket.on('error', (err) => {
  console.error('✗ Socket error:', err.message);
  process.exit(1);
});

socket.on('close', () => {
  console.log('\nSocket closed');
});

// Overall timeout
setTimeout(() => {
  console.log('\n✗ Test timeout (30s)');
  socket.destroy();
  process.exit(1);
}, 30000);
