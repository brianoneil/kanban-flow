import { Card, InsertCard, UpdateCard, User, InsertUser, cards, users } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Card operations
  getAllCards(project?: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: string, updates: UpdateCard): Promise<Card>;
  deleteCard(id: string): Promise<boolean>;
  
  // Project operations
  getProjects(): Promise<string[]>;
  
  // User operations (for future authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllCards(project?: string): Promise<Card[]> {
    let allCards: Card[];
    
    if (project) {
      allCards = await db.select().from(cards).where(eq(cards.project, project));
    } else {
      allCards = await db.select().from(cards);
    }
    
    return allCards.sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async getProjects(): Promise<string[]> {
    const allCards = await db.select({ project: cards.project }).from(cards);
    const projects = new Set(allCards.map(card => card.project));
    return Array.from(projects).sort();
  }

  async getCard(id: string): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card || undefined;
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const [card] = await db
      .insert(cards)
      .values({
        ...insertCard,
        project: insertCard.project || "default"
      })
      .returning();
    return card;
  }

  async updateCard(id: string, updates: UpdateCard): Promise<Card> {
    const [updatedCard] = await db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, id))
      .returning();
    
    if (!updatedCard) {
      throw new Error(`Card with id ${id} not found`);
    }
    
    return updatedCard;
  }

  async deleteCard(id: string): Promise<boolean> {
    const result = await db
      .delete(cards)
      .where(eq(cards.id, id))
      .returning({ id: cards.id });
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();