import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  link: text("link"),
  status: text("status").notNull().default("not-started"),
  order: text("order").notNull().default("0"),
  project: text("project").notNull().default("default"),
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
});

export const updateCardSchema = createInsertSchema(cards).omit({
  id: true,
}).partial();

export type InsertCard = z.infer<typeof insertCardSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;
export type Card = typeof cards.$inferSelect;

export const KANBAN_STATUSES = [
  "not-started",
  "blocked", 
  "in-progress",
  "complete",
  "verified"
] as const;

export type KanbanStatus = typeof KANBAN_STATUSES[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
