#!/usr/bin/env node

/**
 * Test script for MCP SSE (Server-Sent Events) endpoints
 * 
 * This script tests both the GET connection endpoint and POST method call endpoint
 * for the new SSE-based MCP server implementation.
 */

const SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:5000";

async function testSSEConnection() {
  console.log('\n=== Testing MCP SSE Connection (GET /mcp/stream) ===');
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp/stream`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    console.log('Connected to SSE stream...');
    let eventCount = 0;
    const maxEvents = 3; // Limit for testing
    
    while (eventCount < maxEvents) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream ended');
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          console.log(`📡 ${line}`);
        } else if (line.startsWith('data:')) {
          console.log(`📄 ${line}`);
          eventCount++;
        }
      }
    }
    
    reader.releaseLock();
    console.log('✅ SSE connection test completed');
    
  } catch (error) {
    console.error('❌ SSE connection test failed:', error);
  }
}

async function testSSEMethodCall() {
  console.log('\n=== Testing MCP SSE Method Call (POST /mcp/stream) ===');
  
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    console.log('Reading SSE method call response...');
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream ended');
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          console.log(`📡 ${line}`);
        } else if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.substring(5));
            console.log(`📄 Data:`, JSON.stringify(data, null, 2));
          } catch {
            console.log(`📄 ${line}`);
          }
        }
      }
    }
    
    reader.releaseLock();
    console.log('✅ SSE method call test completed');
    
  } catch (error) {
    console.error('❌ SSE method call test failed:', error);
  }
}

async function testTraditionalMCP() {
  console.log('\n=== Testing Traditional MCP (POST /mcp) for comparison ===');
  
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📄 Traditional MCP Response:', JSON.stringify(result, null, 2));
    console.log('✅ Traditional MCP test completed');
    
  } catch (error) {
    console.error('❌ Traditional MCP test failed:', error);
  }
}

async function main() {
  console.log(`🚀 Testing MCP SSE endpoints on ${SERVER_URL}`);
  console.log('Make sure the server is running...');
  
  // Test health endpoint first
  try {
    const healthResponse = await fetch(`${SERVER_URL}/mcp/health`);
    if (!healthResponse.ok) {
      throw new Error('Server not responding');
    }
    console.log('✅ Server is healthy');
  } catch (error) {
    console.error('❌ Server health check failed:', error);
    process.exit(1);
  }
  
  // Run all tests
  await testTraditionalMCP();
  await testSSEConnection();
  await testSSEMethodCall();
  
  console.log('\n🎉 All MCP SSE tests completed!');
  console.log('\nSSE endpoints available:');
  console.log('  GET  /mcp/stream - Establish SSE connection');
  console.log('  POST /mcp/stream - Send MCP method calls via SSE');
  console.log('  GET  /mcp/health - Server health check');
  console.log('  GET  /mcp/info   - Server information');
}

if (require.main === module) {
  main().catch(console.error);
}