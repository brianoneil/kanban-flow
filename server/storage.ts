import { Card, InsertCard, UpdateCard, User, InsertUser, ReleaseNote, InsertReleaseNote, UpdateReleaseNote, cards, users, releaseNotes } from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or, sql } from "drizzle-orm";

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
  
  // Release Notes operations
  getAllReleaseNotes(project?: string): Promise<ReleaseNote[]>;
  getReleaseNote(id: string): Promise<ReleaseNote | undefined>;
  searchReleaseNotes(query: string, project?: string): Promise<ReleaseNote[]>;
  createReleaseNote(releaseNote: InsertReleaseNote): Promise<ReleaseNote>;
  updateReleaseNote(id: string, updates: UpdateReleaseNote): Promise<ReleaseNote>;
  deleteReleaseNote(id: string): Promise<boolean>;
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
    // Get projects from both cards and release notes tables to ensure consistency
    const allCards = await db.select({ project: cards.project }).from(cards);
    const allReleaseNotes = await db.select({ project: releaseNotes.project }).from(releaseNotes);
    
    const projects = new Set([
      ...allCards.map(card => card.project),
      ...allReleaseNotes.map(note => note.project)
    ]);
    
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

  // Release Notes operations
  async getAllReleaseNotes(project?: string): Promise<ReleaseNote[]> {
    let notes: ReleaseNote[];
    
    if (project) {
      notes = await db
        .select()
        .from(releaseNotes)
        .where(eq(releaseNotes.project, project))
        .orderBy(desc(releaseNotes.createdAt));
    } else {
      notes = await db
        .select()
        .from(releaseNotes)
        .orderBy(desc(releaseNotes.createdAt));
    }
    
    return notes;
  }

  async getReleaseNote(id: string): Promise<ReleaseNote | undefined> {
    const [note] = await db
      .select()
      .from(releaseNotes)
      .where(eq(releaseNotes.id, id));
    return note || undefined;
  }

  async searchReleaseNotes(query: string, project?: string): Promise<ReleaseNote[]> {
    try {
      const searchPattern = `%${query}%`;
      
      let conditions = [
        like(releaseNotes.title, searchPattern),
        like(releaseNotes.content, searchPattern),
        like(releaseNotes.version, searchPattern),
        like(releaseNotes.tags, searchPattern),
      ];
      
      if (project) {
        const results = await db
          .select()
          .from(releaseNotes)
          .where(
            sql`${eq(releaseNotes.project, project)} AND (${or(...conditions)})`
          )
          .orderBy(desc(releaseNotes.createdAt));
        return results;
      } else {
        const results = await db
          .select()
          .from(releaseNotes)
          .where(or(...conditions))
          .orderBy(desc(releaseNotes.createdAt));
        return results;
      }
    } catch (error) {
      console.error('Error searching release notes:', error);
      throw new Error('Failed to search release notes');
    }
  }

  async createReleaseNote(insertNote: InsertReleaseNote): Promise<ReleaseNote> {
    const [note] = await db
      .insert(releaseNotes)
      .values({
        ...insertNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    return note;
  }

  async updateReleaseNote(id: string, updates: UpdateReleaseNote): Promise<ReleaseNote> {
    const [updatedNote] = await db
      .update(releaseNotes)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(releaseNotes.id, id))
      .returning();
    
    if (!updatedNote) {
      throw new Error(`Release note with id ${id} not found`);
    }
    
    return updatedNote;
  }

  async deleteReleaseNote(id: string): Promise<boolean> {
    const result = await db
      .delete(releaseNotes)
      .where(eq(releaseNotes.id, id))
      .returning({ id: releaseNotes.id });
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();