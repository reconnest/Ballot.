import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  question: text("question").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
  requireName: integer("require_name").notNull().default(0),
});

export const options = sqliteTable("options", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull(),
});

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  optionId: text("option_id").notNull(),
  voterToken: text("voter_token").notNull(),
  voterName: text("voter_name"),
  createdAt: integer("created_at").notNull(),
});
