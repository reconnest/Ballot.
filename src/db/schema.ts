import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(), // Normalized lowercase handle (e.g. 'sandeep')
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: integer("created_at").notNull(),
});

export const authCodes = sqliteTable("auth_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(), // sha256 hash of 6-digit OTP
  attempts: integer("attempts").notNull().default(0), // max 5 attempts before lockout
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(), // 10 minutes expiry
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(), // 30 days
});

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(), // BPC-xxxx (Community) | BPP-xxxx (Private)
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
  status: text("status").notNull().default("live"), // 'live' | 'inactive' | 'deleted'
  allowVoteEdit: integer("allow_vote_edit").notNull().default(1), // 1 = enabled, 0 = disabled
  repolledFrom: text("repolled_from"), // points to previous round's slug
  ipSalt: text("ip_salt"),
  adminKeyHash: text("admin_key_hash"),
  creatorUserId: text("creator_user_id"), // FK to users.id
  creatorName: text("creator_name"), // Max enforced at API layer (80 chars)
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

// ── Fix 2.3: Persistent rate limits — works across all Vercel serverless instances ──
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),        // e.g. "create:ip:1.2.3.4"
  count: integer("count").notNull().default(1),
  resetAt: integer("reset_at").notNull(), // Unix ms timestamp when window resets
});





