import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Extracts client IP address safely from standard proxy headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Generates a cryptographically random salt for per-poll IP hashing.
 */
export function generateIpSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Produces a one-way salted SHA-256 hash of the voter's IP address.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

// ── Fix 2.3: In-memory velocity tracker is fine (per-request debounce, not cross-instance) ──
// Only the creation rate limiter needs cross-instance persistence via DB.
// Vote velocity is per-request and intentionally resets per cold start.
type VelocityEntry = { count: number; windowStart: number };
const pollVelocityTracker = new Map<string, VelocityEntry>();

/**
 * Rate limits poll creation: max 12 polls per 10 minutes per IP.
 * ── Fix 2.3: Uses DB persistence — works correctly across all Vercel serverless instances ──
 */
export async function checkPollCreationRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAllowed = 12;
  const key = `create:ip:${identifier}`;

  try {
    const [existing] = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    if (!existing || now > existing.resetAt) {
      // New window — upsert with count = 1
      await db
        .insert(rateLimits)
        .values({ key, count: 1, resetAt: now + windowMs })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, resetAt: now + windowMs },
        });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= maxAllowed) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    // Increment count within the current window
    await db
      .insert(rateLimits)
      .values({ key, count: existing.count + 1, resetAt: existing.resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: existing.count + 1 },
      });

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (err) {
    // On DB error, fail open (allow the request) to prevent blocking legitimate users
    console.error("[rate-limit] DB error, failing open:", err);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Tracks vote velocity on a specific poll to detect rapid bot bursts.
 * Returns true if velocity exceeds 40 votes / 30 seconds.
 * (In-memory is fine here — this is per-instance burst detection, not global)
 */
export function checkPollAnomalyVelocity(pollId: string): boolean {
  const now = Date.now();
  const windowMs = 30 * 1000;
  const burstThreshold = 40;

  const tracker = pollVelocityTracker.get(pollId);
  if (!tracker || now - tracker.windowStart > windowMs) {
    pollVelocityTracker.set(pollId, { count: 1, windowStart: now });
    return false;
  }

  tracker.count += 1;
  return tracker.count > burstThreshold;
}



/**
 * Validates Cloudflare Turnstile token if configured.
 */
export async function verifyTurnstileToken(token: string | null | undefined, remoteIp: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // If no secret key is configured in environment, permit in test/dev mode
    return !!token;
  }
  if (!token) return false;

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    formData.append("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const outcome = await res.json();
    return !!outcome.success;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}
