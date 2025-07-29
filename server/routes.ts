import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCardSchema, updateCardSchema } from "@shared/schema";
import {
  Tool,
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

// WebSocket broadcast helper
let wss: WebSocketServer;

function broadcast(event: { type: string; data: any }) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event));
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all cards
  app.get("/api/cards", async (req, res) => {
    try {
      const { status, project } = req.query;
      const cards = await storage.getAllCards(project as string);
      
      if (status) {
        const filteredCards = cards
          .filter(card => card.status === status)
          .sort((a, b) => parseInt(a.order) - parseInt(b.order));
        res.json(filteredCards);
      } else {
        res.json(cards);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cards" });
    }
  });

  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get cards grouped by status (must come before the :id route)
  app.get("/api/cards/by-status", async (req, res) => {
    try {
      const { project } = req.query;
      const cards = await storage.getAllCards(project as string);
      const grouped = cards.reduce((acc, card) => {
        if (!acc[card.status]) {
          acc[card.status] = [];
        }
        acc[card.status].push(card);
        return acc;
      }, {} as Record<string, typeof cards>);
      
      // Sort cards within each status by order
      Object.keys(grouped).forEach(status => {
        grouped[status].sort((a, b) => parseInt(a.order) - parseInt(b.order));
      });
      
      res.json(grouped);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cards by status" });
    }
  });

  // Get single card
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const card = await storage.getCard(id);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      res.json(card);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch card" });
    }
  });

  // Create new card
  app.post("/api/cards", async (req, res) => {
    try {
      const validatedData = insertCardSchema.parse(req.body);
      const card = await storage.createCard(validatedData);
      
      // Broadcast card creation
      broadcast({ type: "CARD_CREATED", data: card });
      
      res.status(201).json(card);
    } catch (error) {
      if (error instanceof Error && error.message.includes("validation")) {
        return res.status(400).json({ message: "Invalid card data" });
      }
      res.status(500).json({ message: "Failed to create card" });
    }
  });

  // Update card
  app.patch("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCardSchema.parse(req.body);
      const card = await storage.updateCard(id, validatedData);
      
      // Broadcast card update
      broadcast({ type: "CARD_UPDATED", data: card });
      
      res.json(card);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Card not found" });
      }
      if (error instanceof Error && error.message.includes("validation")) {
        return res.status(400).json({ message: "Invalid card data" });
      }
      res.status(500).json({ message: "Failed to update card" });
    }
  });

  // Delete card
  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCard(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Broadcast card deletion
      broadcast({ type: "CARD_DELETED", data: { id } });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete card" });
    }
  });

  // Move card to specific status (simplified endpoint)
  app.post("/api/cards/:id/move", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, position } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      // Get all cards in the target status to calculate order
      const allCards = await storage.getAllCards();
      const targetStatusCards = allCards
        .filter(card => card.status === status && card.id !== id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));
      
      let newOrder: string;
      if (position === undefined || position >= targetStatusCards.length) {
        // Add to end
        newOrder = (targetStatusCards.length + 1).toString();
      } else {
        // Insert at position - update orders of existing cards
        newOrder = (position + 1).toString();
        
        // Update orders of cards that need to shift down
        for (let i = position; i < targetStatusCards.length; i++) {
          const cardToUpdate = targetStatusCards[i];
          await storage.updateCard(cardToUpdate.id, { 
            order: (parseInt(cardToUpdate.order) + 1).toString() 
          });
        }
      }
      
      const updatedCard = await storage.updateCard(id, { 
        status, 
        order: newOrder 
      });
      
      // Broadcast card move
      broadcast({ type: "CARD_UPDATED", data: updatedCard });
      
      res.json(updatedCard);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Card not found" });
      }
      res.status(500).json({ message: "Failed to move card" });
    }
  });

  // Reorder cards within a status (legacy endpoint - kept for compatibility)
  app.post("/api/cards/reorder", async (req, res) => {
    try {
      const { cardId, newStatus, newOrder } = req.body;
      
      if (!cardId || !newStatus || newOrder === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const card = await storage.updateCard(cardId, { 
        status: newStatus, 
        order: newOrder.toString() 
      });
      
      // Broadcast card reorder
      broadcast({ type: "CARD_UPDATED", data: card });
      
      res.json(card);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Card not found" });
      }
      res.status(500).json({ message: "Failed to reorder card" });
    }
  });

  // Batch move multiple cards
  app.post("/api/cards/batch-move", async (req, res) => {
    try {
      const { operations } = req.body;
      
      if (!Array.isArray(operations)) {
        return res.status(400).json({ message: "Operations must be an array" });
      }
      
      const results = [];
      
      for (const op of operations) {
        const { cardId, status, position } = op;
        
        if (!cardId || !status) {
          continue;
        }
        
        try {
          const updatedCard = await storage.updateCard(cardId, { 
            status,
            order: position !== undefined ? position.toString() : undefined
          });
          results.push(updatedCard);
          
          // Broadcast each card update
          broadcast({ type: "CARD_UPDATED", data: updatedCard });
        } catch (error) {
          console.error(`Failed to move card ${cardId}:`, error);
        }
      }
      
      res.json({ updated: results, count: results.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to batch move cards" });
    }
  });

  // ===== MCP (Model Context Protocol) Endpoints =====

  // MCP Tools definition
  const mcpTools: Tool[] = [
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
      description: "Get all cards or filter by project and/or status. Returns cards sorted by their order within each status.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Optional: filter cards by specific project"
          },
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
      description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values, optionally filtered by project.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Optional: filter cards by specific project"
          }
        },
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
      description: "Create a new card in the Kanban board for a specific project. The description field supports full Markdown formatting for better readability and structure.",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title of the card - keep concise and descriptive"
          },
          description: {
            type: "string",
            description: "Detailed description of the card in Markdown format. Use Markdown syntax for better formatting: **bold**, *italic*, `code`, [links](url), bullet lists (- item), numbered lists (1. item), headers (## Header), blockquotes (> quote), and code blocks (```language code```) for enhanced readability and structure."
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
      description: "Update properties of an existing card. Use Markdown formatting in the description for better readability.",
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
            description: "Optional: new description for the card in Markdown format. Use **bold**, *italic*, `code`, lists, headers, blockquotes, and code blocks for better structure and readability."
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

  // MCP Tool execution function
  async function executeMcpTool(name: string, args: any): Promise<CallToolResult> {
    try {
      switch (name) {
        case "get_projects": {
          const projects = await storage.getProjects();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(projects, null, 2)
              } as TextContent
            ]
          };
        }

        case "get_cards": {
          const { status, project } = args as { status?: string; project?: string };
          const cards = await storage.getAllCards(project);
          
          if (status) {
            const filteredCards = cards
              .filter(card => card.status === status)
              .sort((a, b) => parseInt(a.order) - parseInt(b.order));
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(filteredCards, null, 2)
                } as TextContent
              ]
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(cards, null, 2)
                } as TextContent
              ]
            };
          }
        }
        
        case "get_cards_by_status": {
          const { project } = args as { project?: string };
          const cards = await storage.getAllCards(project);
          const grouped = cards.reduce((acc, card) => {
            if (!acc[card.status]) {
              acc[card.status] = [];
            }
            acc[card.status].push(card);
            return acc;
          }, {} as Record<string, typeof cards>);
          
          // Sort cards within each status by order
          Object.keys(grouped).forEach(status => {
            grouped[status].sort((a, b) => parseInt(a.order) - parseInt(b.order));
          });
          
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
          const card = await storage.getCard(id);
          
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
          const card = await storage.createCard(cardData);
          
          // Broadcast card creation
          broadcast({ type: "CARD_CREATED", data: card });
          
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
          
          const updateData: any = { status };
          if (position !== undefined) {
            updateData.order = position.toString();
          }
          
          const card = await storage.updateCard(id, updateData);
          
          // Broadcast card update
          broadcast({ type: "CARD_UPDATED", data: card });
          
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
          
          const card = await storage.updateCard(id, updates);
          
          // Broadcast card update
          broadcast({ type: "CARD_UPDATED", data: card });
          
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
          await storage.deleteCard(id);
          
          // Broadcast card deletion
          broadcast({ type: "CARD_DELETED", data: { id } });
          
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
          const results = [];
          
          for (const op of operations) {
            const { cardId, status, position } = op;
            
            if (!cardId || !status) {
              continue;
            }
            
            try {
              const updateData: any = { status };
              if (position !== undefined) {
                updateData.order = position.toString();
              }
              
              const updatedCard = await storage.updateCard(cardId, updateData);
              results.push(updatedCard);
              
              // Broadcast each card update
              broadcast({ type: "CARD_UPDATED", data: updatedCard });
            } catch (error) {
              console.error(`Failed to move card ${cardId}:`, error);
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Batch move completed:\n${JSON.stringify({ updated: results, count: results.length }, null, 2)}`
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

  // MCP Health check endpoint
  app.get('/mcp/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      mcpServer: 'kanban-integrated-server',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // MCP Info endpoint
  app.get('/mcp/info', (req, res) => {
    res.json({
      name: 'Kanban MCP Integrated Server',
      version: '1.0.0',
      description: 'Model Context Protocol server integrated with Kanban board application',
      tools: mcpTools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      endpoints: {
        health: '/mcp/health',
        info: '/mcp/info',
        mcp: '/mcp'
      }
    });
  });

  // MCP Protocol endpoint (GET handler for info)
  app.get('/mcp', (req, res) => {
    res.json({
      error: "MCP endpoint requires POST requests with JSON-RPC 2.0 format",
      usage: "This is a Model Context Protocol (MCP) server endpoint",
      examples: {
        listTools: {
          method: "POST",
          url: "/mcp",
          body: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: {}
          }
        },
        callTool: {
          method: "POST", 
          url: "/mcp",
          body: {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "get_cards",
              arguments: {}
            }
          }
        }
      },
      endpoints: {
        health: "/mcp/health",
        info: "/mcp/info",
        mcp: "/mcp (POST only)"
      }
    });
  });

  // MCP Protocol endpoint (JSON-RPC 2.0)
  app.post('/mcp', async (req, res) => {
    try {
      const { jsonrpc, id, method, params } = req.body;
      
      // Debug logging
      console.log(`[MCP] Request: ${method}`, params ? JSON.stringify(params) : 'no params');

      if (jsonrpc !== "2.0") {
        return res.status(400).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32600, message: "Invalid Request" }
        });
      }

      switch (method) {
        case "initialize":
          // MCP initialization handshake - match client protocol version
          const clientProtocolVersion = params?.protocolVersion || "2024-11-05";
          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: clientProtocolVersion,
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
            }
          });
          break;

        case "tools/list":
          res.json({
            jsonrpc: "2.0",
            id,
            result: { tools: mcpTools }
          });
          break;

        case "tools/call":
          const { name, arguments: args } = params;
          const result = await executeMcpTool(name, args || {});
          res.json({
            jsonrpc: "2.0",
            id,
            result
          });
          break;

        case "ping":
          // Handle ping requests
          res.json({
            jsonrpc: "2.0",
            id,
            result: {}
          });
          break;

        case "notifications/initialized":
          // Handle initialization notification (no response needed for notifications)
          res.status(204).send();
          return;

        default:
          console.log(`[MCP] Unknown method: ${method}`);
          res.status(404).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error:`, errorMessage);
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: { code: -32603, message: `Internal error: ${errorMessage}` }
      });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    
    // Send initial data to new client
    storage.getAllCards().then(cards => {
      ws.send(JSON.stringify({ type: "INITIAL_DATA", data: cards }));
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  return httpServer;
}
