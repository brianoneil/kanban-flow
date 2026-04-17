import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const KANBAN_STATUSES = [
  "not-started",
  "blocked", 
  "in-progress",
  "complete",
  "verified"
] as const;

export type KanbanStatus = typeof KANBAN_STATUSES[number];

export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  link: text("link"),
  status: text("status").notNull().default("not-started"),
  order: text("order").notNull().default("0"),
  project: text("project").notNull().default("default"),
  taskList: text("task_list"), // JSON array of task items with completion status
  notes: text("notes"), // Additional notes field for extra context and information
  comments: text("comments"), // JSON array of comments with timestamps and content
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
}).extend({
  status: z.enum(KANBAN_STATUSES).default("not-started"),
});

export const updateCardSchema = createInsertSchema(cards).omit({
  id: true,
}).extend({
  status: z.enum(KANBAN_STATUSES).optional(),
}).partial();

export type InsertCard = z.infer<typeof insertCardSchema>;
export type UpdateCard = z.infer<typeof updateCardSchema>;
export type Card = typeof cards.$inferSelect;

// Comment type for card comments
export interface Comment {
  id: string;
  content: string;
  timestamp: string;
  author?: string; // Optional for future use with authentication
}

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

// Release Notes table for project-based release notes
export const releaseNotes = pgTable("release_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project: text("project").notNull(),
  version: text("version"), // Optional version number for the release
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown formatted content
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  author: text("author"), // Optional author name
  tags: text("tags"), // JSON array of tags for categorization
  storyReferences: text("story_references"), // JSON array of {id, url} for linked stories
});

export const insertReleaseNoteSchema = createInsertSchema(releaseNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateReleaseNoteSchema = createInsertSchema(releaseNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InsertReleaseNote = z.infer<typeof insertReleaseNoteSchema>;
export type UpdateReleaseNote = z.infer<typeof updateReleaseNoteSchema>;
export type ReleaseNote = typeof releaseNotes.$inferSelect;

// Story Reference type for release notes
export interface StoryReference {
  id: string;
  url: string;
  title?: string;
}
