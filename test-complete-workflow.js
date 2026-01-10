#!/usr/bin/env node

/**
 * Complete workflow test - pass tabId inside args as extension expects
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Testing complete workflow (tabId in args)...\n');

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
  console.log('Request:', JSON.stringify(message, null, 2));
  
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
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
  }
  return null;
}

socket.on('connect', () => {
  console.log('✓ Connected to native host socket\n');
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
      
      console.log('\nResponse:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        const errorMsg = typeof response.error === 'string' 
          ? response.error 
          : JSON.stringify(response.error);
        console.log('\n✗ ERROR:', errorMsg);
        socket.destroy();
        process.exit(1);
      }
      
      const newTabId = extractTabIdFromResponse(response);
      if (newTabId) {
        currentTabId = newTabId;
        console.log(`\n✓ Extracted tabId: ${currentTabId}`);
      }
      
      if (step === 1) {
        console.log('\n⏳ MCP tab group created, creating tab...');
        setTimeout(() => {
          sendCommand('tabs_create_mcp', { url: 'https://github.com/trending' });
        }, 1000);
      } else if (step === 2) {
        console.log(`\n⏳ Tab created, waiting 5s for page load...`);
        setTimeout(() => {
          // Pass tabId INSIDE args, not at params level
          sendCommand('get_page_text', { tabId: currentTabId });
        }, 5000);
      } else if (step === 3) {
        console.log('\n✓ SUCCESS! Got page text from GitHub trending.');
        
        let text = '';
        if (response.result?.content) {
          for (const item of response.result.content) {
            if (item.type === 'text' && item.text) {
              text += item.text;
            }
          }
        }
        
        if (text) {
          console.log('\n' + '='.repeat(60));
          console.log('Page text preview (first 800 chars):');
          console.log('='.repeat(60));
          console.log(text.substring(0, 800));
          console.log('...');
          
          if (text.toLowerCase().includes('trending') || text.toLowerCase().includes('github')) {
            console.log('\n✓ VERIFIED: Successfully navigated to GitHub trending!');
            console.log('\n🎉 ALL TESTS PASSED! Chrome MCP integration works!');
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
  console.error('\n✗ Socket error:', err.message);
  process.exit(1);
});

socket.on('close', () => {
  console.log('\nSocket closed');
});

setTimeout(() => {
  console.log('\n✗ Timeout (60s)');
  socket.destroy();
  process.exit(1);
}, 60000);
