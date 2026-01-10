#!/usr/bin/env node

/**
 * Direct socket test - bypasses MCP layer entirely
 * Tests if Chrome extension is actually connected and responding
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Testing direct socket connection to native host...');
console.log(`Socket path: ${socketPath}\n`);

const socket = net.createConnection(socketPath);

let buffer = Buffer.alloc(0);
let receivedResponse = false;

socket.on('connect', () => {
  console.log('✓ Connected to native host socket');
  
  // Send a navigate command
  const message = {
    method: 'execute_tool',
    params: {
      tool: 'navigate',
      args: {
        url: 'https://github.com/trending'
      }
    }
  };
  
  console.log('\nSending navigate command:');
  console.log(JSON.stringify(message, null, 2));
  
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  
  socket.write(header);
  socket.write(payload);
  
  console.log('\nWaiting for response (30s timeout)...\n');
  
  // Set timeout
  setTimeout(() => {
    if (!receivedResponse) {
      console.log('✗ TIMEOUT: No response after 30 seconds');
      console.log('\nPossible causes:');
      console.log('1. Chrome extension is not connected to native host');
      console.log('2. Chrome extension is not responding');
      console.log('3. No browser tabs are open');
      console.log('4. Extension needs permissions for the domain');
      socket.destroy();
      process.exit(1);
    }
  }, 30000);
});

socket.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  
  // Process messages
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    
    if (buffer.length < 4 + length) {
      // Not enough data yet
      return;
    }
    
    const payload = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    
    try {
      const response = JSON.parse(payload.toString('utf-8'));
      receivedResponse = true;
      
      console.log('✓ Received response from native host:');
      console.log(JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.log('\n✗ ERROR in response:');
        console.log(typeof response.error === 'string' ? response.error : JSON.stringify(response.error, null, 2));
      } else if (response.content) {
        console.log('\n✓ SUCCESS: Tool executed successfully');
      }
      
      // Wait a bit for any additional messages, then exit
      setTimeout(() => {
        socket.destroy();
        process.exit(response.error ? 1 : 0);
      }, 1000);
      
    } catch (err) {
      console.error('Failed to parse response:', err);
    }
  }
});

socket.on('error', (err) => {
  console.error('✗ Socket error:', err.message);
  process.exit(1);
});

socket.on('close', () => {
  if (!receivedResponse) {
    console.log('✗ Socket closed without receiving response');
    process.exit(1);
  }
});
