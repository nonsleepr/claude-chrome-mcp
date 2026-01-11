#!/usr/bin/env node
/**
 * Quick automated test for authentication and CORS
 * This version spawns servers automatically for testing
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body ? (body.trim() ? JSON.parse(body) : null) : null,
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function waitForServer(port, maxAttempts = 30) {
  log(`  Waiting for server on port ${port}...`, 'blue');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest({
        hostname: 'localhost',
        port,
        path: '/mcp',
        method: 'OPTIONS',
      });
      log(`  ✓ Server ready on port ${port}`, 'green');
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  log(`  ✗ Server on port ${port} did not start`, 'red');
  return false;
}

async function testWithoutAuth(port) {
  log('\n=== Test 1: Server WITHOUT Authentication ===', 'cyan');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
    id: 1,
  });

  if (response.statusCode === 200) {
    log('✓ PASS: Unauthenticated request accepted', 'green');
    return true;
  }
  log(`✗ FAIL: Expected 200, got ${response.statusCode}`, 'red');
  return false;
}

async function testAuthNoToken(port) {
  log('\n=== Test 2: Server WITH Auth - No Token ===', 'cyan');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
    id: 1,
  });

  if (response.statusCode === 401 && response.headers['www-authenticate']?.includes('Bearer')) {
    log('✓ PASS: Request rejected with 401 and WWW-Authenticate header', 'green');
    return true;
  }
  log(`✗ FAIL: Expected 401 with WWW-Authenticate, got ${response.statusCode}`, 'red');
  return false;
}

async function testAuthCorrectToken(port, token) {
  log('\n=== Test 3: Server WITH Auth - Correct Token ===', 'cyan');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
    id: 1,
  });

  if (response.statusCode === 200) {
    log('✓ PASS: Request accepted with correct token', 'green');
    return true;
  }
  log(`✗ FAIL: Expected 200, got ${response.statusCode}`, 'red');
  return false;
}

async function testAuthWrongToken(port) {
  log('\n=== Test 4: Server WITH Auth - Wrong Token ===', 'cyan');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer wrong-token',
    },
  }, {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
    id: 1,
  });

  if (response.statusCode === 401) {
    log('✓ PASS: Request rejected with wrong token', 'green');
    return true;
  }
  log(`✗ FAIL: Expected 401, got ${response.statusCode}`, 'red');
  return false;
}

async function testCors(port, origin, shouldAllow) {
  log(`\n=== Test CORS: "${origin}" (expect ${shouldAllow ? 'allow' : 'reject'}) ===`, 'cyan');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/mcp',
    method: 'OPTIONS',
    headers: {
      'Origin': origin,
      'Access-Control-Request-Method': 'POST',
    },
  });

  const allowOrigin = response.headers['access-control-allow-origin'];
  log(`  Access-Control-Allow-Origin: ${allowOrigin}`, 'blue');

  if (shouldAllow) {
    if (allowOrigin === origin || allowOrigin === '*') {
      log('✓ PASS: Origin allowed', 'green');
      return true;
    }
  } else {
    if (allowOrigin === 'null' || (!allowOrigin?.includes(origin) && allowOrigin !== '*')) {
      log('✓ PASS: Origin rejected', 'green');
      return true;
    }
  }
  
  log(`✗ FAIL: Unexpected CORS result`, 'red');
  return false;
}

async function runServerTests(name, args, tests) {
  log(`\n${'═'.repeat(60)}`, 'yellow');
  log(`Testing: ${name}`, 'yellow');
  log(`Command: node dist/cli.js ${args.join(' ')}`, 'blue');
  log(`${'═'.repeat(60)}`, 'yellow');

  // Spawn server (suppress stdout/stderr to reduce noise)
  const server = spawn('node', ['dist/cli.js', ...args], {
    stdio: ['ignore', 'ignore', 'pipe'], // Capture stderr only
  });

  let serverOutput = '';
  server.stderr.on('data', (data) => {
    serverOutput += data.toString();
  });

  // Extract port from args
  const portIndex = args.indexOf('--port');
  const port = portIndex >= 0 ? parseInt(args[portIndex + 1]) : 3456;

  // Wait for server to start
  const ready = await waitForServer(port);
  if (!ready) {
    server.kill();
    log('✗ Server failed to start', 'red');
    return { total: tests.length, passed: 0 };
  }

  // Run tests
  let passed = 0;
  for (const test of tests) {
    try {
      const result = await test.fn(...test.args);
      if (result) passed++;
    } catch (error) {
      log(`✗ Test error: ${error.message}`, 'red');
    }
  }

  // Kill server
  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for cleanup

  return { total: tests.length, passed };
}

async function main() {
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Auth & CORS Automated Test Suite', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');

  const testSuites = [
    {
      name: 'No authentication',
      args: ['--port', '13001'],
      tests: [
        { fn: testWithoutAuth, args: [13001] },
        { fn: testCors, args: [13001, 'http://localhost:3000', true] },
        { fn: testCors, args: [13001, 'https://evil.com', false] },
      ],
    },
    {
      name: 'Bearer token authentication',
      args: ['--port', '13002', '--auth-token', 'secret-xyz-789'],
      tests: [
        { fn: testAuthNoToken, args: [13002] },
        { fn: testAuthWrongToken, args: [13002] },
        { fn: testAuthCorrectToken, args: [13002, 'secret-xyz-789'] },
      ],
    },
    {
      name: 'Custom CORS origins',
      args: ['--port', '13003', '--cors-origins', 'https://app.example.com,https://api.example.com'],
      tests: [
        { fn: testCors, args: [13003, 'https://app.example.com', true] },
        { fn: testCors, args: [13003, 'https://api.example.com', true] },
        { fn: testCors, args: [13003, 'https://evil.com', false] },
        { fn: testCors, args: [13003, 'http://localhost:3000', false] },
      ],
    },
  ];

  let totalTests = 0;
  let totalPassed = 0;

  for (const suite of testSuites) {
    const result = await runServerTests(suite.name, suite.args, suite.tests);
    totalTests += result.total;
    totalPassed += result.passed;
  }

  // Summary
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Summary', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');
  log(`\nTotal: ${totalTests}`, 'blue');
  log(`Passed: ${totalPassed}`, totalPassed === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - totalPassed}`, totalTests - totalPassed === 0 ? 'green' : 'red');
  
  if (totalPassed === totalTests) {
    log('\n✓ All tests passed!', 'green');
    process.exit(0);
  } else {
    log(`\n✗ ${totalTests - totalPassed} test(s) failed`, 'red');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
