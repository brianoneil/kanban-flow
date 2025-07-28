#!/usr/bin/env node

import {
  Tool,
  CallToolRequest,
  CallToolResult,
  TextContent,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";

// Configuration
const MCP_PORT = parseInt(process.env.MCP_PORT || "3001");
const KANBAN_SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:5000";

/**
 * Remote Kanban MCP Server
 * 
 * Provides AI agents with HTTP-accessible tools to interact with a Kanban board API.
 * This version runs as a standalone HTTP server with REST API endpoints.
 */

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

// Tool definitions (same as stdio version)
const tools: Tool[] = [
  {
    name: "get_cards",
    description: "Get all cards or filter by status. Returns cards sorted by their order within each status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["not-started", "blocked", "in-progress", "complete", "verified"],
          description: "Optional: filter cards by specific status"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_cards_by_status",
    description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "get_card",
    description: "Get details of a specific card by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the card to retrieve"
        }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "create_card",
    description: "Create a new card in the Kanban board.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the card"
        },
        description: {
          type: "string",
          description: "Detailed description of the card"
        },
        link: {
          type: "string",
          description: "Optional: URL link related to the card"
        },
        status: {
          type: "string",
          enum: ["not-started", "blocked", "in-progress", "complete", "verified"],
          description: "The initial status of the card",
          default: "not-started"
        }
      },
      required: ["title", "description"],
      additionalProperties: false
    }
  },
  {
    name: "move_card",
    description: "Move a card to a different status and optionally specify its position within that status.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the card to move"
        },
        status: {
          type: "string",
          enum: ["not-started", "blocked", "in-progress", "complete", "verified"],
          description: "The target status to move the card to"
        },
        position: {
          type: "number",
          description: "Optional: position within the target status (0 = top, omit to add to end)"
        }
      },
      required: ["id", "status"],
      additionalProperties: false
    }
  },
  {
    name: "update_card",
    description: "Update properties of an existing card.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the card to update"
        },
        title: {
          type: "string",
          description: "Optional: new title for the card"
        },
        description: {
          type: "string",
          description: "Optional: new description for the card"
        },
        link: {
          type: "string",
          description: "Optional: new link for the card"
        },
        status: {
          type: "string",
          enum: ["not-started", "blocked", "in-progress", "complete", "verified"],
          description: "Optional: new status for the card"
        }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "delete_card",
    description: "Delete a card from the Kanban board.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the card to delete"
        }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "batch_move_cards",
    description: "Move multiple cards in a single operation for better performance.",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cardId: {
                type: "string",
                description: "The ID of the card to move"
              },
              status: {
                type: "string",
                enum: ["not-started", "blocked", "in-progress", "complete", "verified"],
                description: "The target status"
              },
              position: {
                type: "number",
                description: "Optional: position within the target status"
              }
            },
            required: ["cardId", "status"],
            additionalProperties: false
          },
          description: "Array of move operations to perform"
        }
      },
      required: ["operations"],
      additionalProperties: false
    }
  }
];

