import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";

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

// In-memory token bucket rate limiters
type RateBucket = { count: number; resetAt: number };
const creationBuckets = new Map<string, RateBucket>();
const voteBuckets = new Map<string, RateBucket>();
const pollVelocityTracker = new Map<string, { count: number; windowStart: number }>();

/**
 * Rate limits poll creation: max 12 polls per 10 minutes per IP/session.
 */
export function checkPollCreationRateLimit(identifier: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxAllowed = 12;

  const bucket = creationBuckets.get(identifier);
  if (!bucket || now > bucket.resetAt) {
    creationBuckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxAllowed) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Tracks vote velocity on a specific poll to detect rapid bot bursts.
 * Returns true if velocity exceeds 40 votes / 30 seconds.
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
