#!/usr/bin/env node

/**
 * Test getting tab context to see what's available
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Checking tab context...\n');

const socket = net.createConnection(socketPath);
let buffer = Buffer.alloc(0);

function sendCommand(tool, args) {
  const message = {
    method: 'execute_tool',
    params: { tool, args }
  };
  
  console.log(`Sending ${tool} command...`);
  
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  
  socket.write(header);
  socket.write(payload);
}

socket.on('connect', () => {
  console.log('✓ Connected\n');
  sendCommand('tabs_context', {});
});

socket.on('data', (data) => {
  buffer = Buffer.concat([buffer, data]);
  
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    
    if (buffer.length < 4 + length) return;
    
    const payload = buffer.subarray(4, 4 + length);
    buffer = buffer.subarray(4 + length);
    
    try {
      const response = JSON.parse(payload.toString('utf-8'));
      console.log('Response:', JSON.stringify(response, null, 2));
      socket.destroy();
      process.exit(0);
    } catch (err) {
      console.error('Parse error:', err);
      socket.destroy();
      process.exit(1);
    }
  }
});

socket.on('error', (err) => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('✗ Timeout');
  socket.destroy();
  process.exit(1);
}, 10000);
