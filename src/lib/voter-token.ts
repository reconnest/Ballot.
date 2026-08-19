import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const COOKIE_NAME = "voter_token";

/**
 * Reads the voter token from the incoming request cookie, or generates a new
 * one. If a new one was generated, it must be attached to the outgoing
 * response by the caller via attachVoterCookie().
 */
export function resolveVoterToken(req: NextRequest): { token: string; isNew: boolean } {
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing) return { token: existing, isNew: false };
  return { token: randomUUID(), isNew: true };
}

export function attachVoterCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
}

export function readVoterTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}
