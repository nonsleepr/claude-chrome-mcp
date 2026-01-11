#!/usr/bin/env node

/**
 * Test script to verify runtime detection works correctly
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

console.log('Testing runtime detection...\n');

// Test 1: Normal environment (should detect bun if available)
console.log('Test 1: Normal environment');
try {
  const result = execSync('node dist/cli.js --status', { encoding: 'utf8' });
  console.log(result);
} catch (error) {
  console.error('Error:', error.message);
}

// Test 2: Check wrapper script content
console.log('\nTest 2: Checking wrapper script');
const wrapperPath = `${process.env.HOME}/.local/share/claude-chrome-mcp/claude-chrome-mcp-native-host`;
if (fs.existsSync(wrapperPath)) {
  const content = fs.readFileSync(wrapperPath, 'utf8');
  console.log('Wrapper script content:');
  console.log(content);
  
  if (content.includes('bun')) {
    console.log('✓ Using Bun runtime');
  } else if (content.includes('node')) {
    console.log('✓ Using Node runtime');
  }
} else {
  console.log('No wrapper script found - run --install first');
}

console.log('\n✓ Runtime detection tests complete');
