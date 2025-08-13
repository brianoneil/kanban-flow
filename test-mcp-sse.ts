#!/usr/bin/env node

/**
 * Test script for MCP SSE (Server-Sent Events) endpoints
 * 
 * This script tests both the GET connection endpoint and POST method call endpoint
 * for the new SSE-based MCP server implementation.
 */

const SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:5000";

async function testSSEConnection() {
  console.log('\n=== Testing MCP SSE Connection (GET /mcp with Accept: text/event-stream) ===');
  
  try {
    const response = await fetch(`${SERVER_URL}/mcp`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ SSE connection established');
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    // In a real scenario, we'd read the stream for server-initiated messages
    // For this test, we just verify the connection can be established
    
  } catch (error) {
    console.error('❌ SSE connection test failed:', error);
  }
}

async function testSSEMethodCall() {
  console.log('\n=== Testing MCP SSE Method Call (POST /mcp with Accept: text/event-stream) ===');
  
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
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(testRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('Received SSE response');
      
      if (!response.body) {
        throw new Error('No response body');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream ended');
          break;
        }
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.substring(5));
              console.log(`📄 SSE Data:`, JSON.stringify(data, null, 2));
            } catch {
              console.log(`📄 Raw data: ${line}`);
            }
          } else if (line.trim()) {
            console.log(`📡 SSE Line: ${line}`);
          }
        }
      }
      
      reader.releaseLock();
    } else {
      // JSON response
      const data = await response.json();
      console.log('📄 JSON Response:', JSON.stringify(data, null, 2));
    }
    
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
  
  console.log('\n🎉 All MCP tests completed!');
  console.log('\nMCP Streamable HTTP endpoints:');
  console.log('  GET  /mcp (Accept: text/event-stream) - Listen for server messages');
  console.log('  POST /mcp (Accept: text/event-stream|application/json) - Send requests');
  console.log('  GET  /mcp/health - Server health check');
  console.log('  GET  /mcp/info   - Server information');
}

// Run if this file is executed directly
main().catch(console.error);