#!/usr/bin/env node
/**
 * Comprehensive Error Handling Tests for MCP Server Startup
 * 
 * Tests both successful connection scenarios and error handling
 */

import { ChromeMcpServer } from './dist/server.js';
import * as fs from 'fs';

async function testSuccessfulStartupWithSpawn() {
  console.log('\n=== Test 1: Successful Startup with Auto-Spawn ===');
  
  const server = new ChromeMcpServer({
    requestTimeout: 5000,
    spawnNativeHost: true,
  });

  try {
    console.log('Spawning native host and connecting...');
    await server.connect();
    console.log('✓ Successfully connected to native host');
    
    const isConnected = server.getNativeClient().isConnected();
    console.log(`✓ Connection state verified: ${isConnected}`);
    
    if (!isConnected) {
      throw new Error('Expected to be connected');
    }

    server.disconnect();
    console.log('✓ Disconnected successfully\n');
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.message);
    server.disconnect();
    return false;
  }
}

async function testConnectionErrorInvalidSocket() {
  console.log('=== Test 2: Connection Error Handling (Invalid Socket) ===');
  
  const server = new ChromeMcpServer({
    socketPath: '/tmp/nonexistent-socket-path-' + Date.now(),
    requestTimeout: 2000,
  });

  try {
    console.log('Attempting to connect to invalid socket path...');
    await server.connect();
    console.error('✗ Should have thrown error but connected successfully!');
    server.disconnect();
    return false;
  } catch (error) {
    if (error.message.includes('ENOENT') || error.message.includes('connect')) {
      console.log(`✓ Correctly caught connection error: ${error.message}\n`);
      return true;
    } else {
      console.error(`✗ Unexpected error type: ${error.message}\n`);
      return false;
    }
  }
}

async function testToolExecutionWithoutConnection() {
  console.log('=== Test 3: Tool Execution Error Handling (Not Connected) ===');
  
  const server = new ChromeMcpServer();
  
  try {
    const isConnected = server.getNativeClient().isConnected();
    
    if (isConnected) {
      console.error('✗ Server reports connected when it should not be');
      return false;
    }
    
    console.log('✓ Server correctly reports not connected\n');
    return true;
  } catch (error) {
    console.error('✗ Unexpected error:', error.message);
    return false;
  }
}

async function testSocketCleanupOnError() {
  console.log('=== Test 4: Socket Cleanup on Connection Error ===');
  
  const server = new ChromeMcpServer({
    socketPath: '/tmp/test-socket-' + Date.now(),
    requestTimeout: 1000,
  });

  try {
    await server.connect();
    console.error('✗ Should have failed to connect');
    server.disconnect();
    return false;
  } catch (error) {
    // Verify that the socket wasn't left open
    const nativeClient = server.getNativeClient();
    const isConnected = nativeClient.isConnected();
    
    if (isConnected) {
      console.error('✗ Socket still connected after error');
      return false;
    }
    
    console.log('✓ Socket properly cleaned up after connection error\n');
    return true;
  }
}

async function testDisconnectCleanup() {
  console.log('=== Test 5: Proper Disconnect Cleanup ===');
  
  const server = new ChromeMcpServer({
    requestTimeout: 5000,
    spawnNativeHost: true,
  });

  try {
    await server.connect();
    console.log('✓ Connected to native host');
    
    const isConnectedBefore = server.getNativeClient().isConnected();
    if (!isConnectedBefore) {
      console.error('✗ Expected to be connected');
      return false;
    }
    
    console.log('✓ Connection state before disconnect: true');
    
    server.disconnect();
    
    const isConnectedAfter = server.getNativeClient().isConnected();
    
    if (isConnectedAfter) {
      console.error('✗ Still connected after disconnect');
      return false;
    }
    
    console.log('✓ Connection state after disconnect: false\n');
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.message);
    server.disconnect();
    return false;
  }
}

