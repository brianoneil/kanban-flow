#!/usr/bin/env tsx

/**
 * Kanban MCP Integrated Server Test Suite
 * 
 * Tests the integrated MCP server endpoints that are part of the main Kanban application.
 * This version runs on the same port as the main app (5000) under the /mcp path.
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

interface McpRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface McpResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

// Helper function to make MCP requests
async function mcpRequest(method: string, params?: any): Promise<any> {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  };

  const response = await fetch(`${SERVER_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data: McpResponse = await response.json();
  
  if (data.error) {
    throw new Error(`MCP Error: ${data.error.message}`);
  }

  return data.result;
}

// Test functions
async function testHealthCheck() {
  console.log('🏥 Testing MCP health check...');
  const response = await fetch(`${SERVER_URL}/mcp/health`);
  const health = await response.json();
  console.log('✅ Health check:', health.status, '- Server:', health.mcpServer);
  return health;
}

async function testServerInfo() {
  console.log('📋 Testing MCP server info...');
  const response = await fetch(`${SERVER_URL}/mcp/info`);
  const info = await response.json();
  console.log(`✅ Server info: ${info.name} v${info.version} with ${info.tools.length} tools`);
  return info;
}

async function testListTools() {
  console.log('🔧 Testing list tools...');
  const result = await mcpRequest('tools/list');
  console.log(`✅ Found ${result.tools.length} tools:`);
  result.tools.forEach((tool: any) => {
    console.log(`   • ${tool.name}: ${tool.description}`);
  });
  return result.tools;
}

async function testGetCards() {
  console.log('📋 Testing get cards...');
  const result = await mcpRequest('tools/call', {
    name: 'get_cards',
    arguments: {}
  });
  const cards = JSON.parse(result.content[0].text);
  console.log(`✅ Retrieved ${cards.length} cards`);
  return cards;
}

async function testGetCardsByStatus() {
  console.log('📊 Testing get cards by status...');
  const result = await mcpRequest('tools/call', {
    name: 'get_cards_by_status',
    arguments: {}
  });
  const grouped = JSON.parse(result.content[0].text);
  const statusCounts = Object.keys(grouped).map(status => 
    `${status}: ${grouped[status].length}`
  ).join(', ');
  console.log(`✅ Cards by status: ${statusCounts}`);
  return grouped;
}

async function testCreateCard() {
  console.log('➕ Testing create card...');
  const result = await mcpRequest('tools/call', {
    name: 'create_card',
    arguments: {
      title: `Test Card ${Date.now()}`,
      description: 'This is a test card created via integrated MCP',
      status: 'not-started'
    }
  });
  console.log('✅ Create card result:', result.content[0].text.split('\n')[0]);
  
  // Extract card ID from response
  const cardData = JSON.parse(result.content[0].text.split(':\n')[1]);
  return cardData.id;
}

async function testMoveCard(cardId: string) {
  console.log('🔄 Testing move card...');
  const result = await mcpRequest('tools/call', {
    name: 'move_card',
    arguments: {
      id: cardId,
      status: 'in-progress',
      position: 0
    }
  });
  console.log('✅ Move card result:', result.content[0].text.split('\n')[0]);
  return result;
}

async function testUpdateCard(cardId: string) {
  console.log('✏️ Testing update card...');
  const result = await mcpRequest('tools/call', {
    name: 'update_card',
    arguments: {
      id: cardId,
      title: 'Updated Test Card',
      description: 'This card has been updated via MCP'
    }
  });
  console.log('✅ Update card result:', result.content[0].text.split('\n')[0]);
  return result;
}

async function testGetCard(cardId: string) {
  console.log('🔍 Testing get specific card...');
  const result = await mcpRequest('tools/call', {
    name: 'get_card',
    arguments: {
      id: cardId
    }
  });
  const card = JSON.parse(result.content[0].text);
  console.log(`✅ Retrieved card: "${card.title}" - ${card.status}`);
  return card;
}

async function testBatchMove(cardId: string) {
  console.log('📦 Testing batch move cards...');
  const result = await mcpRequest('tools/call', {
    name: 'batch_move_cards',
    arguments: {
      operations: [
        { cardId, status: 'complete', position: 0 }
      ]
    }
  });
  console.log('✅ Batch move result:', result.content[0].text.split('\n')[0]);
  return result;
}

async function testDeleteCard(cardId: string) {
  console.log('🗑️ Testing delete card...');
  const result = await mcpRequest('tools/call', {
    name: 'delete_card',
    arguments: {
      id: cardId
    }
  });
  console.log('✅ Delete card result:', result.content[0].text);
  return result;
}

// Main test runner
async function runTests() {
  console.log(`🚀 Testing Kanban MCP Integrated Server at ${SERVER_URL}\n`);
  
  try {
    // Test health and info endpoints
    await testHealthCheck();
    await testServerInfo();
    console.log();

    // Test MCP protocol endpoints
    await testListTools();
    console.log();

    // Test card operations
    await testGetCards();
    await testGetCardsByStatus();
    console.log();

    // Test card lifecycle
    const cardId = await testCreateCard();
    await testMoveCard(cardId);
    await testUpdateCard(cardId);
    await testGetCard(cardId);
    await testBatchMove(cardId);
    await testDeleteCard(cardId);
    console.log();

    console.log('🎉 All tests passed! Integrated MCP Server is working correctly.');
    console.log('🔗 The MCP server is fully integrated with the Kanban application.');
    console.log('📡 AI agents can now access the MCP endpoints at the same URL as the web app.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}