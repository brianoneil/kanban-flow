import { type User, type InsertUser, type Card, type InsertCard, type UpdateCard } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Card operations
  getAllCards(): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: string, updates: UpdateCard): Promise<Card>;
  deleteCard(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private cards: Map<string, Card>;

  constructor() {
    this.users = new Map();
    this.cards = new Map();
    this.seedCards();
  }

  private seedCards() {
    const sampleCards: Card[] = [
      {
        id: "1",
        title: "User Authentication System",
        description: "Implement secure user login and registration with OAuth integration for Google and GitHub providers.",
        link: "https://example.com/auth-spec",
        status: "not-started"
      },
      {
        id: "2", 
        title: "Database Schema Design",
        description: "Design and create database schema for user management and task tracking with proper relationships.",
        link: "https://example.com/db-design",
        status: "not-started"
      },
      {
        id: "3",
        title: "Mobile App Wireframes", 
        description: "Create detailed wireframes for mobile application user interface and user experience.",
        link: "https://example.com/wireframes",
        status: "not-started"
      },
      {
        id: "4",
        title: "API Integration Testing",
        description: "Waiting for third-party API documentation to complete integration testing.",
        link: "https://example.com/api-docs",
        status: "blocked"
      },
      {
        id: "5",
        title: "Frontend Component Library",
        description: "Building reusable React components for the design system with TypeScript support.",
        link: "https://example.com/components",
        status: "in-progress"
      },
      {
        id: "6",
        title: "Payment Gateway Setup",
        description: "Implementing Stripe payment processing with secure checkout flow and webhook handling.",
        link: "https://example.com/payments",
        status: "in-progress"
      },
      {
        id: "7",
        title: "User Dashboard UI",
        description: "Responsive dashboard interface with analytics widgets and user profile management.",
        link: "https://example.com/dashboard",
        status: "complete"
      },
      {
        id: "8",
        title: "Email Notification System",
        description: "Automated email notifications for user actions with customizable templates.",
        link: "https://example.com/notifications",
        status: "complete"
      },
      {
        id: "9",
        title: "Security Audit",
        description: "Comprehensive security review and penetration testing completed successfully.",
        link: "https://example.com/security",
        status: "verified"
      }
    ];

    sampleCards.forEach(card => {
      this.cards.set(card.id, card);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllCards(): Promise<Card[]> {
    return Array.from(this.cards.values());
  }

  async getCard(id: string): Promise<Card | undefined> {
    return this.cards.get(id);
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const id = randomUUID();
    const card: Card = { ...insertCard, id };
    this.cards.set(id, card);
    return card;
  }

  async updateCard(id: string, updates: UpdateCard): Promise<Card> {
    const existingCard = this.cards.get(id);
    if (!existingCard) {
      throw new Error(`Card with id ${id} not found`);
    }
    
    const updatedCard: Card = { ...existingCard, ...updates };
    this.cards.set(id, updatedCard);
    return updatedCard;
  }

  async deleteCard(id: string): Promise<boolean> {
    return this.cards.delete(id);
  }
}

export const storage = new MemStorage();