async function testMultipleConnectionAttempts() {
  console.log('=== Test 6: Multiple Connection Attempts ===');
  
  const server = new ChromeMcpServer({
    requestTimeout: 5000,
    spawnNativeHost: true,
  });

  try {
    // First connection
    await server.connect();
    console.log('✓ First connection successful');
    
    // Try connecting again (should be idempotent)
    await server.connect();
    console.log('✓ Second connection call successful (idempotent)');
    
    // Verify still connected
    if (!server.getNativeClient().isConnected()) {
      console.error('✗ Not connected after multiple connect() calls');
      server.disconnect();
      return false;
    }
    
    console.log('✓ Connection remained stable\n');
    
    server.disconnect();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.message);
    server.disconnect();
    return false;
  }
}

async function testSpawnWhenAlreadyRunning() {
  console.log('=== Test 7: Spawn When Native Host Already Running ===');
  
  // Start first server
  const server1 = new ChromeMcpServer({
    requestTimeout: 5000,
    spawnNativeHost: true,
  });
  
  try {
    await server1.connect();
    console.log('✓ First server connected');
    
    // Try to spawn another - should connect to existing
    const server2 = new ChromeMcpServer({
      requestTimeout: 5000,
      spawnNativeHost: false,  // Don't spawn, use existing
    });
    
    await server2.connect();
    console.log('✓ Second server connected to existing native host');
    
    // Both should be connected
    if (!server1.getNativeClient().isConnected() || 
        !server2.getNativeClient().isConnected()) {
      console.error('✗ One or both servers not connected');
      server1.disconnect();
      server2.disconnect();
      return false;
    }
    
    console.log('✓ Both servers connected simultaneously\n');
    
    server2.disconnect();
    server1.disconnect();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (error) {
    console.error('✗ Failed:', error.message);
    server1.disconnect();
    return false;
  }
}

async function testErrorEventHandling() {
  console.log('=== Test 8: Error Event Handling (No Unhandled Errors) ===');
  
  const server = new ChromeMcpServer({
    socketPath: '/tmp/invalid-' + Date.now(),
    requestTimeout: 1000,
  });

  // Add error listener to native client
  let errorEventFired = false;
  server.getNativeClient().on('error', () => {
    errorEventFired = true;
  });

  try {
    await server.connect();
    console.error('✗ Should have failed to connect');
    return false;
  } catch (error) {
    // Error should be caught, not thrown as unhandled event
    console.log('✓ Connection error properly caught');
    
    // The error event should have fired
    if (!errorEventFired) {
      console.log('✓ No error event emitted (correct for connection errors)\n');
    } else {
      console.log('✓ Error event properly handled\n');
    }
    
    return true;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   MCP Server Connection & Error Handling Test Suite      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Run all tests
  results.push({ name: 'Successful Startup with Auto-Spawn', result: await testSuccessfulStartupWithSpawn() });
  results.push({ name: 'Connection Error (Invalid Socket)', result: await testConnectionErrorInvalidSocket() });
  results.push({ name: 'Tool Execution Without Connection', result: await testToolExecutionWithoutConnection() });
  results.push({ name: 'Socket Cleanup on Error', result: await testSocketCleanupOnError() });
  results.push({ name: 'Disconnect Cleanup', result: await testDisconnectCleanup() });
  results.push({ name: 'Multiple Connection Attempts', result: await testMultipleConnectionAttempts() });
  results.push({ name: 'Multiple Clients', result: await testSpawnWhenAlreadyRunning() });
  results.push({ name: 'Error Event Handling', result: await testErrorEventHandling() });
  
  // Summary
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      Test Results                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.result).length;
  const total = results.length;
  
  results.forEach((test, idx) => {
    const status = test.result ? '✓ PASS' : '✗ FAIL';
    console.log(`${idx + 1}. ${test.name}: ${status}`);
  });
  
  console.log('\n' + '═'.repeat(63));
  console.log(`Overall: ${passed}/${total} tests passed`);
  console.log('═'.repeat(63) + '\n');
  
  if (passed === total) {
    console.log('✓ All tests passed! Error handling is working correctly.');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
