import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db, ensureDbSchema } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    return NextResponse.json({ user }, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        "Pragma": "no-cache",
      }
    });
  } catch (err) {
    return NextResponse.json({ user: null }, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      }
    });
  }
}


export async function PATCH(req: NextRequest) {
  try {
    await ensureDbSchema();
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : null;

    if (displayName !== null) {
      if (displayName.length < 2 || displayName.length > 50) {
        return NextResponse.json({ error: "Display name must be between 2 and 50 characters." }, { status: 400 });
      }
      await db.update(users).set({ displayName }).where(eq(users.id, user.id));
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    return NextResponse.json({
      ok: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
      }
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: "Could not update settings." }, { status: 500 });
  }
}



