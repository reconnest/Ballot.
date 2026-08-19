import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  question: text("question").notNull(),
  description: text("description"),
  pollType: text("poll_type").notNull().default("standard"), // 'standard' | 'ranked_choice' | 'image' | 'availability'
  isPublic: integer("is_public").notNull().default(1),
  category: text("category").default("general"),
  allowMultiple: integer("allow_multiple").notNull().default(0),
  minChoices: integer("min_choices").notNull().default(1),
  maxChoices: integer("max_choices"),
  resultsVisibility: text("results_visibility").notNull().default("always_public"),
  requireName: integer("require_name").notNull().default(0),
  securityMode: text("security_mode").notNull().default("standard"),
  ipSalt: text("ip_salt"),
  adminKeyHash: text("admin_key_hash"),
  creatorUserId: text("creator_user_id"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at"),
});

export const options = sqliteTable("options", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  label: text("label").notNull(),
  imageUrl: text("image_url"),
  slotDetails: text("slot_details"),
  position: integer("position").notNull(),
});

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(),
  pollId: text("poll_id").notNull(),
  optionId: text("option_id").notNull(),
  voterToken: text("voter_token").notNull(),
  voterName: text("voter_name"),
  ipHash: text("ip_hash"),
  ballotId: text("ballot_id"),
  rankPosition: integer("rank_position"), // 1, 2, 3... for ranked choice
  availabilityResponse: text("availability_response"), // 'yes' | 'maybe' | 'no'
  idempotencyKey: text("idempotency_key"),
  createdAt: integer("created_at").notNull(),
});



