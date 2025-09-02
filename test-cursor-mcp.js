// Test script to mimic Cursor's MCP connection sequence
import https from 'https';

function makeRequest(method, params = {}, id = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      ...(id !== null && { id })
    });

    const options = {
      hostname: 'kanban-flow-boneil.replit.app',
      port: 443,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'cursor-mcp-test/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      console.log(`${method} - Status: ${res.statusCode}`);
      console.log(`${method} - Headers:`, res.headers);
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

async function testMCPSequence() {
  try {
    console.log('=== Testing MCP Connection Sequence ===');
    
    // Step 1: Initialize
    console.log('\n1. Initialize...');
    const initResponse = await makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'cursor', version: '0.42.0' }
    }, 1);
    console.log('Initialize Response:', JSON.stringify(initResponse, null, 2));
    
    // Step 2: Send initialized notification
    console.log('\n2. Send initialized notification...');
    try {
      const notifyResponse = await makeRequest('notifications/initialized', {});
      console.log('Initialized notification response:', notifyResponse);
    } catch (e) {
      console.log('Initialized notification result:', e.message);
    }
    
    // Step 3: List tools
    console.log('\n3. List tools...');
    const toolsResponse = await makeRequest('tools/list', {}, 2);
    console.log('Tools Response:', JSON.stringify(toolsResponse, null, 2));
    
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log(`\n✅ Found ${toolsResponse.result.tools.length} tools:`);
      toolsResponse.result.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    }
    
    console.log('\n=== MCP Connection Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMCPSequence();