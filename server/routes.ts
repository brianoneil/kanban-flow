import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { insertCardSchema, updateCardSchema } from "@shared/schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Tool,
  CallToolResult,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import multer from "multer";
import { uploadImageToR2, isValidImageType, isValidImageSize, isR2Configured } from "./r2-storage";
import { promises as fs } from "fs";
import path from "path";

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

// Simple passcode - in production you'd want this as an environment variable
const PASSCODE = "1234";

// Session middleware setup
function setupSession(app: Express) {
  app.use(session({
    secret: process.env.SESSION_SECRET || "kanban-session-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));
}

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  // Skip authentication for MCP endpoints - external clients need access
  if (req.path.startsWith('/mcp') || req.path.startsWith('/api')) {
    return next();
  }

  if (req.session?.authenticated) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (isValidImageType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed (JPEG, PNG, GIF, WebP, SVG).'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  setupSession(app);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.post("/api/auth/login", (req: any, res) => {
    const { passcode } = req.body;
    
    if (passcode === PASSCODE) {
      req.session.authenticated = true;
      res.json({ success: true, message: "Login successful" });
    } else {
      res.status(401).json({ message: "Invalid passcode" });
    }
  });

  app.get("/api/auth/verify", (req: any, res) => {
    if (req.session?.authenticated) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        res.status(500).json({ message: "Logout failed" });
      } else {
        res.json({ success: true, message: "Logout successful" });
      }
    });
  });

  // Image upload endpoint (multipart/form-data from browser)
  app.post("/api/upload-image", requireAuth, upload.single('image'), async (req, res) => {
    try {
      // Check if R2 is configured
      if (!isR2Configured()) {
        return res.status(503).json({ 
          message: "Image upload is not configured. Please contact administrator.",
          error: "R2_NOT_CONFIGURED"
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const file = req.file;

      // Validate file size (double-check)
      if (!isValidImageSize(file.size)) {
        return res.status(400).json({ message: "Image file is too large. Maximum size is 10MB." });
      }

      // Upload to R2
      const imageUrl = await uploadImageToR2(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      res.json({
        success: true,
        url: imageUrl,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ 
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Image upload endpoint (JSON with base64 from MCP)
  app.post("/api/upload-image-mcp", requireAuth, async (req, res) => {
    try {
      // Check if R2 is configured
      if (!isR2Configured()) {
        return res.status(503).json({ 
          message: "Image upload is not configured. Please contact administrator.",
          error: "R2_NOT_CONFIGURED"
        });
      }

      const { imageData, filename, mimeType, width } = req.body;

      if (!imageData || !filename) {
        return res.status(400).json({ message: "imageData and filename are required" });
      }

      // Auto-detect MIME type from filename if not provided
      let detectedMimeType = mimeType;
      if (!detectedMimeType) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        detectedMimeType = mimeTypes[ext || ''] || 'image/png';
      }

      // Validate image type
      if (!isValidImageType(detectedMimeType)) {
        return res.status(400).json({ message: 'Invalid image type. Only JPEG, PNG, GIF, WebP, and SVG are supported.' });
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(imageData, 'base64');

      // Validate file size
      if (!isValidImageSize(buffer.length)) {
        return res.status(400).json({ message: 'Image file is too large. Maximum size is 10MB.' });
      }

      // Upload to R2
      const imageUrl = await uploadImageToR2(buffer, filename, detectedMimeType);

      // Generate markdown with optional width syntax
      const altText = filename.split('.')[0];
      let markdown: string;
      
      if (width) {
        markdown = `![${altText}|${width}](${imageUrl})`;
      } else {
        markdown = `![${altText}](${imageUrl})`;
      }

      res.json({
        success: true,
        url: imageUrl,
        markdown,
        message: `Image uploaded successfully!\n\nURL: ${imageUrl}\n\nMarkdown syntax to use in cards:\n${markdown}\n\n${width ? `Image will display with max-width: ${width}${width.includes('%') ? '' : 'px'}\n\n` : ''}You can now use this markdown in card descriptions.`
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ 
        message: "Failed to upload image",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Protected routes - require authentication
  // Get all cards
  app.get("/api/cards", requireAuth, async (req, res) => {
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

  // Get cards summary (titles and statuses only)
  app.get("/api/cards/summary", requireAuth, async (req, res) => {
    try {
      const { project } = req.query;
      const cards = await storage.getAllCards(project as string);
      
      // Create summary with just title and status
      const summary = cards.map(card => ({
        id: card.id,
        title: card.title,
        status: card.status,
        project: card.project,
        order: card.order
      }));
      
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to get cards summary" });
    }
  });

  // Get cards summary as markdown
  app.get("/api/cards/summary/markdown", requireAuth, async (req, res) => {
    try {
      const { project } = req.query;
      const cards = await storage.getAllCards(project as string);
      
      // Group cards by status
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
      
      // Generate markdown
      let markdown = "# Cards Summary\n\n";
      
      if (project) {
        markdown += `**Project:** ${project}\n\n`;
      }
      
      const statusLabels = {
        'not-started': 'Not Started',
        'blocked': 'Blocked',
        'in-progress': 'In Progress',
        'complete': 'Complete',
        'verified': 'Verified'
      };
      
      for (const [status, statusCards] of Object.entries(grouped)) {
        if (statusCards.length > 0) {
          markdown += `## ${statusLabels[status as keyof typeof statusLabels] || status} (${statusCards.length})\n\n`;
          statusCards.forEach(card => {
            markdown += `- ${card.title}\n`;
          });
          markdown += '\n';
        }
      }
      
      res.setHeader('Content-Type', 'text/markdown');
      res.send(markdown);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate markdown summary" });
    }
  });

  // Get cards grouped by status (must come before the :id route)
  app.get("/api/cards/by-status", requireAuth, async (req, res) => {
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
  app.get("/api/cards/:id", requireAuth, async (req, res) => {
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
  app.post("/api/cards", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCardSchema.parse(req.body);
      const card = await storage.createCard(validatedData);

      // Broadcast card creation
      broadcast({ type: "CARD_CREATED", data: card });

      res.status(201).json(card);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid card data",
          errors: JSON.parse(error.message)
        });
      }
      if (error instanceof Error && error.message.includes("validation")) {
        return res.status(400).json({ message: "Invalid card data" });
      }
      res.status(500).json({ message: "Failed to create card" });
    }
  });

  // Bulk create cards
  app.post("/api/cards/bulk", requireAuth, async (req, res) => {
    try {
      const { cards } = req.body;

      if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({ message: "Cards array is required and cannot be empty" });
      }

      if (cards.length > 20) {
        return res.status(400).json({ message: "Maximum 20 cards can be created at once" });
      }

      const createdCards = [];
      const failedCards = [];

      for (let i = 0; i < cards.length; i++) {
        const cardData = cards[i];
        try {
          const validatedData = insertCardSchema.parse(cardData);
          const card = await storage.createCard(validatedData);
          createdCards.push(card);

          // Broadcast each card creation with a small delay to prevent message loss
          broadcast({ type: "CARD_CREATED", data: card });
          
          // Small delay to ensure WebSocket messages are processed properly
          if (i < cards.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (error) {
          console.error(`Error creating card ${i}:`, error);
          failedCards.push({
            index: i,
            title: cardData.title || `Card ${i}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const result = {
        createdCount: createdCards.length,
        createdCards,
        failedCount: failedCards.length,
        failedCards,
        requestedCount: cards.length
      };

      // Send a bulk completion message to ensure UI refresh
      if (createdCards.length > 0) {
        broadcast({ 
          type: "CARDS_BULK_CREATED", 
          data: { 
            cards: createdCards,
            count: createdCards.length 
          } 
        });
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error bulk creating cards:', error);
      res.status(500).json({ message: "Failed to bulk create cards" });
    }
  });

  // Update card
  app.patch("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCardSchema.parse(req.body);
      const card = await storage.updateCard(id, validatedData);

      // Broadcast card update
      broadcast({ type: "CARD_UPDATED", data: card });

      res.json(card);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({
          message: "Invalid card data",
          errors: JSON.parse(error.message)
        });
      }
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
  app.delete("/api/cards/:id", requireAuth, async (req, res) => {
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

  // Bulk delete cards by IDs
  app.delete("/api/cards/bulk", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }

      // Delete each card
      const deletedIds = [];
      for (const id of ids) {
        try {
          const deleted = await storage.deleteCard(id);
          if (deleted) {
            deletedIds.push(id);
          }
        } catch (error) {
          console.error(`Error deleting card ${id}:`, error);
          // Continue with other cards even if one fails
        }
      }

      // Broadcast deletions to all WebSocket clients
      if (deletedIds.length > 0) {
        broadcast({
          type: 'CARDS_BULK_DELETED',
          data: deletedIds
        });
      }

      res.json({
        deletedCount: deletedIds.length,
        deletedIds,
        requestedCount: ids.length
      });
    } catch (error) {
      console.error('Error bulk deleting cards:', error);
      res.status(500).json({ error: 'Failed to bulk delete cards' });
    }
  });

  // Move card to specific status (simplified endpoint)
  app.post("/api/cards/:id/move", requireAuth, async (req, res) => {
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
  app.post("/api/cards/reorder", requireAuth, async (req, res) => {
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
  app.post("/api/cards/batch-move", requireAuth, async (req, res) => {
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

  // Create MCP Server instance
  const mcpServer = new McpServer({
    name: "kanban-integrated-server",
    version: "1.0.0"
  });


  // Register MCP tools using the SDK
  mcpServer.registerTool(
    "get_projects",
    {
      title: "Get Projects",
      description: "Get all available projects in the Kanban system.",
      inputSchema: {}
    },
    async () => {
          const projects = await storage.getProjects();
          return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }]
      };
    }
  );

  mcpServer.registerTool(
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
          const cards = await storage.getAllCards(project);
          
          if (status) {
            const filteredCards = cards
              .filter(card => card.status === status)
              .sort((a, b) => parseInt(a.order) - parseInt(b.order));
            return {
          content: [{ type: "text", text: JSON.stringify(filteredCards, null, 2) }]
            };
          } else {
            return {
          content: [{ type: "text", text: JSON.stringify(cards, null, 2) }]
        };
      }
    }
  );

  mcpServer.registerTool(
    "get_cards_by_status",
    {
      title: "Get Cards by Status",
      description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values, optionally filtered by project.",
      inputSchema: {
        project: z.string().optional().describe("Optional: filter cards by specific project")
      }
    },
    async ({ project }) => {
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
        content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }]
      };
    }
  );

  mcpServer.registerTool(
    "get_card",
    {
      title: "Get Card",
      description: "Get details of a specific card by its ID.",
      inputSchema: {
        id: z.string().describe("The ID of the card to retrieve")
      }
    },
    async ({ id }) => {
          const card = await storage.getCard(id);
          return {
        content: [{ type: "text", text: JSON.stringify(card, null, 2) }]
      };
    }
  );

  mcpServer.registerTool(
    "upload_image",
    {
      title: "Upload Image",
      description: "Upload an image to R2 storage and get back a URL that can be used in Markdown. The returned URL can be inserted into card descriptions using ![alt text](url) syntax. Supports Obsidian-style width control: ![alt|width](url) where width can be pixels (e.g., '400') or percentage (e.g., '50%'). Provide the full file path to the image on your local system.",
      inputSchema: {
        filePath: z.string().describe("Full path to the image file on your local system (e.g., '/Users/username/Downloads/screenshot.png')"),
        width: z.string().optional().describe("Optional width constraint for the image display. Can be pixels (e.g., '400', '200') or percentage (e.g., '50%', '75%'). If not provided, image will be full responsive width.")
      }
    },
    async ({ filePath, width }) => {
      try {
        // Check if R2 is configured
        if (!isR2Configured()) {
          throw new Error("Image upload is not configured. R2 environment variables are missing.");
        }

        // Read file from the provided path
        let buffer: Buffer;
        let filename: string;
        
        try {
          buffer = await fs.readFile(filePath);
          filename = path.basename(filePath);
        } catch (error) {
          throw new Error(`Failed to read file from path: ${filePath}. ${error instanceof Error ? error.message : String(error)}`);
        }

        // Auto-detect MIME type from filename
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        const detectedMimeType = mimeTypes[ext || ''] || 'image/png';

        // Validate image type
        if (!isValidImageType(detectedMimeType)) {
          throw new Error('Invalid image type. Only JPEG, PNG, GIF, WebP, and SVG are supported.');
        }

        // Validate file size
        if (!isValidImageSize(buffer.length)) {
          throw new Error('Image file is too large. Maximum size is 10MB.');
        }

        // Upload to R2
        const imageUrl = await uploadImageToR2(buffer, filename, detectedMimeType);

        // Generate markdown with optional width syntax
        const altText = filename.split('.')[0]; // Use filename without extension as alt text
        let markdown: string;
        
        if (width) {
          // Obsidian-style syntax: ![alt|width](url)
          markdown = `![${altText}|${width}](${imageUrl})`;
        } else {
          // Standard markdown: ![alt](url)
          markdown = `![${altText}](${imageUrl})`;
        }

        return {
          content: [{
            type: "text",
            text: `Image uploaded successfully!\n\nURL: ${imageUrl}\n\nMarkdown syntax to use in cards:\n${markdown}\n\n${width ? `Image will display with max-width: ${width}${width.includes('%') ? '' : 'px'}\n\n` : ''}You can now use this markdown in card descriptions.`
          }]
        };
      } catch (error) {
        throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  mcpServer.registerTool(
    "create_card",
    {
      title: "Create Card",
      description: "Create a new card in the Kanban board for a specific project. The description field supports full Markdown formatting including images. To include images, first upload them using the upload_image tool, then use the returned URL in Markdown syntax: ![alt text](image-url)",
      inputSchema: {
        title: z.string().describe("The title of the card - keep concise and descriptive"),
        description: z.string().describe("Detailed description of the card in Markdown format. Use Markdown syntax for better formatting: **bold**, *italic*, `code`, [links](url), bullet lists (- item), numbered lists (1. item), headers (## Header), blockquotes (> quote), code blocks (```language code```), images (![alt](url)), and task lists (- [ ] unchecked, - [x] checked) for enhanced readability and structure. Task lists will automatically show progress bars on cards."),
        project: z.string().describe("The project this card belongs to"),
        link: z.string().optional().describe("Optional: URL link related to the card"),
        notes: z.string().optional().describe("Optional: Additional notes for extra context and information"),
        status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).default("not-started").describe("The initial status of the card")
      }
    },
    async ({ title, description, project, link, notes, status = "not-started" }) => {
          try {
            // Validate the card data using the schema
            const validatedData = insertCardSchema.parse({
              title,
              description,
              project,
              link: link || undefined,
              notes: notes || undefined,
              status
            });
            
            const card = await storage.createCard(validatedData);
            
            // Broadcast card creation
            broadcast({ type: "CARD_CREATED", data: card });
            
            return {
          content: [{ type: "text", text: `Card created successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
          throw new Error(`Invalid card data. Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}`);
            }
            throw error;
          }
        }
  );

  mcpServer.registerTool(
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
          notes: z.string().optional().describe("Optional: Additional notes for extra context and information"),
          status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).default("not-started").describe("The initial status of the card")
        })).min(1).max(20).describe("Array of cards to create (maximum 20 cards per request)")
      }
    },
    async ({ cards }) => {
      const createdCards = [];
      const failedCards = [];

      for (let i = 0; i < cards.length; i++) {
        const cardData = cards[i];
        try {
          // Validate the card data using the schema
          const validatedData = insertCardSchema.parse({
            title: cardData.title,
            description: cardData.description,
            project: cardData.project,
            link: cardData.link || undefined,
            notes: cardData.notes || undefined,
            status: cardData.status || "not-started"
          });
          
          const card = await storage.createCard(validatedData);
          createdCards.push(card);
          
          // Broadcast card creation with a small delay to prevent message loss
          broadcast({ type: "CARD_CREATED", data: card });
          
          // Small delay to ensure WebSocket messages are processed properly
          if (i < cards.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (error) {
          console.error(`Error creating card "${cardData.title}":`, error);
          failedCards.push({
            index: i,
            title: cardData.title,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const result = {
        createdCount: createdCards.length,
        createdCards: createdCards.map(c => ({
          title: c.title,
          id: c.id,
          status: c.status,
          project: c.project
        })),
        failedCount: failedCards.length,
        failedCards: failedCards.map(f => ({
          title: f.title,
          error: f.error
        })),
        requestedCount: cards.length
      };

      // Send a bulk completion message to ensure UI refresh
      if (createdCards.length > 0) {
        broadcast({ 
          type: "CARDS_BULK_CREATED", 
          data: { 
            cards: createdCards,
            count: createdCards.length 
          } 
        });
      }

      return {
        content: [{ 
          type: "text", 
          text: `Bulk create completed:\n${JSON.stringify(result, null, 2)}\n\n${createdCards.length > 0 ? `✅ Successfully created ${createdCards.length} cards` : ''}${failedCards.length > 0 ? `\n❌ Failed to create ${failedCards.length} cards` : ''}` 
        }]
      };
    }
  );

  mcpServer.registerTool(
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
          try {
            // Validate the update data using the schema
            const updateData: any = { status };
            if (position !== undefined) {
              updateData.order = position.toString();
            }
            
            const validatedData = updateCardSchema.parse(updateData);
            const card = await storage.updateCard(id, validatedData);
            
            // Broadcast card update
            broadcast({ type: "CARD_UPDATED", data: card });
            
            return {
          content: [{ type: "text", text: `Card moved successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
          throw new Error(`Invalid status. Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}`);
            }
            throw error;
          }
        }
  );

  mcpServer.registerTool(
    "update_card",
    {
      title: "Update Card",
      description: "Update properties of an existing card. Use Markdown formatting in the description for better readability. Images can be included using ![alt](url) syntax after uploading with upload_image tool.",
      inputSchema: {
        id: z.string().describe("The ID of the card to update"),
        title: z.string().optional().describe("Optional: new title for the card"),
        description: z.string().optional().describe("Optional: new description for the card in Markdown format. Use **bold**, *italic*, `code`, lists, headers, blockquotes, code blocks, images (![alt](url)), and task lists (- [ ] unchecked, - [x] checked) for better structure and readability. Task lists will show progress bars."),
        link: z.string().optional().describe("Optional: new link for the card"),
        notes: z.string().optional().describe("Optional: new notes for extra context and information"),
        status: z.enum(["not-started", "blocked", "in-progress", "complete", "verified"]).optional().describe("Optional: new status for the card")
      }
    },
    async ({ id, title, description, link, notes, status }) => {
          try {
            // Validate the update data using the schema
        const updates: any = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (link !== undefined) updates.link = link;
        if (notes !== undefined) updates.notes = notes;
        if (status !== undefined) updates.status = status;
        
            const validatedData = updateCardSchema.parse(updates);
            const card = await storage.updateCard(id, validatedData);
            
            // Broadcast card update
            broadcast({ type: "CARD_UPDATED", data: card });
            
            return {
          content: [{ type: "text", text: `Card updated successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
          const statusError = status ? ` Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}` : '';
          throw new Error(`Invalid card data.${statusError}`);
            }
            throw error;
          }
        }
  );

  mcpServer.registerTool(
    "delete_card",
    {
      title: "Delete Card",
      description: "Delete a card from the Kanban board.",
      inputSchema: {
        id: z.string().describe("The ID of the card to delete")
      }
    },
    async ({ id }) => {
          await storage.deleteCard(id);
          
          // Broadcast card deletion
          broadcast({ type: "CARD_DELETED", data: { id } });
          
          return {
        content: [{ type: "text", text: `Card ${id} deleted successfully` }]
      };
    }
  );

  mcpServer.registerTool(
    "bulk_delete_cards",
    {
      title: "Bulk Delete Cards",
      description: "Delete multiple cards from the Kanban board by their IDs. This is more efficient than deleting cards one by one.",
      inputSchema: {
        ids: z.array(z.string()).min(1).describe("Array of card IDs to delete")
      }
    },
    async ({ ids }) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("ids must be a non-empty array");
          }
          
          const deletedIds = [];
          const failedIds = [];
          
          for (const id of ids) {
            try {
              const deleted = await storage.deleteCard(id);
              if (deleted) {
                deletedIds.push(id);
              } else {
                failedIds.push(id);
              }
            } catch (error) {
              console.error(`Error deleting card ${id}:`, error);
              failedIds.push(id);
            }
          }
          
          // Broadcast bulk deletion
          if (deletedIds.length > 0) {
            broadcast({
              type: 'CARDS_BULK_DELETED',
              data: deletedIds
            });
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

  mcpServer.registerTool(
    "add_comment",
    {
      title: "Add Comment",
      description: "Add a comment to a card. Comments are timestamped and can be used for discussions, updates, or notes about the card's progress.",
      inputSchema: {
        id: z.string().describe("The ID of the card to add a comment to"),
        content: z.string().describe("The content of the comment")
      }
    },
    async ({ id, content }) => {
      try {
        const card = await storage.getCard(id);
        if (!card) {
          throw new Error("Card not found");
        }
        
        let comments = [];
        if (card.comments) {
          try {
            comments = JSON.parse(card.comments);
          } catch (e) {
            comments = [];
          }
        }
        
        const newComment = {
          id: Math.random().toString(36).substr(2, 9),
          content,
          timestamp: new Date().toISOString()
        };
        comments.push(newComment);
        
        await storage.updateCard(id, {
          comments: JSON.stringify(comments)
        });
        
        broadcast({ type: "CARD_UPDATED", data: await storage.getCard(id) });
        
        return {
          content: [{ type: "text", text: `Comment added successfully:\n${JSON.stringify(newComment, null, 2)}\n\nTotal comments: ${comments.length}` }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  );

  mcpServer.registerTool(
    "get_comments",
    {
      title: "Get Comments",
      description: "Get all comments for a specific card, sorted by timestamp (newest first).",
      inputSchema: {
        id: z.string().describe("The ID of the card to get comments from")
      }
    },
    async ({ id }) => {
      try {
        const card = await storage.getCard(id);
        if (!card) {
          throw new Error("Card not found");
        }
        
        let comments = [];
        if (card.comments) {
          try {
            comments = JSON.parse(card.comments);
            comments.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          } catch (e) {
            comments = [];
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: comments.length > 0 
              ? `Found ${comments.length} comment${comments.length !== 1 ? 's' : ''}:\n${JSON.stringify(comments, null, 2)}`
              : "No comments found for this card."
          }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to get comments: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  );

  mcpServer.registerTool(
    "delete_comment",
    {
      title: "Delete Comment",
      description: "Delete a specific comment from a card by its comment ID.",
      inputSchema: {
        cardId: z.string().describe("The ID of the card containing the comment"),
        commentId: z.string().describe("The ID of the comment to delete")
      }
    },
    async ({ cardId, commentId }) => {
      try {
        const card = await storage.getCard(cardId);
        if (!card) {
          throw new Error("Card not found");
        }
        
        let comments = [];
        if (card.comments) {
          try {
            comments = JSON.parse(card.comments);
          } catch (e) {
            return {
              content: [{ type: "text", text: "Failed to parse comments" }]
            };
          }
        }
        
        const initialLength = comments.length;
        comments = comments.filter((c: any) => c.id !== commentId);
        
        if (comments.length === initialLength) {
          return {
            content: [{ type: "text", text: `Comment with ID ${commentId} not found` }]
          };
        }
        
        await storage.updateCard(cardId, {
          comments: JSON.stringify(comments)
        });
        
        broadcast({ type: "CARD_UPDATED", data: await storage.getCard(cardId) });
        
        return {
          content: [{ type: "text", text: `Comment deleted successfully. Remaining comments: ${comments.length}` }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Failed to delete comment: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  );

  mcpServer.registerTool(
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
        content: [{ type: "text", text: `Batch move completed:\n${JSON.stringify({ updated: results, count: results.length }, null, 2)}` }]
      };
    }
  );

  // Tool handler function to route tool calls
  async function callToolHandler(name: string, args: any): Promise<any> {
      switch (name) {
        case "get_projects": {
          const projects = await storage.getProjects();
          return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }]
          };
        }

        case "get_cards": {
        const { project, status } = args as { project?: string; status?: string };
          const cards = await storage.getAllCards(project);
          
          if (status) {
            const filteredCards = cards
              .filter(card => card.status === status)
              .sort((a, b) => parseInt(a.order) - parseInt(b.order));
            return {
            content: [{ type: "text", text: JSON.stringify(filteredCards, null, 2) }]
            };
          } else {
            return {
            content: [{ type: "text", text: JSON.stringify(cards, null, 2) }]
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
          content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }]
          };
        }
        
        case "get_card": {
          const { id } = args as { id: string };
          const card = await storage.getCard(id);
          return {
          content: [{ type: "text", text: JSON.stringify(card, null, 2) }]
          };
        }

        case "upload_image": {
          const { filePath, width } = args as {
            filePath: string;
            width?: string;
          };

          try {
            // Check if R2 is configured
            if (!isR2Configured()) {
              throw new Error("Image upload is not configured. R2 environment variables are missing.");
            }

            // Read file from the provided path
            let buffer: Buffer;
            let filename: string;
            
            try {
              buffer = await fs.readFile(filePath);
              filename = path.basename(filePath);
            } catch (error) {
              throw new Error(`Failed to read file from path: ${filePath}. ${error instanceof Error ? error.message : String(error)}`);
            }

            // Auto-detect MIME type from filename
            const ext = filename.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'gif': 'image/gif',
              'webp': 'image/webp',
              'svg': 'image/svg+xml'
            };
            const detectedMimeType = mimeTypes[ext || ''] || 'image/png';

            // Validate image type
            if (!isValidImageType(detectedMimeType)) {
              throw new Error('Invalid image type. Only JPEG, PNG, GIF, WebP, and SVG are supported.');
            }

            // Validate file size
            if (!isValidImageSize(buffer.length)) {
              throw new Error('Image file is too large. Maximum size is 10MB.');
            }

            // Upload to R2
            const imageUrl = await uploadImageToR2(buffer, filename, detectedMimeType);

            // Generate markdown with optional width syntax
            const altText = filename.split('.')[0]; // Use filename without extension as alt text
            let markdown: string;
            
            if (width) {
              // Obsidian-style syntax: ![alt|width](url)
              markdown = `![${altText}|${width}](${imageUrl})`;
            } else {
              // Standard markdown: ![alt](url)
              markdown = `![${altText}](${imageUrl})`;
            }

            return {
              content: [{
                type: "text",
                text: `Image uploaded successfully!\n\nURL: ${imageUrl}\n\nMarkdown syntax to use in cards:\n${markdown}\n\n${width ? `Image will display with max-width: ${width}${width.includes('%') ? '' : 'px'}\n\n` : ''}You can now use this markdown in card descriptions.`
              }]
            };
          } catch (error) {
            throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        case "create_card": {
          const { title, description, project, link, notes, status = "not-started" } = args as {
            title: string;
            description: string;
            project: string;
            link?: string;
            notes?: string;
            status?: string;
          };
          
          try {
            // Validate the card data using the schema
            const validatedData = insertCardSchema.parse({
              title,
              description,
              project,
              link: link || undefined,
              notes: notes || undefined,
              status
            });
            
            const card = await storage.createCard(validatedData);
            
            // Broadcast card creation
            broadcast({ type: "CARD_CREATED", data: card });
            
            return {
            content: [{ type: "text", text: `Card created successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
            throw new Error(`Invalid card data. Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}`);
            }
            throw error;
          }
        }
        
        case "move_card": {
          const { id, status, position } = args as {
            id: string;
            status: string;
            position?: number;
          };
          
          try {
            // Validate the update data using the schema
            const updateData: any = { status };
            if (position !== undefined) {
              updateData.order = position.toString();
            }
            
            const validatedData = updateCardSchema.parse(updateData);
            const card = await storage.updateCard(id, validatedData);
            
            // Broadcast card update
            broadcast({ type: "CARD_UPDATED", data: card });
            
            return {
            content: [{ type: "text", text: `Card moved successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
            throw new Error(`Invalid status. Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}`);
            }
            throw error;
          }
        }
        
        case "update_card": {
        const { id, title, description, link, notes, status } = args as {
            id: string;
            title?: string;
            description?: string;
            link?: string;
            notes?: string;
            status?: string;
          };
          
          try {
            // Validate the update data using the schema
          const updates: any = {};
          if (title !== undefined) updates.title = title;
          if (description !== undefined) updates.description = description;
          if (link !== undefined) updates.link = link;
          if (notes !== undefined) updates.notes = notes;
          if (status !== undefined) updates.status = status;
          
            const validatedData = updateCardSchema.parse(updates);
            const card = await storage.updateCard(id, validatedData);
            
            // Broadcast card update
            broadcast({ type: "CARD_UPDATED", data: card });
            
            return {
            content: [{ type: "text", text: `Card updated successfully:\n${JSON.stringify(card, null, 2)}` }]
            };
          } catch (error) {
            if (error instanceof Error && error.name === "ZodError") {
            const statusError = status ? ` Status must be one of: not-started, blocked, in-progress, complete, verified. Received: ${status}` : '';
            throw new Error(`Invalid card data.${statusError}`);
            }
            throw error;
          }
        }
        
        case "delete_card": {
          const { id } = args as { id: string };
          await storage.deleteCard(id);
          
          // Broadcast card deletion
          broadcast({ type: "CARD_DELETED", data: { id } });
          
          return {
          content: [{ type: "text", text: `Card ${id} deleted successfully` }]
          };
        }
        
        case "bulk_delete_cards": {
          const { ids } = args as { ids: string[] };
          
          if (!Array.isArray(ids) || ids.length === 0) {
          throw new Error("ids must be a non-empty array");
          }
          
          const deletedIds = [];
          const failedIds = [];
          
          for (const id of ids) {
            try {
              const deleted = await storage.deleteCard(id);
              if (deleted) {
                deletedIds.push(id);
              } else {
                failedIds.push(id);
              }
            } catch (error) {
              console.error(`Error deleting card ${id}:`, error);
              failedIds.push(id);
            }
          }
          
          // Broadcast bulk deletion
          if (deletedIds.length > 0) {
            broadcast({
              type: 'CARDS_BULK_DELETED',
              data: deletedIds
            });
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
          content: [{ type: "text", text: `Batch move completed:\n${JSON.stringify({ updated: results, count: results.length }, null, 2)}` }]
          };
        }
        
        default:
          throw new Error(`Tool ${name} not found`);
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
    // Get tools from the MCP server
    const tools = [
      { name: "get_projects", description: "Get all available projects in the Kanban system." },
      { name: "get_cards", description: "Get all cards or filter by project and/or status. Returns cards sorted by their order within each status." },
      { name: "get_cards_by_status", description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values, optionally filtered by project." },
      { name: "get_card", description: "Get details of a specific card by its ID." },
      { name: "upload_image", description: "Upload an image to R2 storage and get back a URL that can be used in Markdown. The returned URL can be inserted into card descriptions using ![alt text](url) syntax." },
      { name: "create_card", description: "Create a new card in the Kanban board for a specific project. The description field supports full Markdown formatting including images." },
      { name: "move_card", description: "Move a card to a different status and optionally specify its position within that status." },
      { name: "update_card", description: "Update properties of an existing card. Use Markdown formatting in the description for better readability." },
      { name: "delete_card", description: "Delete a card from the Kanban board." },
      { name: "bulk_delete_cards", description: "Delete multiple cards from the Kanban board by their IDs. This is more efficient than deleting cards one by one." },
      { name: "batch_move_cards", description: "Move multiple cards in a single operation for better performance." },
      { name: "add_comment", description: "Add a comment to a card. Comments are timestamped and can be used for discussions, updates, or notes about the card's progress." },
      { name: "get_comments", description: "Get all comments for a specific card, sorted by timestamp (newest first)." },
      { name: "delete_comment", description: "Delete a specific comment from a card by its comment ID." }
    ];

    res.json({
      name: 'Kanban MCP Integrated Server',
      version: '1.0.0',
      description: 'Model Context Protocol server integrated with Kanban board application',
      tools,
      endpoints: {
        health: '/mcp/health',
        info: '/mcp/info',
        mcp: '/mcp (Streamable HTTP - GET for SSE, POST for requests)'
      }
    });
  });

  // MCP JSON-RPC endpoint (simplified approach)
  app.post('/mcp', async (req, res) => {
    try {
      const { jsonrpc, id, method, params } = req.body;
      
      console.log(`[MCP] Request: ${method}`, params ? JSON.stringify(params) : 'no params');

      if (jsonrpc !== "2.0") {
        return res.status(400).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32600, message: "Invalid Request" }
        });
      }

      // Handle notifications (no response needed)
      if (!id || method === "notifications/initialized") {
        console.log(`[MCP] Handling notification: ${method}`);
        return res.status(202).json({ received: true });
      }

      let result;
      let sessionId = null;

      switch (method) {
        case "initialize":
          const clientProtocolVersion = params?.protocolVersion || "2024-11-05";
          console.log(`[MCP] Initialize request from client:`, JSON.stringify(params?.clientInfo || {}, null, 2));
          // Generate session ID for initialization
          sessionId = randomUUID();
          result = {
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
          };
          console.log(`[MCP] Sending initialize response with session: ${sessionId}`);
          break;

        case "tools/list":
          // Get tools from the MCP server
          const tools = [
            { name: "get_projects", description: "Get all available projects in the Kanban system." },
            { name: "get_cards", description: "Get all cards or filter by project and/or status. Returns cards sorted by their order within each status." },
            { name: "get_cards_by_status", description: "Get all cards grouped by status with proper ordering. Returns an object with status as keys and arrays of cards as values, optionally filtered by project." },
            { name: "get_card", description: "Get details of a specific card by its ID." },
            { name: "upload_image", description: "Upload an image to R2 storage and get back a URL that can be used in Markdown." },
            { name: "create_card", description: "Create a new card in the Kanban board for a specific project. The description field supports full Markdown formatting including images." },
            { name: "move_card", description: "Move a card to a different status and optionally specify its position within that status." },
            { name: "update_card", description: "Update properties of an existing card. Use Markdown formatting in the description for better readability." },
            { name: "delete_card", description: "Delete a card from the Kanban board." },
            { name: "bulk_delete_cards", description: "Delete multiple cards from the Kanban board by their IDs. This is more efficient than deleting cards one by one." },
            { name: "batch_move_cards", description: "Move multiple cards in a single operation for better performance." }
          ];
          result = { tools };
          break;

        case "tools/call":
          const { name, arguments: args } = params;
          console.log(`[MCP] Calling tool: ${name}`, args);
          
          // Call the tool handler directly
          try {
            result = await callToolHandler(name, args || {});
          } catch (error) {
            console.error(`[MCP] Tool call error:`, error);
            return res.status(500).json({
              jsonrpc: "2.0",
              id,
              error: { code: -32603, message: `Tool call failed: ${error instanceof Error ? error.message : String(error)}` }
            });
          }
          break;

        case "ping":
          result = {};
          break;

        default:
          console.log(`[MCP] Unknown method: ${method}`);
          return res.status(404).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
      }

        // Return JSON response
        const headers = {
          'Content-Type': 'application/json',
          ...(sessionId && { 'Mcp-Session-Id': sessionId })
        };
        
        res.set(headers).json({
          jsonrpc: "2.0",
          id,
          result
        });

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
