#!/usr/bin/env node

/**
 * Local MCP Proxy for Claude Desktop
 * 
 * This script acts as a stdio MCP server that proxies requests to the HTTP MCP endpoint.
 * This solves Claude Desktop's HTTP transport compatibility issues.
 */

const SERVER_URL = 'https://kanban-flow-boneil.replit.app/mcp';

// Simple stdio MCP server implementation
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  // Process complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line.trim());
        await handleRequest(request);
      } catch (error) {
        console.error('Error parsing request:', error.message);
      }
    }
  }
});

async function handleRequest(request) {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });
    
    const result = await response.json();
    
    // Send response via stdout
    process.stdout.write(JSON.stringify(result) + '\n');
    
  } catch (error) {
    // Send error response
    const errorResponse = {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: `Proxy error: ${error.message}`
      }
    };
    
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Keep the process alive
process.stdin.resume();