// Tool execution function
async function executeTool(name: string, args: any): Promise<CallToolResult> {
  try {
    switch (name) {
      case "get_cards": {
        const { status } = args as { status?: string };
        const endpoint = status ? `/api/cards?status=${encodeURIComponent(status)}` : "/api/cards";
        const cards = await apiRequest("GET", endpoint);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(cards, null, 2)
            } as TextContent
          ]
        };
      }
      
      case "get_cards_by_status": {
        const grouped = await apiRequest("GET", "/api/cards/by-status");
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(grouped, null, 2)
            } as TextContent
          ]
        };
      }
      
      case "get_card": {
        const { id } = args as { id: string };
        const card = await apiRequest("GET", `/api/cards/${encodeURIComponent(id)}`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(card, null, 2)
            } as TextContent
          ]
        };
      }
      
      case "create_card": {
        const { title, description, link, status = "not-started" } = args as {
          title: string;
          description: string;
          link?: string;
          status?: string;
        };
        
        const cardData = { title, description, link, status };
        const card = await apiRequest("POST", "/api/cards", cardData);
        
        return {
          content: [
            {
              type: "text",
              text: `Card created successfully:\n${JSON.stringify(card, null, 2)}`
            } as TextContent
          ]
        };
      }
      
      case "move_card": {
        const { id, status, position } = args as {
          id: string;
          status: string;
          position?: number;
        };
        
        const moveData = { status, position };
        const card = await apiRequest("POST", `/api/cards/${encodeURIComponent(id)}/move`, moveData);
        
        return {
          content: [
            {
              type: "text",
              text: `Card moved successfully:\n${JSON.stringify(card, null, 2)}`
            } as TextContent
          ]
        };
      }
      
      case "update_card": {
        const { id, ...updates } = args as {
          id: string;
          title?: string;
          description?: string;
          link?: string;
          status?: string;
        };
        
        const card = await apiRequest("PATCH", `/api/cards/${encodeURIComponent(id)}`, updates);
        
        return {
          content: [
            {
              type: "text",
              text: `Card updated successfully:\n${JSON.stringify(card, null, 2)}`
            } as TextContent
          ]
        };
      }
      
      case "delete_card": {
        const { id } = args as { id: string };
        await apiRequest("DELETE", `/api/cards/${encodeURIComponent(id)}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Card ${id} deleted successfully`
            } as TextContent
          ]
        };
      }
      
      case "batch_move_cards": {
        const { operations } = args as { operations: Array<{ cardId: string; status: string; position?: number }> };
        const result = await apiRequest("POST", "/api/cards/batch-move", { operations });
        
        return {
          content: [
            {
              type: "text",
              text: `Batch move completed:\n${JSON.stringify(result, null, 2)}`
            } as TextContent
          ]
        };
      }
      
      default:
        throw new Error(`Tool ${name} not found`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`
        } as TextContent
      ],
      isError: true
    };
  }
}

// Create Express app for the MCP server
const app = express();

// Enable CORS for cross-origin requests
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    mcpServer: 'kanban-remote-server',
    version: '1.0.0',
    kanbanServerUrl: KANBAN_SERVER_URL,
    timestamp: new Date().toISOString()
  });
});

// Info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'Kanban MCP Remote Server',
    version: '1.0.0',
    description: 'Model Context Protocol server for Kanban board management',
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description
    })),
    endpoints: {
      health: '/health',
      info: '/info',
      mcp: '/sse'
    },
    configuration: {
      mcpPort: MCP_PORT,
      kanbanServerUrl: KANBAN_SERVER_URL
    }
  });
});

// MCP Protocol endpoints
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request" }
      });
    }

    switch (method) {
      case "tools/list":
        res.json({
          jsonrpc: "2.0",
          id,
          result: { tools }
        });
        break;

      case "tools/call":
        const { name, arguments: args } = params;
        const result = await executeTool(name, args || {});
        res.json({
          jsonrpc: "2.0",
          id,
          result
        });
        break;

      default:
        res.status(404).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" }
        });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id,
      error: { code: -32603, message: `Internal error: ${errorMessage}` }
    });
  }
});

// Start the server
async function main() {
  // Start the HTTP server
  app.listen(MCP_PORT, '0.0.0.0', () => {
    console.log(`🚀 Kanban MCP Remote Server running on port ${MCP_PORT}`);
    console.log(`📊 Health check: http://localhost:${MCP_PORT}/health`);
    console.log(`📋 Info endpoint: http://localhost:${MCP_PORT}/info`);
    console.log(`🔗 MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
    console.log(`🎯 Kanban API: ${KANBAN_SERVER_URL}`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Kanban MCP Remote Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Kanban MCP Remote Server...');
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Server failed to start:", error);
  process.exit(1);
});