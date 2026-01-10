#!/usr/bin/env node

/**
 * Comprehensive test of ALL Chrome MCP tools
 */

import * as net from 'net';

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('='.repeat(70));
console.log('COMPREHENSIVE CHROME MCP TOOLS TEST');
console.log('='.repeat(70));

const socket = net.createConnection(socketPath);
let buffer = Buffer.alloc(0);
let testResults = [];
let currentTabId = null;

const tests = [
  { name: 'tabs_context_mcp', args: { createIfEmpty: true }, description: 'Initialize MCP tab group' },
  { name: 'tabs_create_mcp', args: { url: 'https://example.com' }, description: 'Create tab with example.com', extractTabId: true },
  { name: 'navigate', args: { url: 'https://github.com/trending' }, description: 'Navigate to GitHub trending', needsTabId: true, wait: 3000 },
  { name: 'get_page_text', args: {}, description: 'Get page text', needsTabId: true },
  { name: 'read_page', args: {}, description: 'Read page DOM', needsTabId: true },
  { name: 'find', args: { text: 'Trending' }, description: 'Find text on page', needsTabId: true },
  { name: 'computer', args: { action: 'screenshot' }, description: 'Take screenshot', needsTabId: true },
  { name: 'tabs_context_mcp', args: {}, description: 'Get tab context' },
  { name: 'read_console_messages', args: { limit: 5 }, description: 'Read console messages', needsTabId: true },
  { name: 'read_network_requests', args: { limit: 5 }, description: 'Read network requests', needsTabId: true },
  { name: 'javascript_tool', args: { action: 'javascript_exec', code: '2 + 2' }, description: 'Execute JavaScript', needsTabId: true },
  { name: 'resize_window', args: { width: 1280, height: 720 }, description: 'Resize window', needsTabId: true },
];

let currentTest = -1;

function runNextTest() {
  currentTest++;
  if (currentTest >= tests.length) {
    printResults();
    socket.destroy();
    return;
  }
  
  const test = tests[currentTest];
  const args = { ...test.args };
  
  if (test.needsTabId && currentTabId) {
    args.tabId = currentTabId;
  }
  
  const message = {
    method: 'execute_tool',
    params: { tool: test.name, args }
  };
  
  console.log(`\n[${ currentTest + 1}/${tests.length}] ${test.description}`);
  console.log(`Tool: ${test.name}`);
  
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  
  socket.write(header);
  socket.write(payload);
}

socket.on('connect', () => {
  console.log('\n✓ Connected to native host\n');
  runNextTest();
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
      const test = tests[currentTest];
      
      if (response.error) {
        const errorMsg = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
        console.log(`✗ FAILED: ${errorMsg}`);
        testResults.push({ ...test, status: 'FAILED', error: errorMsg });
        
        // Continue to next test
        setTimeout(runNextTest, 500);
      } else {
        console.log('✓ PASSED');
        
        // Extract tabId if needed
        if (test.extractTabId && response.result?.content) {
          for (const item of response.result.content) {
            if (item.type === 'text' && item.text) {
              const match = item.text.match(/Tab ID:\s*(\d+)/);
              if (match) {
                currentTabId = parseInt(match[1], 10);
                console.log(`  → Extracted tabId: ${currentTabId}`);
                break;
              }
            }
          }
        }
        
        // Show snippet of response
        if (response.result?.content?.[0]?.text) {
          const text = response.result.content[0].text;
          console.log(`  → ${text.substring(0, 100)}...`);
        } else if (response.result?.content?.[0]?.data) {
          console.log(`  → Screenshot captured (base64 data)`);
        }
        
        testResults.push({ ...test, status: 'PASSED' });
        
        // Wait if needed, then continue
        const waitTime = test.wait || 500;
        setTimeout(runNextTest, waitTime);
      }
      
    } catch (err) {
      console.error('✗ Parse error:', err);
      testResults.push({ ...tests[currentTest], status: 'ERROR', error: err.message });
      setTimeout(runNextTest, 500);
    }
  }
});

socket.on('error', (err) => {
  console.error('\n✗ Socket error:', err.message);
  process.exit(1);
});

function printResults() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  const passed = testResults.filter(t => t.status === 'PASSED').length;
  const failed = testResults.filter(t => t.status === 'FAILED').length;
  const errors = testResults.filter(t => t.status === 'ERROR').length;
  
  console.log(`\nTotal: ${testResults.length} tests`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`⚠ Errors: ${errors}`);
  
  if (failed > 0 || errors > 0) {
    console.log('\nFailed/Error tests:');
    testResults.filter(t => t.status !== 'PASSED').forEach(t => {
      console.log(`  - ${t.name}: ${t.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  if (passed === testResults.length) {
    console.log('🎉 ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    process.exit(1);
  }
}

setTimeout(() => {
  console.log('\n✗ Overall timeout (120s)');
  printResults();
  socket.destroy();
  process.exit(1);
}, 120000);
