#!/usr/bin/env node
/**
 * Test Chrome Extension Integration - Diagnostic Version
 * 
 * This test verifies the full integration chain:
 * 1. Chrome browser is running
 * 2. Claude Browser Extension is installed
 * 3. Extension connects to native host
 * 4. MCP server can call tools
 */

import { ChromeMcpServer } from './dist/server.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function checkPrerequisites() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║            Prerequisites Diagnostic Check                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const results = {
    claudeCodeInstalled: false,
    chromeRunning: false,
    nativeHostManifest: false,
    extensionMaybeInstalled: false,
  };
  
  // Check 1: Claude Code CLI
  console.log('1. Checking Claude Code CLI installation...');
  try {
    const { execSync } = await import('child_process');
    const claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
    console.log(`   ✓ Found: ${claudePath}`);
    results.claudeCodeInstalled = true;
  } catch {
    console.log('   ✗ Claude Code CLI not found');
    console.log('   → Install: npm install -g @anthropic-ai/claude-code\n');
  }
  
  // Check 2: Chrome/Chromium running
  console.log('\n2. Checking if Chrome/Chromium is running...');
  try {
    const { execSync } = await import('child_process');
    const processes = execSync('ps aux | grep -E "(chromium|google-chrome)" | grep -v grep', { 
      encoding: 'utf-8' 
    });
    if (processes.trim().length > 0) {
      console.log('   ✓ Chrome/Chromium is running');
      results.chromeRunning = true;
    }
  } catch {
    console.log('   ✗ Chrome/Chromium is not running');
    console.log('   → Start Chrome with the Claude Browser Extension enabled\n');
  }
  
  // Check 3: Native Host Manifest
  console.log('\n3. Checking native host manifest...');
  const possiblePaths = [
    path.join(os.homedir(), '.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json'),
    path.join(os.homedir(), '.config/chromium/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json'),
    path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json'),
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`   ✓ Found: ${p}`);
      results.nativeHostManifest = true;
      break;
    }
  }
  
  if (!results.nativeHostManifest) {
    console.log('   ✗ Native host manifest not found');
    console.log('   → Run Claude Code once to set up the native host');
    console.log('   → Or manually install the manifest\n');
  }
  
  // Check 4: Extension ID hint
  console.log('\n4. Checking for Claude Browser Extension...');
  console.log('   ℹ Cannot directly detect extension from command line');
  console.log('   → Open chrome://extensions/ and verify extension is installed');
  console.log('   → Extension ID should be: fcoeoabgfenejglbffodgkkbkcdhcgfn');
  console.log('   → Extension should be enabled\n');
  
  return results;
}

async function testWithManualNativeHost() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║      Testing with Manually Spawned Native Host           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log('NOTE: This test spawns its own native host, which will NOT');
  console.log('      receive messages from the Chrome extension.');
  console.log('      The extension connects to a DIFFERENT native host process');
  console.log('      launched by Chrome via native messaging.\n');
  
  const server = new ChromeMcpServer({
    requestTimeout: 5000,
    spawnNativeHost: true,
  });

  try {
    await server.connect();
    console.log('✓ Can spawn native host and connect to socket');
    console.log('✓ MCP server infrastructure works correctly\n');
    server.disconnect();
    return true;
  } catch (error) {
    console.error('✗ Failed to spawn/connect:', error.message);
    return false;
  }
}

async function testWithExtensionNativeHost() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║    Testing Connection to Extension Native Host           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log('This test connects to the native host that should be');
  console.log('launched by the Chrome extension via native messaging.\n');
  
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  const socketPath = `/tmp/claude-mcp-browser-bridge-${username}`;
  
  console.log(`Looking for socket: ${socketPath}`);
  
  if (!fs.existsSync(socketPath)) {
    console.log('\n✗ Socket does not exist');
    console.log('\nThis means the native host is NOT running.');
    console.log('\nThe native host should be automatically started when:');
    console.log('  1. Chrome extension is installed and enabled');
    console.log('  2. Extension attempts to communicate with native host');
    console.log('  3. Native messaging manifest is properly installed\n');
    console.log('To start the native host:');
    console.log('  1. Open Chrome');
    console.log('  2. Navigate to any webpage (not chrome:// URL)');
    console.log('  3. The extension should auto-start the native host\n');
    return false;
  }
  
  console.log('✓ Socket file exists\n');
  
  const server = new ChromeMcpServer({
    socketPath,
    requestTimeout: 5000,
    spawnNativeHost: false,
  });

  try {
    console.log('Connecting to existing native host...');
    await server.connect();
    console.log('✓ Connected to native host socket\n');
    
    console.log('Testing tool execution (list_pages)...');
    const client = server.getNativeClient();
    
    const result = await client.executeTool({
      tool: 'list_pages',
      args: {},
    });
    
    if (result.error) {
      console.log('✗ Tool execution failed:', result.error);
      console.log('\nThis likely means:');
      console.log('  - The native host is running but not connected to extension');
      console.log('  - The extension is not installed or not running');
      console.log('  - The extension needs to be reloaded\n');
      server.disconnect();
      return false;
    }
    
    console.log('✓ Tool execution successful!\n');
    
    if (Array.isArray(result.content)) {
      const textContent = result.content.find(c => c.type === 'text');
      if (textContent && textContent.text) {
        console.log('Response:');
        console.log(textContent.text);
      }
    }
    
    server.disconnect();
    console.log('\n✓ Full integration test PASSED!');
    console.log('✓ Chrome extension is properly connected and working\n');
    return true;
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    server.disconnect();
    return false;
  }
}

async function main() {
  const prereqs = await checkPrerequisites();
  
  const infrastructureWorks = await testWithManualNativeHost();
  
  if (prereqs.chromeRunning && fs.existsSync(`/tmp/claude-mcp-browser-bridge-${process.env.USER || 'unknown'}`)) {
    const integrationWorks = await testWithExtensionNativeHost();
    
    if (integrationWorks) {
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║                  ALL TESTS PASSED!                        ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
      process.exit(0);
    }
  } else {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║            Extension Integration Not Testable             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('The MCP server infrastructure works correctly, but we cannot');
    console.log('test the full Chrome extension integration because:');
    
    if (!prereqs.chromeRunning) {
      console.log('  - Chrome/Chromium is not running');
    }
    
    if (!fs.existsSync(`/tmp/claude-mcp-browser-bridge-${process.env.USER || 'unknown'}`)) {
      console.log('  - Native host socket does not exist');
      console.log('    (Extension has not started the native host)');
    }
    
    console.log('\nTo complete the integration:');
    console.log('  1. Install Claude Browser Extension from Chrome Web Store');
    console.log('  2. Ensure native host manifest is installed');
    console.log('  3. Open Chrome and navigate to a webpage');
    console.log('  4. The extension will auto-start the native host');
    console.log('  5. Re-run this test\n');
  }
  
  if (infrastructureWorks) {
    console.log('✓ MCP server infrastructure: WORKING');
    process.exit(0);
  } else {
    console.log('✗ MCP server infrastructure: FAILED');
    process.exit(1);
  }
}

main();
