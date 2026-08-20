import { db } from "@/db";
import { users, sessions, authCodes } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "ballot_creator_session";

export const RESERVED_HANDLES = new Set([
  "new", "explore", "api", "p", "u", "embed", "admin", "login",
  "signup", "auth", "logout", "dashboard", "ballot", "settings",
  "help", "about", "terms", "privacy", "status", "root", "null",
  "undefined", "creator", "user", "poll", "polls", "community", "explore"
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase().trim());
}

export function validateHandle(handle: string): { valid: boolean; error?: string } {
  const clean = handle.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 20) {
    return { valid: false, error: "Handle must be between 3 and 20 characters." };
  }
  if (!/^[a-z0-9_-]+$/.test(clean)) {
    return { valid: false, error: "Handle can only contain letters, numbers, underscores, and hyphens." };
  }
  if (isReservedHandle(clean)) {
    return { valid: false, error: "This handle is reserved. Please choose another." };
  }
  return { valid: true };
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  await db.insert(sessions).values({
    id: nanoid(),
    userId,
    sessionToken,
    createdAt: now,
    expiresAt,
  });

  return sessionToken;
}

export async function getSessionUser(req: NextRequest): Promise<{ id: string; email: string; username: string; displayName: string; avatarUrl?: string | null; bio?: string | null } | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const now = Date.now();
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.sessionToken, token), gt(sessions.expiresAt, now)))
      .limit(1);

    if (!session) return null;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return user || null;
  } catch (err) {
    console.error("getSessionUser error:", err);
    return null;
  }
}

export function attachSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
