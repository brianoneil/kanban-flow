import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCardSchema, updateCardSchema } from "@shared/schema";

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
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete card" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
