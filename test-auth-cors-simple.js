#!/usr/bin/env node
/**
 * Simple unit test for auth and CORS middleware
 * Tests the configuration logic without requiring Chrome extension
 */

import { UnifiedServer } from './dist/unified-server.js';
import http from 'http';

// Suppress stderr during tests (native host spams disconnected messages)
const originalConsoleError = console.error;
console.error = () => {};

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

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsedBody = null;
        if (body.trim()) {
          try {
            parsedBody = JSON.parse(body);
          } catch (error) {
            // Not JSON, that's okay (e.g., OPTIONS returns "OK")
            parsedBody = body;
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function waitForServer(port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await makeRequest({ hostname: 'localhost', port, path: '/mcp', method: 'OPTIONS' });
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
  return false;
}

async function runTest(testName, testFn) {
  try {
    const result = await testFn();
    if (result) {
      log(`✓ ${testName}`, 'green');
      return true;
    } else {
      log(`✗ ${testName}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${testName}: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Auth & CORS Test Suite', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');

  let totalTests = 0;
  let passedTests = 0;

  // Test 1: Server without authentication
  log('\n--- Test Suite 1: No Authentication ---', 'blue');
  {
    const server = new UnifiedServer({ port: 13101 });
    
    try {
      await server.start();
      const port = server.getPort();
      
      if (await waitForServer(port)) {
        // Test: Request without auth should work
        totalTests++;
        if (await runTest('Allow unauthenticated request', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
          });
          return res.statusCode === 200;
        })) passedTests++;

        // Test: CORS for localhost should work
        totalTests++;
        if (await runTest('CORS allows localhost', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'http://localhost:3000' },
          });
          const allowOrigin = res.headers['access-control-allow-origin'];
          return allowOrigin === 'http://localhost:3000' || allowOrigin === '*';
        })) passedTests++;

        // Test: CORS for external origin should be rejected
        totalTests++;
        if (await runTest('CORS rejects external origin', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'https://evil.example.com' },
          });
          const allowOrigin = res.headers['access-control-allow-origin'];
          return allowOrigin === 'null' || (!allowOrigin?.includes('evil.example.com') && allowOrigin !== '*');
        })) passedTests++;
      }
    } finally {
      server.stop();
    }
  }

  // Test 2: Server with authentication
  log('\n--- Test Suite 2: Bearer Token Authentication ---', 'blue');
  {
    const authToken = 'test-secret-token-xyz123';
    const server = new UnifiedServer({ port: 13102, authToken });
    
    try {
      await server.start();
      const port = server.getPort();
      
      if (await waitForServer(port)) {
        // Test: Request without token should fail
        totalTests++;
        if (await runTest('Reject request without token', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }, { jsonrpc: '2.0', method: 'ping', id: 1 });
          return res.statusCode === 401 && res.headers['www-authenticate']?.includes('Bearer');
        })) passedTests++;

        // Test: Request with wrong token should fail
        totalTests++;
        if (await runTest('Reject request with wrong token', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer wrong-token',
            },
          }, { jsonrpc: '2.0', method: 'ping', id: 1 });
          return res.statusCode === 401;
        })) passedTests++;

        // Test: Request with correct token should work
        totalTests++;
        if (await runTest('Accept request with correct token', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
          }, { jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }, id: 1 });
          return res.statusCode === 200;
        })) passedTests++;

        // Test: OPTIONS preflight should not require auth
        totalTests++;
        if (await runTest('OPTIONS request bypasses auth', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
          });
          return res.statusCode === 200;
        })) passedTests++;
      }
    } finally {
      server.stop();
    }
  }

  // Test 3: Server with custom CORS origins
  log('\n--- Test Suite 3: Custom CORS Origins ---', 'blue');
  {
    const corsOrigins = ['https://app.example.com', 'https://api.example.com'];
    const server = new UnifiedServer({ port: 13103, corsOrigins });
    
    try {
      await server.start();
      const port = server.getPort();
      
      if (await waitForServer(port)) {
        // Test: Allowed origin should work
        totalTests++;
        if (await runTest('CORS allows configured origin', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'https://app.example.com' },
          });
          return res.headers['access-control-allow-origin'] === 'https://app.example.com';
        })) passedTests++;

        // Test: Another allowed origin should work
        totalTests++;
        if (await runTest('CORS allows another configured origin', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'https://api.example.com' },
          });
          return res.headers['access-control-allow-origin'] === 'https://api.example.com';
        })) passedTests++;

        // Test: Non-allowed origin should be rejected
        totalTests++;
        if (await runTest('CORS rejects non-configured origin', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'https://evil.example.com' },
          });
          const allowOrigin = res.headers['access-control-allow-origin'];
          return allowOrigin === 'null' || !allowOrigin?.includes('evil.example.com');
        })) passedTests++;

        // Test: Localhost should be rejected when custom origins are configured
        totalTests++;
        if (await runTest('CORS rejects localhost when custom origins set', async () => {
          const res = await makeRequest({
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
            headers: { 'Origin': 'http://localhost:3000' },
          });
          const allowOrigin = res.headers['access-control-allow-origin'];
          return allowOrigin === 'null' || !allowOrigin?.includes('localhost');
        })) passedTests++;
      }
    } finally {
      server.stop();
    }
  }

  // Summary
  log('\n════════════════════════════════════════════════════', 'cyan');
  log('   Summary', 'cyan');
  log('════════════════════════════════════════════════════', 'cyan');
  log(`\nTotal: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'red');
  log(`Failed: ${totalTests - passedTests}\n`, totalTests - passedTests === 0 ? 'green' : 'red');
  
  if (passedTests === totalTests) {
    log('✓ All tests passed!\n', 'green');
    process.exit(0);
  } else {
    log(`✗ ${totalTests - passedTests} test(s) failed\n`, 'red');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
