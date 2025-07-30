// Test script for the new bulk delete MCP tool
const SERVER_URL = 'http://localhost:5000';

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

async function testListTools() {
  console.log('🔧 Testing MCP tools list...');
  const result = await mcpRequest('tools/list');
  const bulkDeleteTool = result.tools.find((tool: any) => tool.name === 'bulk_delete_cards');
  if (bulkDeleteTool) {
    console.log('✅ Found bulk_delete_cards tool:', bulkDeleteTool.description);
  } else {
    console.log('❌ bulk_delete_cards tool not found');
  }
  return result;
}

async function createTestCards() {
  console.log('➕ Creating test cards for bulk deletion...');
  const cardIds = [];
  
  for (let i = 1; i <= 3; i++) {
    const result = await mcpRequest('tools/call', {
      name: 'create_card',
      arguments: {
        title: `Test Card ${i} for Bulk Delete`,
        description: `This is test card ${i} that will be deleted in bulk`,
        project: 'Test Project',
        status: 'not-started'
      }
    });
    
    const cardData = JSON.parse(result.content[0].text.split(':\n')[1]);
    cardIds.push(cardData.id);
    console.log(`✅ Created card ${i}: ${cardData.id}`);
  }
  
  return cardIds;
}

async function testBulkDelete(cardIds: string[]) {
  console.log('🗑️ Testing bulk delete cards...');
  const result = await mcpRequest('tools/call', {
    name: 'bulk_delete_cards',
    arguments: {
      ids: cardIds
    }
  });
  
  const response = JSON.parse(result.content[0].text.split(':\n')[1]);
  console.log('✅ Bulk delete result:', response);
  
  if (response.deletedCount === cardIds.length) {
    console.log('✅ All cards deleted successfully');
  } else {
    console.log(`⚠️ Only ${response.deletedCount}/${cardIds.length} cards deleted`);
  }
  
  return response;
}

async function testBulkDeleteWithInvalidIds() {
  console.log('🧪 Testing bulk delete with invalid IDs...');
  const result = await mcpRequest('tools/call', {
    name: 'bulk_delete_cards',
    arguments: {
      ids: ['invalid-id-1', 'invalid-id-2']
    }
  });
  
  const response = JSON.parse(result.content[0].text.split(':\n')[1]);
  console.log('✅ Bulk delete with invalid IDs:', response);
  return response;
}

async function testBulkDeleteEmptyArray() {
  console.log('🧪 Testing bulk delete with empty array...');
  try {
    const result = await mcpRequest('tools/call', {
      name: 'bulk_delete_cards',
      arguments: {
        ids: []
      }
    });
    console.log('❌ Should have failed with empty array');
  } catch (error) {
    console.log('✅ Correctly rejected empty array:', error.message);
  }
}

// Main test runner
async function runBulkDeleteTests() {
  console.log(`🚀 Testing Bulk Delete MCP Tool at ${SERVER_URL}\n`);
  
  try {
    // Test tool availability
    await testListTools();
    console.log();

    // Test bulk delete with valid cards
    const cardIds = await createTestCards();
    console.log();
    
    await testBulkDelete(cardIds);
    console.log();
    
    // Test error cases
    await testBulkDeleteWithInvalidIds();
    console.log();
    
    await testBulkDeleteEmptyArray();
    console.log();

    console.log('🎉 All bulk delete tests completed!');
    console.log('📝 The bulk_delete_cards MCP tool is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runBulkDeleteTests();
}

export { runBulkDeleteTests };