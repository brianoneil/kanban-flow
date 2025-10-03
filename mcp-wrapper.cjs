#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');

// Configuration
const MCP_SERVER_URL = 'http://localhost:3000/mcp';

// Buffer for incoming data
let buffer = '';

// Function to make HTTP request to the integrated MCP server
function makeRequest(data, requestId = null) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        // Try to parse as JSON first
        const jsonResponse = JSON.parse(responseData);
        console.log(JSON.stringify(jsonResponse));
      } catch (e) {
        // If not JSON, output as is
        console.log(responseData);
      }
    });
  });

  req.on('error', (err) => {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: `Connection error: ${err.message}. Make sure the Kanban server is running on localhost:3000`
      },
      id: requestId
    }));
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Request timeout. Make sure the Kanban server is running on localhost:3000"
      },
      id: requestId
    }));
  });

  req.write(data);
  req.end();
}

// Handle stdin data
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  
  // Try to parse complete JSON messages
  let lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer
  
  for (let line of lines) {
    line = line.trim();
    if (line) {
      try {
        const request = JSON.parse(line);
        
        // Add capabilities field if missing for initialize requests
        if (request.method === 'initialize' && request.params && !request.params.capabilities) {
          request.params.capabilities = {};
        }
        
        makeRequest(JSON.stringify(request), request.id);
      } catch (e) {
        console.error(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error"
          },
          id: null
        }));
      }
    }
  }
});

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

console.error("Kanban MCP Wrapper running on stdio");
