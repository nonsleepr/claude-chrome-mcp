#!/usr/bin/env node
/**
 * Verify Native Host Connection from Chrome Extension
 * 
 * This script checks if the Chrome extension successfully launched the native host.
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║        Native Host Connection Verification               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const username = process.env.USER || process.env.USERNAME || 'unknown';
const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;

console.log('Check 1: Native Messaging Manifest\n');
const manifestPath = `${process.env.HOME}/.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`;

if (fs.existsSync(manifestPath)) {
  console.log('✓ Manifest exists:', manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('  - Name:', manifest.name);
  console.log('  - Path:', manifest.path);
  console.log('  - Type:', manifest.type);
  console.log('  - Allowed origins:', manifest.allowed_origins.join(', '));
  
  // Check if wrapper script exists and is executable
  if (fs.existsSync(manifest.path)) {
    const stats = fs.statSync(manifest.path);
    const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
    if (isExecutable) {
      console.log('✓ Wrapper script exists and is executable:', manifest.path);
    } else {
      console.log('✗ Wrapper script exists but is NOT executable:', manifest.path);
      console.log('  Run: chmod +x', manifest.path);
    }
  } else {
    console.log('✗ Wrapper script does not exist:', manifest.path);
  }
} else {
  console.log('✗ Manifest not found:', manifestPath);
}

console.log('\nCheck 2: Native Host Process\n');

try {
  const processes = execSync('ps aux | grep "chrome-native-host" | grep -v grep', { encoding: 'utf-8' });
  if (processes.trim()) {
    console.log('✓ Native host process is running:');
    processes.trim().split('\n').forEach(line => {
      console.log('  ', line);
    });
  } else {
    console.log('✗ Native host process is NOT running');
  }
} catch (err) {
  console.log('✗ Native host process is NOT running');
}

console.log('\nCheck 3: Socket File\n');

if (fs.existsSync(socketPath)) {
  const stats = fs.statSync(socketPath);
  console.log('✓ Socket exists:', socketPath);
  console.log('  - Type:', stats.isSocket() ? 'Unix socket' : 'Not a socket!');
  console.log('  - Permissions:', (stats.mode & parseInt('777', 8)).toString(8));
  console.log('  - Owner:', stats.uid);
  
  // Try to see if socket is accepting connections
  console.log('\nCheck 4: Socket Connection Test\n');
  
  const net = await import('net');
  const socket = net.default.createConnection(socketPath);
  
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('✗ Socket connection timed out (2s)');
      socket.destroy();
      resolve();
    }, 2000);
    
    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log('✓ Socket is accepting connections');
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.log('✗ Socket connection failed:', err.message);
      resolve();
    });
  });
  
} else {
  console.log('✗ Socket does NOT exist:', socketPath);
  console.log('\nThis means the native host has not been launched.');
}

console.log('\nCheck 5: Chrome Extension Status\n');
console.log('To verify the extension:');
console.log('  1. Open Chromium');
console.log('  2. Navigate to chrome://extensions/');
console.log('  3. Find "Claude Browser Extension" or similar');
console.log('  4. Check that it is ENABLED');
console.log('  5. Verify the extension ID matches: fcoeoabgfenejglbffodgkkbkcdhcgfn');
console.log('  6. Click "Details" then "Inspect views: service worker" or "background page"');
console.log('  7. In the console, look for connection errors\n');

console.log('Check 6: Chrome Extension Logs\n');
console.log('To see native messaging errors:');
console.log('  1. Open chrome://extensions/ (with Developer mode ON)');
console.log('  2. Find the Claude extension');
console.log('  3. Click "Inspect views: service worker" or "background page"');
console.log('  4. Check console for errors like:');
console.log('     - "Native host has exited"');
console.log('     - "Specified native messaging host not found"');
console.log('     - "Failed to start native messaging host"\n');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                    Next Steps                             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

if (fs.existsSync(socketPath)) {
  console.log('✓ Everything looks good! The native host is running.');
  console.log('\nYou can now run:');
  console.log('  node test-chrome-native-messaging.js');
  console.log('\nTo test the full integration.');
} else {
  console.log('✗ Native host is not running. Troubleshooting steps:\n');
  console.log('1. Check wrapper script manually:');
  console.log('   ~/.claude/chrome/chrome-native-host');
  console.log('   Expected output: Native host starts and creates socket\n');
  console.log('2. Check Chrome extension console for errors\n');
  console.log('3. Try restarting Chromium completely\n');
  console.log('4. Make sure the extension ID matches the manifest\n');
}

console.log('\nManual Test of Wrapper Script:\n');
console.log('Run this to test the wrapper directly:');
console.log('  ~/.claude/chrome/chrome-native-host');
console.log('\nExpected output:');
console.log('  [Claude Chrome Native Host] Initializing...');
console.log('  [Claude Chrome Native Host] Creating socket listener: ' + socketPath);
console.log('  [Claude Chrome Native Host] Socket server listening for connections');
