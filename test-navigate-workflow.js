#!/usr/bin/env node

/**
 * Workflow: Create tab, then navigate, then get text
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Testing: create tab -> navigate -> get text...\n');

const socket = net.createConnection(socketPath);
let buffer = Buffer.alloc(0);
let step = 0;
let currentTabId = null;

function sendCommand(tool, args) {
  const message = {
    method: 'execute_tool',
    params: { tool, args }
  };
  
  step++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Step ${step}: ${tool}`);
  console.log(`${'='.repeat(60)}`);
  console.log('Args:', JSON.stringify(args, null, 2));
  
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  
  socket.write(header);
  socket.write(payload);
}

function extractTabIdFromResponse(response) {
  if (response.result?.content) {
    for (const item of response.result.content) {
      if (item.type === 'text' && item.text) {
        const match = item.text.match(/Tab ID:\s*(\d+)/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  return null;
}

socket.on('connect', () => {
  console.log('✓ Connected\n');
  sendCommand('tabs_context_mcp', { createIfEmpty: true });
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
      console.log('Response:', JSON.stringify(response, null, 2).substring(0, 500));
      
      if (response.error) {
        const errorMsg = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
        console.log('\n✗ ERROR:', errorMsg);
        socket.destroy();
        process.exit(1);
      }
      
      const newTabId = extractTabIdFromResponse(response);
      if (newTabId) {
        currentTabId = newTabId;
        console.log(`\n✓ TabId: ${currentTabId}`);
      }
      
      if (step === 1) {
        setTimeout(() => sendCommand('tabs_create_mcp', {}), 1000);
      } else if (step === 2) {
        console.log('\n⏳ Navigating to GitHub...');
        setTimeout(() => sendCommand('navigate', { url: 'https://github.com/trending', tabId: currentTabId }), 1000);
      } else if (step === 3) {
        console.log('\n⏳ Waiting 6s for page load...');
        setTimeout(() => sendCommand('get_page_text', { tabId: currentTabId }), 6000);
      } else if (step === 4) {
        console.log('\n✓ SUCCESS!');
        let text = '';
        if (response.result?.content) {
          for (const item of response.result.content) {
            if (item.type === 'text' && item.text) text += item.text;
          }
        }
        if (text) {
          console.log('\nPage preview:\n' + text.substring(0, 800));
          if (text.toLowerCase().includes('trending')) {
            console.log('\n🎉 VERIFIED: GitHub trending loaded!');
          }
        }
        socket.destroy();
        process.exit(0);
      }
      
    } catch (err) {
      console.error('\n✗ Parse error:', err);
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
}, 60000);
