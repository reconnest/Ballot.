import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "voter_token";

export function getOrCreateVoterToken(): string {
  const store = cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const token = randomUUID();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
  return token;
}

export function readVoterToken(): string | null {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}
