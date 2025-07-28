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
      const { status } = req.query;
      const cards = await storage.getAllCards();
      
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

  // Get cards grouped by status (must come before the :id route)
  app.get("/api/cards/by-status", async (req, res) => {
    try {
      const cards = await storage.getAllCards();
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
