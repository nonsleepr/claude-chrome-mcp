#!/usr/bin/env node

/**
 * Comprehensive MCP Feature Test Suite
 * 
 * Tests all claimed features of the claude-chrome-mcp adapter to ensure
 * they work correctly with the Chrome extension.
 */

import { ChromeMcpServer } from './dist/server.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function log(section, message, status = 'info') {
  const symbols = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warning: '⚠',
    arrow: '→'
  };
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warning: '\x1b[33m', // yellow
    arrow: '\x1b[35m',   // magenta
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[status]}${symbols[status]} [${section}]${colors.reset} ${message}`);
}

function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${text}`);
  console.log('='.repeat(60) + '\n');
}

function printSubHeader(text) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${text}`);
  console.log('─'.repeat(60));
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class McpTester {
  constructor() {
    this.server = null;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async initialize() {
    printHeader('MCP Feature Test Suite');
    log('INIT', 'Initializing MCP server with spawn enabled...');
    
    this.server = new ChromeMcpServer({ spawnNativeHost: true });
    
    try {
      await this.server.connect();
      log('INIT', 'Connected to native host successfully!', 'success');
      return true;
    } catch (error) {
      log('INIT', `Failed to connect: ${error.message}`, 'error');
      return false;
    }
  }

  async executeTool(name, args = {}) {
    log('EXEC', `Executing tool: ${name}`, 'arrow');
    
    try {
      const result = await this.server.executeTool(name, args);
      
      if (result.content) {
        if (Array.isArray(result.content)) {
          const textContent = result.content.find(c => c.type === 'text');
          if (textContent) {
            log('RESULT', textContent.text.substring(0, 200), 'info');
          }
        } else if (typeof result.content === 'string') {
          log('RESULT', result.content.substring(0, 200), 'info');
        }
      }
      
      return result;
    } catch (error) {
      log('EXEC', `Error: ${error.message}`, 'error');
      throw error;
    }
  }

  recordTest(category, testName, passed, details = '') {
    this.results.tests.push({ category, testName, passed, details });
    if (passed) {
      this.results.passed++;
      log('TEST', `${testName}: PASSED`, 'success');
    } else {
      this.results.failed++;
      log('TEST', `${testName}: FAILED - ${details}`, 'error');
    }
  }

  skipTest(category, testName, reason) {
    this.results.tests.push({ category, testName, passed: null, details: reason });
    this.results.skipped++;
    log('TEST', `${testName}: SKIPPED - ${reason}`, 'warning');
  }

  // ===== TEST CATEGORIES =====

  async testNavigation() {
    printSubHeader('Testing Navigation Tools');
    
    // Test: Navigate to URL
    try {
      const result = await this.executeTool('navigate', { url: 'https://example.com' });
      await sleep(2000); // Wait for page load
      
      const hasContent = result.content && result.content.length > 0;
      this.recordTest('Navigation', 'Navigate to URL', hasContent);
    } catch (error) {
      this.recordTest('Navigation', 'Navigate to URL', false, error.message);
    }

    await sleep(1000);
  }

  async testContentReading() {
    printSubHeader('Testing Content Reading Tools');
    
    // Test: read_page
    try {
      const result = await this.executeTool('read_page');
      
      const isValid = result.content && 
        (Array.isArray(result.content) || typeof result.content === 'string');
      
      this.recordTest('Content', 'Read page DOM', isValid);
    } catch (error) {
      this.recordTest('Content', 'Read page DOM', false, error.message);
    }

    await sleep(500);

    // Test: get_page_text
    try {
      const result = await this.executeTool('get_page_text');
      
      const hasText = result.content && result.content.length > 0;
      this.recordTest('Content', 'Get page text', hasText);
    } catch (error) {
      this.recordTest('Content', 'Get page text', false, error.message);
    }

    await sleep(500);
  }

  async testInteraction() {
    printSubHeader('Testing Interaction Tools');
    
    // Test: Screenshot
    try {
      const result = await this.executeTool('computer', { action: 'screenshot' });
      
      // Check if result contains image data
      let hasImage = false;
      if (result.content && Array.isArray(result.content)) {
        hasImage = result.content.some(c => c.type === 'image');
      }
      
      this.recordTest('Interaction', 'Take screenshot', hasImage);
    } catch (error) {
      this.recordTest('Interaction', 'Take screenshot', false, error.message);
    }

    await sleep(500);

    // Test: Scroll
    try {
      const result = await this.executeTool('computer', { 
        action: 'scroll',
        scroll_amount: 100
      });
      
      const success = result.content !== undefined;
      this.recordTest('Interaction', 'Scroll page', success);
    } catch (error) {
      this.recordTest('Interaction', 'Scroll page', false, error.message);
    }

    await sleep(500);
  }

  async testTabManagement() {
    printSubHeader('Testing Tab Management Tools');
    
    // Test: tabs_context_mcp
    try {
      const result = await this.executeTool('tabs_context_mcp');
      
      const hasTabInfo = result.content && result.content.length > 0;
      this.recordTest('Tab Management', 'Get tab context', hasTabInfo);
    } catch (error) {
      this.recordTest('Tab Management', 'Get tab context', false, error.message);
    }

    await sleep(500);

    // Test: tabs_create_mcp
    try {
      const result = await this.executeTool('tabs_create_mcp');
      
      const created = result.content && result.content.length > 0;
      this.recordTest('Tab Management', 'Create new tab', created);
      
      await sleep(1000);
    } catch (error) {
      this.recordTest('Tab Management', 'Create new tab', false, error.message);
    }
  }

  async testDebugging() {
    printSubHeader('Testing Debugging Tools');
    
    // Navigate to a page that generates console messages
    await this.executeTool('navigate', { url: 'https://example.com' });
    await sleep(2000);

    // Test: read_console_messages
    try {
      const result = await this.executeTool('read_console_messages');
      
      // Console messages might be empty, so just check for valid response
      const isValid = result.content !== undefined;
      this.recordTest('Debugging', 'Read console messages', isValid);
    } catch (error) {
      this.recordTest('Debugging', 'Read console messages', false, error.message);
    }

    await sleep(500);

    // Test: read_network_requests
    try {
      const result = await this.executeTool('read_network_requests');
      
      // Network requests should exist for example.com
      const hasRequests = result.content && result.content.length > 0;
      this.recordTest('Debugging', 'Read network requests', hasRequests);
    } catch (error) {
      this.recordTest('Debugging', 'Read network requests', false, error.message);
    }

    await sleep(500);
  }

  async testFormAndFind() {
    printSubHeader('Testing Form & Find Tools');
    
    // Navigate to a page with forms
    await this.executeTool('navigate', { url: 'https://www.google.com' });
    await sleep(2000);

    // Test: find
    try {
      const result = await this.executeTool('find', { query: 'search' });
      
      const foundElements = result.content && 
        (result.content.includes('ref_') || result.content.includes('Found'));
      
      this.recordTest('Form & Find', 'Find elements', foundElements);
    } catch (error) {
      this.recordTest('Form & Find', 'Find elements', false, error.message);
    }

    await sleep(500);

    // Test: form_input (skip if no ref found)
    this.skipTest('Form & Find', 'Fill form input', 'Requires manual ref from find tool');
  }

  async testJavaScript() {
    printSubHeader('Testing JavaScript Execution');
    
    await this.executeTool('navigate', { url: 'https://example.com' });
    await sleep(2000);

    // Test: javascript_tool
    try {
      const result = await this.executeTool('javascript_tool', { 
        code: 'return document.title;'
      });
      
      const hasResult = result.content && result.content.length > 0;
      this.recordTest('JavaScript', 'Execute JavaScript', hasResult);
    } catch (error) {
      this.recordTest('JavaScript', 'Execute JavaScript', false, error.message);
    }

    await sleep(500);
  }

  async testWindowManagement() {
    printSubHeader('Testing Window Management');
    
    // Test: resize_window
    try {
      const result = await this.executeTool('resize_window', { 
        width: 1024,
        height: 768
      });
      
      const success = result.content !== undefined;
      this.recordTest('Window', 'Resize window', success);
    } catch (error) {
      this.recordTest('Window', 'Resize window', false, error.message);
    }

    await sleep(500);
  }

  async testShortcuts() {
    printSubHeader('Testing Shortcuts');
    
    // Test: shortcuts_list
    try {
      const result = await this.executeTool('shortcuts_list');
      
      // Valid even if no shortcuts exist
      const isValid = result.content !== undefined;
      this.recordTest('Shortcuts', 'List shortcuts', isValid);
    } catch (error) {
      this.recordTest('Shortcuts', 'List shortcuts', false, error.message);
    }

    await sleep(500);

    // Skip shortcuts_execute (requires actual shortcuts)
    this.skipTest('Shortcuts', 'Execute shortcut', 'Requires existing shortcuts');
  }

  async testWorkflow() {
    printSubHeader('Testing Workflow Tools');
    
    // Test: update_plan
    try {
      const result = await this.executeTool('update_plan', {
        tasks: [
          { description: 'Test task 1', status: 'pending' },
          { description: 'Test task 2', status: 'pending' }
        ]
      });
      
      const success = result.content !== undefined;
      this.recordTest('Workflow', 'Update plan', success);
    } catch (error) {
      this.recordTest('Workflow', 'Update plan', false, error.message);
    }

    await sleep(500);
  }

  async runAllTests() {
    const connected = await this.initialize();
    if (!connected) {
      console.log('\n❌ Cannot run tests - failed to connect to native host');
      console.log('Make sure:');
      console.log('  1. Native host is running: claude --chrome-native-host');
      console.log('  2. Chrome extension is loaded and active');
      console.log('  3. At least one browser tab is open');
      return;
    }

    console.log('\n⏳ Starting test suite...\n');
    console.log('NOTE: Tests will navigate to different pages and interact with the browser.');
    console.log('      Please do not interact with Chrome while tests are running.\n');

    // Check if stdin is a TTY (interactive)
    if (process.stdin.isTTY) {
      const shouldContinue = await ask('Press Enter to start tests, or Ctrl+C to cancel... ');
    } else {
      console.log('Running in non-interactive mode...\n');
      await sleep(1000);
    }

    try {
      await this.testNavigation();
      await this.testContentReading();
      await this.testInteraction();
      await this.testTabManagement();
      await this.testDebugging();
      await this.testFormAndFind();
      await this.testJavaScript();
      await this.testWindowManagement();
      await this.testShortcuts();
      await this.testWorkflow();
    } catch (error) {
      log('ERROR', `Test suite error: ${error.message}`, 'error');
    }

    this.printSummary();
    
    await this.cleanup();
  }

  printSummary() {
    printHeader('Test Results Summary');
    
    console.log(`✓ Passed:  ${this.results.passed}`);
    console.log(`✗ Failed:  ${this.results.failed}`);
    console.log(`⊘ Skipped: ${this.results.skipped}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Total:   ${this.results.passed + this.results.failed + this.results.skipped}`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => t.passed === false)
        .forEach(t => {
          console.log(`   • ${t.category}: ${t.testName}`);
          console.log(`     ${t.details}`);
        });
    }

    if (this.results.skipped > 0) {
      console.log('\n⊘ Skipped Tests:');
      this.results.tests
        .filter(t => t.passed === null)
        .forEach(t => {
          console.log(`   • ${t.category}: ${t.testName} - ${t.details}`);
        });
    }

    const passRate = this.results.passed / (this.results.passed + this.results.failed) * 100;
    console.log(`\n📊 Pass Rate: ${passRate.toFixed(1)}% (excluding skipped tests)`);
    
    if (passRate === 100) {
      console.log('\n🎉 All tests passed! MCP features are working correctly.');
    } else if (passRate >= 80) {
      console.log('\n✅ Most tests passed. Review failed tests above.');
    } else if (passRate >= 50) {
      console.log('\n⚠️  Some tests failed. Please investigate the failures.');
    } else {
      console.log('\n❌ Many tests failed. Check Chrome extension and native host setup.');
    }
  }

  async cleanup() {
    log('CLEANUP', 'Disconnecting from native host...');
    if (this.server) {
      await this.server.disconnect();
    }
    rl.close();
  }
}

// Run the test suite
const tester = new McpTester();
tester.runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { McpTester };
