#!/usr/bin/env tsx

/**
 * Kanban MCP Remote Server Test Client
 * 
 * This script tests the remote MCP server by making direct HTTP requests
 * to verify all tools are working correctly.
 */

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

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

  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
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
  console.log('🏥 Testing health check...');
  const response = await fetch(`${MCP_SERVER_URL}/health`);
  const health = await response.json();
  console.log('✅ Health check:', health);
  return health;
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
  console.log('✅ Get cards result:', result.content[0].text.substring(0, 100) + '...');
  return result;
}

async function testCreateCard() {
  console.log('➕ Testing create card...');
  const result = await mcpRequest('tools/call', {
    name: 'create_card',
    arguments: {
      title: `Test Card ${Date.now()}`,
      description: 'This is a test card created via MCP',
      status: 'not-started'
    }
  });
  console.log('✅ Create card result:', result.content[0].text);
  
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
  console.log('✅ Move card result:', result.content[0].text);
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
  console.log(`🚀 Testing Kanban MCP Remote Server at ${MCP_SERVER_URL}\n`);
  
  try {
    // Test health check
    await testHealthCheck();
    console.log();

    // Test list tools
    await testListTools();
    console.log();

    // Test get cards
    await testGetCards();
    console.log();

    // Test create card
    const cardId = await testCreateCard();
    console.log();

    // Test move card
    await testMoveCard(cardId);
    console.log();

    // Test delete card
    await testDeleteCard(cardId);
    console.log();

    console.log('🎉 All tests passed! MCP Remote Server is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}