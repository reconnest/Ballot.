import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  question: text("question").notNull(),
  description: text("description"),
  allowMultiple: integer("allow_multiple").notNull().default(0),
  minChoices: integer("min_choices").notNull().default(1),
  maxChoices: integer("max_choices"),
  resultsVisibility: text("results_visibility").notNull().default("always_public"),
  requireName: integer("require_name").notNull().default(0),
  adminKeyHash: text("admin_key_hash"),
  creatorUserId: text("creator_user_id"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
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
  ballotId: text("ballot_id"),
  idempotencyKey: text("idempotency_key"),
  createdAt: integer("created_at").notNull(),
});

