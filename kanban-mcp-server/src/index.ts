#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Kanban MCP Server
 * 
 * A Model Context Protocol server that provides AI agents with tools to interact with Kanban boards.
 * 
 * Features:
 * - Get all projects and cards
 * - Create, update, and delete cards
 * - Move cards between statuses
 * - Bulk operations for efficiency
 * - Full Markdown support in card descriptions
 * 
 * Environment Variables:
 * - KANBAN_SERVER_URL: URL of the Kanban API server (default: http://localhost:3000)
 */

// Configuration
const KANBAN_SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:3000";

// Create MCP Server instance
const server = new McpServer({
  name: "kanban-mcp-server",
  version: "1.0.0"
});

// Helper function to make API requests
async function apiRequest(method: string, endpoint: string, body?: any): Promise<any> {
  const url = `${KANBAN_SERVER_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    if (response.status === 204) {
      return null; // No content
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      throw new Error(`Cannot connect to Kanban server at ${KANBAN_SERVER_URL}. Make sure the server is running.`);
    }
    throw new Error(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Register MCP tools
server.registerTool(
  "get_projects",
  {
    title: "Get Projects",
    description: "Get all available projects in the Kanban system.",
    inputSchema: {}
  },
  async () => {
    const projects = await apiRequest("GET", "/api/projects");
    return {
      content: [{ type: "text", text: JSON.stringify(projects, null, 2) }]
    };
  }
);

server.registerTool(
  "get_cards",
  {
    title: "Get Cards",
    description: "Get all cards or filter by project and/or status. Returns cards sorted by their order within each status.",
    inputSchema: {
      project: z.string().optional().describe("Optional: filter cards by specific project"),
      status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).optional().describe("Optional: filter cards by specific status")
    }
  },
  async ({ project, status }) => {
    let endpoint = "/api/cards";
    const params = new URLSearchParams();
    
    if (project) params.append("project", project);
    if (status) params.append("status", status);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    const cards = await apiRequest("GET", endpoint);
    return {
      content: [{ type: "text", text: JSON.stringify(cards, null, 2) }]
    };
  }
);

server.registerTool(
  "get_cards_by_status",
  {
    title: "Get Cards by Status",
    description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values, optionally filtered by project.",
    inputSchema: {
      project: z.string().optional().describe("Optional: filter cards by specific project")
    }
  },
  async ({ project }) => {
    let endpoint = "/api/cards/by-status";
    if (project) {
      endpoint += `?project=${encodeURIComponent(project)}`;
    }
    
    const grouped = await apiRequest("GET", endpoint);
    return {
      content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }]
    };
  }
);

server.registerTool(
  "get_card",
  {
    title: "Get Card",
    description: "Get details of a specific card by its ID.",
    inputSchema: {
      id: z.string().describe("The ID of the card to retrieve")
    }
  },
  async ({ id }) => {
    const card = await apiRequest("GET", `/api/cards/${encodeURIComponent(id)}`);
    return {
      content: [{ type: "text", text: JSON.stringify(card, null, 2) }]
    };
  }
);

server.registerTool(
  "create_card",
  {
    title: "Create Card",
    description: "Create a new card in the Kanban board for a specific project. The description field supports full Markdown formatting for better readability and structure.",
    inputSchema: {
      title: z.string().describe("The title of the card - keep concise and descriptive"),
      description: z.string().describe("Detailed description of the card in Markdown format. Use Markdown syntax for better formatting: **bold**, *italic*, `code`, [links](url), bullet lists (- item), numbered lists (1. item), headers (## Header), blockquotes (> quote), code blocks (```language code```), and task lists (- [ ] unchecked, - [x] checked) for enhanced readability and structure. Task lists will automatically show progress bars on cards."),
      project: z.string().describe("The project this card belongs to"),
      link: z.string().optional().describe("Optional: URL link related to the card"),
      status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).default("not-started").describe("The initial status of the card")
    }
  },
  async ({ title, description, project, link, status = "not-started" }) => {
    const cardData = { title, description, project, link, status };
    const card = await apiRequest("POST", "/api/cards", cardData);
    return {
      content: [{ type: "text", text: `Card created successfully:\n${JSON.stringify(card, null, 2)}` }]
    };
  }
);

server.registerTool(
  "move_card",
  {
    title: "Move Card",
    description: "Move a card to a different status and optionally specify its position within that status.",
    inputSchema: {
      id: z.string().describe("The ID of the card to move"),
      status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).describe("The target status to move the card to"),
      position: z.number().optional().describe("Optional: position within the target status (0 = top, omit to add to end)")
    }
  },
  async ({ id, status, position }) => {
    const moveData = { status, position };
    const card = await apiRequest("POST", `/api/cards/${encodeURIComponent(id)}/move`, moveData);
    return {
      content: [{ type: "text", text: `Card moved successfully:\n${JSON.stringify(card, null, 2)}` }]
    };
  }
);

server.registerTool(
  "update_card",
  {
    title: "Update Card",
    description: "Update properties of an existing card. Use Markdown formatting in the description for better readability.",
    inputSchema: {
      id: z.string().describe("The ID of the card to update"),
      title: z.string().optional().describe("Optional: new title for the card"),
      description: z.string().optional().describe("Optional: new description for the card in Markdown format. Use **bold**, *italic*, `code`, lists, headers, blockquotes, code blocks, and task lists (- [ ] unchecked, - [x] checked) for better structure and readability. Task lists will show progress bars."),
      link: z.string().optional().describe("Optional: new link for the card"),
      status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).optional().describe("Optional: new status for the card")
    }
  },
  async ({ id, title, description, link, status }) => {
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (link !== undefined) updates.link = link;
    if (status !== undefined) updates.status = status;
    
    const card = await apiRequest("PATCH", `/api/cards/${encodeURIComponent(id)}`, updates);
    return {
      content: [{ type: "text", text: `Card updated successfully:\n${JSON.stringify(card, null, 2)}` }]
    };
  }
);

server.registerTool(
  "delete_card",
  {
    title: "Delete Card",
    description: "Delete a card from the Kanban board.",
    inputSchema: {
      id: z.string().describe("The ID of the card to delete")
    }
  },
  async ({ id }) => {
    await apiRequest("DELETE", `/api/cards/${encodeURIComponent(id)}`);
    return {
      content: [{ type: "text", text: `Card ${id} deleted successfully` }]
    };
  }
);

server.registerTool(
  "bulk_create_cards",
  {
    title: "Bulk Create Cards",
    description: "Create multiple cards in a single operation. Perfect for breaking down large tasks into smaller cards or creating related cards together.",
    inputSchema: {
      cards: z.array(z.object({
        title: z.string().describe("The title of the card - keep concise and descriptive"),
        description: z.string().describe("Detailed description of the card in Markdown format. Use Markdown syntax for better formatting: **bold**, *italic*, `code`, [links](url), bullet lists (- item), numbered lists (1. item), headers (## Header), blockquotes (> quote), code blocks (```language code```), and task lists (- [ ] unchecked, - [x] checked) for enhanced readability and structure."),
        project: z.string().describe("The project this card belongs to"),
        link: z.string().optional().describe("Optional: URL link related to the card"),
        status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).default("not-started").describe("The initial status of the card")
      })).min(1).max(20).describe("Array of cards to create (maximum 20 cards per request)")
    }
  },
  async ({ cards }) => {
    const createdCards = [];
    const failedCards = [];

    try {
      // Use the bulk create API endpoint for better performance
      const result = await apiRequest("POST", "/api/cards/bulk", { cards });
      
      return {
        content: [{ 
          type: "text", 
          text: `Bulk create completed:\n${JSON.stringify(result, null, 2)}\n\n${result.createdCount > 0 ? `✅ Successfully created ${result.createdCount} cards` : ''}${result.failedCount > 0 ? `\n❌ Failed to create ${result.failedCount} cards` : ''}\n\n💡 UI should automatically refresh via WebSocket messages` 
        }]
      };
    } catch (error) {
      // Fallback to individual card creation if bulk endpoint fails
      console.error("Bulk create API failed, falling back to individual creation:", error);
      
      for (let i = 0; i < cards.length; i++) {
        const cardData = cards[i];
        try {
          const card = await apiRequest("POST", "/api/cards", cardData);
          createdCards.push({
            index: i,
            title: cardData.title,
            card: card
          });
        } catch (error) {
          console.error(`Error creating card "${cardData.title}":`, error);
          failedCards.push({
            index: i,
            title: cardData.title,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

      const fallbackResult = {
        createdCount: createdCards.length,
        createdCards: createdCards.map(c => ({
          title: c.title,
          id: c.card.id,
          status: c.card.status,
          project: c.card.project
        })),
        failedCount: failedCards.length,
        failedCards: failedCards.map(f => ({
          title: f.title,
          error: f.error
        })),
        requestedCount: cards.length
      };

      return {
        content: [{ 
          type: "text", 
          text: `Bulk create completed (fallback mode):\n${JSON.stringify(fallbackResult, null, 2)}\n\n${createdCards.length > 0 ? `✅ Successfully created ${createdCards.length} cards` : ''}${failedCards.length > 0 ? `\n❌ Failed to create ${failedCards.length} cards` : ''}` 
        }]
      };
  }
);

server.registerTool(
  "bulk_delete_cards",
  {
    title: "Bulk Delete Cards",
    description: "Delete multiple cards from the Kanban board by their IDs. This is more efficient than deleting cards one by one.",
    inputSchema: {
      ids: z.array(z.string()).min(1).describe("Array of card IDs to delete")
    }
  },
  async ({ ids }) => {
    const deletedIds = [];
    const failedIds = [];

    for (const id of ids) {
      try {
        await apiRequest("DELETE", `/api/cards/${encodeURIComponent(id)}`);
        deletedIds.push(id);
      } catch (error) {
        console.error(`Error deleting card ${id}:`, error);
        failedIds.push(id);
      }
    }

    const result = {
      deletedCount: deletedIds.length,
      deletedIds,
      failedCount: failedIds.length,
      failedIds,
      requestedCount: ids.length
    };

    return {
      content: [{ type: "text", text: `Bulk delete completed:\n${JSON.stringify(result, null, 2)}` }]
    };
  }
);

server.registerTool(
  "batch_move_cards",
  {
    title: "Batch Move Cards",
    description: "Move multiple cards in a single operation for better performance.",
    inputSchema: {
      operations: z.array(z.object({
        cardId: z.string().describe("The ID of the card to move"),
        status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).describe("The target status"),
        position: z.number().optional().describe("Optional: position within the target status")
      })).describe("Array of move operations to perform")
    }
  },
  async ({ operations }) => {
    const result = await apiRequest("POST", "/api/cards/batch-move", { operations });
    return {
      content: [{ type: "text", text: `Batch move completed:\n${JSON.stringify(result, null, 2)}` }]
    };
  }
);

// CLI handling
function showHelp() {
  console.error(`
Kanban MCP Server v1.1.0

A Model Context Protocol server for Kanban board management.

Usage:
  kanban-mcp-server [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

Environment Variables:
  KANBAN_SERVER_URL  URL of the Kanban API server (default: http://localhost:3000)

Examples:
  # Start the MCP server (connects to localhost:3000 by default)
  kanban-mcp-server

  # Connect to a different Kanban server
  KANBAN_SERVER_URL=http://localhost:8080 kanban-mcp-server

Configuration for Claude Desktop (add to claude_desktop_config.json):
{
  "mcpServers": {
    "kanban": {
      "command": "npx",
      "args": ["kanban-mcp-server"],
      "env": {
        "KANBAN_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}

Available Tools:
  - get_projects: Get all available projects
  - get_cards: Get cards with optional filtering
  - get_cards_by_status: Get cards grouped by status
  - get_card: Get details of a specific card
  - create_card: Create a new card with Markdown support
  - bulk_create_cards: Create multiple cards in one operation
  - move_card: Move a card to a different status
  - update_card: Update card properties
  - delete_card: Delete a card
  - bulk_delete_cards: Delete multiple cards efficiently
  - batch_move_cards: Move multiple cards in one operation

For more information, visit: https://github.com/yourusername/kanban-mcp-server
`);
}

function showVersion() {
  console.error("kanban-mcp-server v1.0.0");
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  showVersion();
  process.exit(0);
}

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Kanban MCP Server v1.1.0 running on stdio`);
    console.error(`Connected to Kanban API at: ${KANBAN_SERVER_URL}`);
  } catch (error) {
    console.error("Failed to start Kanban MCP Server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\nShutting down Kanban MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down Kanban MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
