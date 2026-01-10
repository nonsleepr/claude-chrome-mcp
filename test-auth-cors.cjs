#!/usr/bin/env node
/**
 * Test script for authentication and CORS features
 * 
 * Tests:
 * 1. Server without auth - should allow unauthenticated requests
 * 2. Server with auth - should reject requests without token
 * 3. Server with auth - should accept requests with correct token
 * 4. Server with auth - should reject requests with wrong token
 * 5. CORS headers - should allow configured origins
 * 6. CORS headers - should reject non-configured origins
 */

const http = require('http');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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
          body: body ? JSON.parse(body) : null,
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

async function testServerWithoutAuth(port) {
  log('\n=== Test 1: Server WITHOUT Authentication ===', 'cyan');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      id: 1,
    });

    if (response.statusCode === 200) {
      log('✓ PASS: Request without auth token accepted (no auth required)', 'green');
      return true;
    } else {
      log(`✗ FAIL: Unexpected status code ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return false;
  }
}

async function testServerWithAuthNoToken(port) {
  log('\n=== Test 2: Server WITH Authentication - No Token ===', 'cyan');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      id: 1,
    });

    if (response.statusCode === 401) {
      const wwwAuth = response.headers['www-authenticate'];
      if (wwwAuth && wwwAuth.includes('Bearer')) {
        log('✓ PASS: Request rejected with 401 and WWW-Authenticate header', 'green');
        log(`  WWW-Authenticate: ${wwwAuth}`, 'blue');
        return true;
      } else {
        log('✗ FAIL: Missing or incorrect WWW-Authenticate header', 'red');
        return false;
      }
    } else {
      log(`✗ FAIL: Expected 401, got ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return false;
  }
}

async function testServerWithAuthCorrectToken(port, token) {
  log('\n=== Test 3: Server WITH Authentication - Correct Token ===', 'cyan');
  
  try {
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
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      id: 1,
    });

    if (response.statusCode === 200) {
      log('✓ PASS: Request accepted with correct Bearer token', 'green');
      return true;
    } else {
      log(`✗ FAIL: Expected 200, got ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return false;
  }
}

async function testServerWithAuthWrongToken(port) {
  log('\n=== Test 4: Server WITH Authentication - Wrong Token ===', 'cyan');
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong-token-12345',
      },
    }, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
      id: 1,
    });

    if (response.statusCode === 401) {
      log('✓ PASS: Request rejected with wrong Bearer token', 'green');
      return true;
    } else {
      log(`✗ FAIL: Expected 401, got ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return false;
  }
}

async function testCorsHeaders(port, origin, shouldAllow) {
  log(`\n=== Test CORS: Origin "${origin}" (should ${shouldAllow ? 'allow' : 'reject'}) ===`, 'cyan');
  
  try {
    // First, test OPTIONS preflight request
    const optionsResponse = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    if (optionsResponse.statusCode === 200) {
      const allowOrigin = optionsResponse.headers['access-control-allow-origin'];
      const allowMethods = optionsResponse.headers['access-control-allow-methods'];
      
      log(`  OPTIONS response status: ${optionsResponse.statusCode}`, 'blue');
      log(`  Access-Control-Allow-Origin: ${allowOrigin}`, 'blue');
      log(`  Access-Control-Allow-Methods: ${allowMethods}`, 'blue');

      if (shouldAllow) {
        if (allowOrigin === origin || allowOrigin === '*') {
          log('✓ PASS: Origin allowed in CORS headers', 'green');
          return true;
        } else {
          log(`✗ FAIL: Origin not properly allowed (got: ${allowOrigin})`, 'red');
          return false;
        }
      } else {
        if (allowOrigin === 'null' || (!allowOrigin.includes(origin) && allowOrigin !== '*')) {
          log('✓ PASS: Origin correctly rejected in CORS headers', 'green');
          return true;
        } else {
          log(`✗ FAIL: Origin should have been rejected (got: ${allowOrigin})`, 'red');
          return false;
        }
      }
    } else {
      log(`✗ FAIL: OPTIONS request failed with status ${optionsResponse.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ FAIL: ${error.message}`, 'red');
    return false;
  }
}

async function waitForServer(port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest({
        hostname: 'localhost',
        port,
        path: '/mcp',
        method: 'OPTIONS',
      });
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  return false;
}

async function main() {
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Authentication and CORS Test Suite', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');
  
  const tests = [
    {
      name: 'Server without authentication',
      port: 3457,
      args: ['--port', '3457'],
      tests: [
        { fn: testServerWithoutAuth, args: [3457] },
        { fn: testCorsHeaders, args: [3457, 'http://localhost:3000', true] },
        { fn: testCorsHeaders, args: [3457, 'https://evil.example.com', false] },
      ],
    },
    {
      name: 'Server with authentication',
      port: 3458,
      token: 'test-secret-token-abc123',
      args: ['--port', '3458', '--auth-token', 'test-secret-token-abc123'],
      tests: [
        { fn: testServerWithAuthNoToken, args: [3458] },
        { fn: testServerWithAuthWrongToken, args: [3458] },
        { fn: testServerWithAuthCorrectToken, args: [3458, 'test-secret-token-abc123'] },
      ],
    },
    {
      name: 'Server with specific CORS origins',
      port: 3459,
      args: ['--port', '3459', '--cors-origins', 'https://app.example.com,https://other.example.com'],
      tests: [
        { fn: testCorsHeaders, args: [3459, 'https://app.example.com', true] },
        { fn: testCorsHeaders, args: [3459, 'https://other.example.com', true] },
        { fn: testCorsHeaders, args: [3459, 'https://evil.example.com', false] },
        { fn: testCorsHeaders, args: [3459, 'http://localhost:3000', false] },
      ],
    },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testGroup of tests) {
    log(`\n${'═'.repeat(60)}`, 'yellow');
    log(`Starting: ${testGroup.name}`, 'yellow');
    log(`${'═'.repeat(60)}`, 'yellow');

    // Note: In a real test, we would spawn the server here
    // For now, we'll just log that the user should start it manually
    log(`\nPlease start the server manually in another terminal:`, 'yellow');
    log(`  node dist/cli.js ${testGroup.args.join(' ')}`, 'blue');
    log(`\nPress Enter when server is ready...`, 'yellow');
    
    // Wait for user input
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });

    log(`\nWaiting for server on port ${testGroup.port}...`, 'blue');
    const serverReady = await waitForServer(testGroup.port);
    
    if (!serverReady) {
      log(`✗ Server on port ${testGroup.port} is not responding`, 'red');
      log('Skipping tests for this configuration', 'yellow');
      continue;
    }

    log('✓ Server is ready\n', 'green');

    // Run tests
    for (const test of testGroup.tests) {
      totalTests++;
      const result = await test.fn(...test.args);
      if (result) {
        passedTests++;
      }
    }

    log(`\nPlease stop the server (Ctrl+C in the server terminal)`, 'yellow');
    log('Press Enter to continue...', 'yellow');
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });
  }

  // Summary
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Test Summary', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');
  log(`\nTotal tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red');
  
  if (passedTests === totalTests) {
    log('\n✓ All tests passed!', 'green');
    process.exit(0);
  } else {
    log(`\n✗ ${totalTests - passedTests} test(s) failed`, 'red');
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
