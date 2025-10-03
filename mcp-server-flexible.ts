#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  Tool,
  CallToolRequest,
  CallToolResult,
  TextContent,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

// Default server URL - can be overridden with environment variable
const KANBAN_SERVER_URL = process.env.KANBAN_SERVER_URL || "http://localhost:3000";

/**
 * Flexible Kanban MCP Server
 * 
 * This version handles initialization requests with or without capabilities field
 * to work with different MCP client implementations like Cursor.
 */

const server = new Server(
  {
    name: "kanban-integrated-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {
        listChanged: true
      },
      logging: {}
    },
  }
);

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
    // Return empty data if server is not running
    console.error(`API request failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Tool definitions
const tools: Tool[] = [
  {
    name: "get_projects",
    description: "Get all available projects in the Kanban system.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
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
        project: {
          type: "string",
          description: "The project this card belongs to"
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
      required: ["title", "description", "project"],
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
    name: "bulk_delete_cards",
    description: "Delete multiple cards from the Kanban board by their IDs. This is more efficient than deleting cards one by one.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Array of card IDs to delete",
          minItems: 1
        }
      },
      required: ["ids"],
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

// Custom initialize handler that's more flexible
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  const params = request.params;
  
  // Provide default capabilities if not provided
  const capabilities = params.capabilities || {};
  
  return {
    protocolVersion: params.protocolVersion || "2024-11-05",
    capabilities: {
      tools: {
        listChanged: true
      },
      logging: {}
    },
    serverInfo: {
      name: "kanban-integrated-server",
      version: "1.0.0"
    }
  };
});

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "get_projects": {
        const projects = await apiRequest("GET", "/api/projects");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(projects || [], null, 2)
            } as TextContent
          ]
        };
      }

      case "get_cards": {
        const { status } = args as { status?: string };
        const endpoint = status ? `/api/cards?status=${encodeURIComponent(status)}` : "/api/cards";
        const cards = await apiRequest("GET", endpoint);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(cards || [], null, 2)
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
              text: JSON.stringify(grouped || {}, null, 2)
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
        const { title, description, project, link, status = "not-started" } = args as {
          title: string;
          description: string;
          project: string;
          link?: string;
          status?: string;
        };
        
        const cardData = { title, description, project, link, status };
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

      case "bulk_delete_cards": {
        const { ids } = args as { ids: string[] };

        if (!Array.isArray(ids) || ids.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: ids must be a non-empty array"
              } as TextContent
            ],
            isError: true
          };
        }

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
          content: [
            {
              type: "text",
              text: `Bulk delete completed:\n${JSON.stringify(result, null, 2)}`
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
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
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
});

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
