#!/usr/bin/env node
/**
 * Test MCP Server Startup with Spawn Native Host
 * 
 * Tests startup when we spawn the native host ourselves
 */

import { ChromeMcpServer } from './dist/server.js';

async function testWithSpawn() {
  console.log('=== Test: MCP Server with Auto-Spawn Native Host ===\n');
  
  const server = new ChromeMcpServer({
    requestTimeout: 10000,
    spawnNativeHost: true,  // Spawn our own native host
  });

  try {
    console.log('Attempting to spawn native host and connect...');
    await server.connect();
    console.log('✓ Successfully spawned native host and connected');
    
    // Verify connection state
    const isConnected = server.getNativeClient().isConnected();
    console.log(`✓ Connection state verified: ${isConnected}`);
    
    if (!isConnected) {
      throw new Error('Expected to be connected but isConnected() returned false');
    }

    console.log('✓ Test passed!');
    
    // Cleanup
    server.disconnect();
    console.log('✓ Disconnected successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error('Full error:', error);
    server.disconnect();
    process.exit(1);
  }
}

testWithSpawn();
