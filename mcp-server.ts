#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Default server URL - can be overridden with environment variable
const KANBAN_SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:3000";

/**
 * Kanban MCP Server
 * 
 * Provides AI agents with tools to interact with a Kanban board API:
 * - Get all cards or filter by status
 * - Get cards grouped by status
 * - Get specific card details
 * - Create new cards
 * - Move cards between statuses and positions
 * - Update card properties
 * - Delete cards
 * - Batch move operations
 */

// Create MCP Server instance
const server = new McpServer({
  name: "kanban-integrated-server",
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
    throw new Error(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Register MCP tools using the SDK
server.registerTool(
  "get_projects",
  {
    title: "Get Projects",
    description: "Get all available projects in the Kanban system.",
    inputSchema: {}
  },
  async () => {
    try {
      const projects = await apiRequest("GET", "/api/projects");
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }]
      };
    } catch (error) {
      // Return empty array if server is not running
      return {
        content: [{ type: "text", text: "[]" }]
      };
    }
  }
);

server.registerTool(
  "get_cards",
  {
    title: "Get Cards",
    description: "Get all cards or filter by status. Returns cards sorted by their order within each status.",
    inputSchema: {
      status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).optional().describe("Optional: filter cards by specific status")
    }
  },
  async ({ status }) => {
    const endpoint = status ? `/api/cards?status=${encodeURIComponent(status)}` : "/api/cards";
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
    description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values.",
    inputSchema: {}
  },
  async () => {
    const grouped = await apiRequest("GET", "/api/cards/by-status");
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
    description: "Create a new card in the Kanban board.",
    inputSchema: {
      title: z.string().describe("The title of the card"),
      description: z.string().describe("Detailed description of the card"),
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
    description: "Update properties of an existing card.",
    inputSchema: {
      id: z.string().describe("The ID of the card to update"),
      title: z.string().optional().describe("Optional: new title for the card"),
      description: z.string().optional().describe("Optional: new description for the card"),
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


// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kanban MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});