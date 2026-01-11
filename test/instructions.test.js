#!/usr/bin/env node
/**
 * Unit test for server instructions
 * Validates that instructions exist and contain critical guidance
 */

import { SERVER_INSTRUCTIONS } from '../dist/instructions.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, message) {
  if (!condition) {
    log(`✗ FAIL: ${message}`, 'red');
    process.exit(1);
  }
  log(`✓ ${message}`, 'green');
}

async function runTests() {
  log('\n========================================', 'cyan');
  log('Testing Server Instructions', 'cyan');
  log('========================================\n', 'cyan');

  // Test 1: Instructions exist and are non-empty
  log('Test 1: Instructions exist and are non-empty', 'blue');
  assert(
    SERVER_INSTRUCTIONS !== undefined && SERVER_INSTRUCTIONS !== null,
    'SERVER_INSTRUCTIONS is defined'
  );
  assert(
    typeof SERVER_INSTRUCTIONS === 'string',
    'SERVER_INSTRUCTIONS is a string'
  );
  assert(
    SERVER_INSTRUCTIONS.length > 0,
    'SERVER_INSTRUCTIONS is not empty'
  );
  log(`  Instructions length: ${SERVER_INSTRUCTIONS.length} characters\n`, 'cyan');

  // Test 2: Instructions are comprehensive (~600+ words)
  log('Test 2: Instructions are comprehensive', 'blue');
  const wordCount = SERVER_INSTRUCTIONS.split(/\s+/).length;
  assert(
    wordCount >= 500,
    `Instructions contain at least 500 words (found ${wordCount})`
  );
  log(`  Word count: ${wordCount} words\n`, 'cyan');

  // Test 3: Instructions contain critical guidance topics
  log('Test 3: Instructions contain critical guidance topics', 'blue');
  
  const requiredTopics = [
    { keyword: 'gif', description: 'GIF recording guidance' },
    { keyword: 'console', description: 'Console debugging guidance' },
    { keyword: 'alert', description: 'Alert/dialog warnings' },
    { keyword: 'dialog', description: 'Dialog handling' },
    { keyword: 'tab', description: 'Tab management' },
    { keyword: 'timeout', description: 'Timeout behavior' },
    { keyword: 'pattern', description: 'Console pattern filtering' },
    { keyword: 'workflow', description: 'Cross-tool workflows' },
  ];

  for (const topic of requiredTopics) {
    const found = SERVER_INSTRUCTIONS.toLowerCase().includes(topic.keyword.toLowerCase());
    assert(
      found,
      `Instructions include guidance about: ${topic.description}`
    );
  }
  log('');

  // Test 4: Instructions contain specific best practices
  log('Test 4: Instructions contain specific best practices', 'blue');
  
  const bestPractices = [
    { pattern: /capture extra frames/i, description: 'GIF recording frame capture advice' },
    { pattern: /60.{0,20}second/i, description: 'Tool timeout information' },
    { pattern: /automatically|auto-initializ/i, description: 'Auto-initialization mention' },
    { pattern: /read_console_messages/i, description: 'Console reading tool reference' },
  ];

  for (const practice of bestPractices) {
    const found = practice.pattern.test(SERVER_INSTRUCTIONS);
    assert(
      found,
      `Instructions include: ${practice.description}`
    );
  }
  log('');

  // Test 5: Instructions warn against dangerous patterns
  log('Test 5: Instructions warn against dangerous patterns', 'blue');
  
  const warnings = [
    { pattern: /do not|don't|never/i, description: 'Contains explicit warnings (DO NOT/NEVER)' },
    { pattern: /block.*events|freeze/i, description: 'Warns about blocking dialogs' },
  ];

  for (const warning of warnings) {
    const found = warning.pattern.test(SERVER_INSTRUCTIONS);
    assert(
      found,
      `Instructions include warning: ${warning.description}`
    );
  }
  log('');

  // Test 6: Instructions mention key tools
  log('Test 6: Instructions mention key tools', 'blue');
  
  const keyTools = [
    'navigate',
    'computer',
    'read_page',
    'find',
    'form_input',
    'javascript_tool',
    'tabs_create',
  ];

  for (const tool of keyTools) {
    const found = SERVER_INSTRUCTIONS.includes(tool);
    assert(
      found,
      `Instructions reference tool: ${tool}`
    );
  }
  log('');

  log('========================================', 'green');
  log('All Server Instructions Tests Passed! ✓', 'green');
  log('========================================\n', 'green');
}

// Run tests
runTests().catch((error) => {
  log(`\n✗ Test execution failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
