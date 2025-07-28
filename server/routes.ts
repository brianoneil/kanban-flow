import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertCardSchema, updateCardSchema } from "@shared/schema";

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
      const cards = await storage.getAllCards();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cards" });
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

  // Reorder cards within a status
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
