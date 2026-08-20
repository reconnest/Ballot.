import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await db.delete(sessions).where(eq(sessions.sessionToken, token));
    }
  } catch {}

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
