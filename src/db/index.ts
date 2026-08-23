import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

export const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://ballot-reconnest.aws-ap-south-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

export const db = drizzle(client, { schema });

let schemaInitialized = false;

export async function ensureDbSchema() {
  if (schemaInitialized) return;
  try {
    // 1. Create users table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    // 2. Create auth_codes table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    // 3. Create sessions table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    // 4. Safely add new columns to polls table if missing
    const pollColumns = await client.execute("PRAGMA table_info(polls);");
    const existingCols = new Set(pollColumns.rows.map((r: any) => r.name));

    if (!existingCols.has("status")) {
      await client.execute("ALTER TABLE polls ADD COLUMN status TEXT DEFAULT 'live';");
    }
    if (!existingCols.has("allow_vote_edit")) {
      await client.execute("ALTER TABLE polls ADD COLUMN allow_vote_edit INTEGER DEFAULT 1;");
    }
    if (!existingCols.has("repolled_from")) {
      await client.execute("ALTER TABLE polls ADD COLUMN repolled_from TEXT;");
    }
    if (!existingCols.has("creator_user_id")) {
      await client.execute("ALTER TABLE polls ADD COLUMN creator_user_id TEXT;");
    }
    if (!existingCols.has("creator_name")) {
      await client.execute("ALTER TABLE polls ADD COLUMN creator_name TEXT;");
    }


    // 5. Purge all legacy/seeded polls that do not follow the agreed BPC- or BPP- prefix
    await client.execute(`
      DELETE FROM votes WHERE poll_id IN (
        SELECT id FROM polls WHERE slug NOT LIKE 'BPC-%' AND slug NOT LIKE 'BPP-%'
      );
    `);
    await client.execute(`
      DELETE FROM options WHERE poll_id IN (
        SELECT id FROM polls WHERE slug NOT LIKE 'BPC-%' AND slug NOT LIKE 'BPP-%'
      );
    `);
    await client.execute(`
      DELETE FROM polls WHERE slug NOT LIKE 'BPC-%' AND slug NOT LIKE 'BPP-%';
    `);

    // 6. Create rate_limits table for persistent cross-instance rate limiting (Fix 2.3)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL
      );
    `);

    // 7. Create ballot_locks table with primary key on (poll_id, voter_token) for race condition prevention
    await client.execute(`
      CREATE TABLE IF NOT EXISTS ballot_locks (
        poll_id TEXT NOT NULL,
        voter_token TEXT NOT NULL,
        ballot_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (poll_id, voter_token)
      );
    `);

    schemaInitialized = true;



  } catch (err) {
    console.error("Schema init error:", err);
  }
}


