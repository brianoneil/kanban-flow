#!/usr/bin/env npx tsx

/**
 * Test MCP integration with project support
 */

const SERVER_URL = 'http://localhost:5000';

async function mcpRequest(method: string, params: any = {}) {
  const response = await fetch(`${SERVER_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`MCP Error: ${data.error.message}`);
  }

  return data.result;
}

async function testGetProjects() {
  console.log('📂 Testing get projects...');
  const result = await mcpRequest('tools/call', {
    name: 'get_projects',
    arguments: {}
  });
  const projects = JSON.parse(result.content[0].text);
  console.log(`✅ Found ${projects.length} projects:`, projects.join(', '));
  return projects;
}

async function testGetCardsByProject(project: string) {
  console.log(`📋 Testing get cards for project: ${project}`);
  const result = await mcpRequest('tools/call', {
    name: 'get_cards',
    arguments: { project }
  });
  const cards = JSON.parse(result.content[0].text);
  console.log(`✅ Found ${cards.length} cards in ${project}`);
  return cards;
}

async function testGetCardsByStatusAndProject(project: string) {
  console.log(`📊 Testing get cards by status for project: ${project}`);
  const result = await mcpRequest('tools/call', {
    name: 'get_cards_by_status',
    arguments: { project }
  });
  const grouped = JSON.parse(result.content[0].text);
  const statusCounts = Object.keys(grouped).map(status => 
    `${status}: ${grouped[status].length}`
  ).join(', ');
  console.log(`✅ Cards by status in ${project}: ${statusCounts}`);
  return grouped;
}

async function testCreateCardInProject(project: string) {
  console.log(`➕ Testing create card in project: ${project}`);
  const result = await mcpRequest('tools/call', {
    name: 'create_card',
    arguments: {
      title: `Test Card for ${project}`,
      description: 'This is a test card created via MCP with project support',
      project: project,
      status: 'not-started'
    }
  });
  console.log('✅ Create card result:', result.content[0].text.split('\n')[0]);
  
  // Extract card ID from response
  const cardData = JSON.parse(result.content[0].text.split(':\n')[1]);
  return cardData.id;
}

async function runProjectTests() {
  console.log('🚀 Testing Kanban MCP with Project Support\n');
  
  try {
    // Test getting all projects
    const projects = await testGetProjects();
    console.log();

    // Test each project
    for (const project of projects.slice(0, 2)) { // Test first 2 projects
      console.log(`\n--- Testing Project: ${project} ---`);
      
      // Get cards for this project
      await testGetCardsByProject(project);
      
      // Get cards by status for this project
      await testGetCardsByStatusAndProject(project);
      
      // Create a test card in this project
      const cardId = await testCreateCardInProject(project);
      
      console.log(`✅ Created test card ${cardId} in ${project}`);
    }

    console.log('\n🎉 All project-based MCP tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runProjectTests();