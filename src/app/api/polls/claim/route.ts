import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "You must be logged in to claim polls." }, { status: 401 });
    }

    const body = await req.json();
    const slug = (body.slug ?? "").toString().trim();
    const adminKey = (body.adminKey ?? "").toString().trim();

    if (!slug || !adminKey) {
      return NextResponse.json({ error: "Slug and secret admin key are required." }, { status: 400 });
    }

    const [poll] = await db.select().from(polls).where(eq(polls.slug, slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const keyHash = createHash("sha256").update(adminKey).digest("hex");
    if (poll.adminKeyHash !== keyHash) {
      return NextResponse.json({ error: "Invalid admin key for this poll." }, { status: 403 });
    }

    // Attach poll to user
    await db
      .update(polls)
      .set({ creatorUserId: user.id })
      .where(eq(polls.id, poll.id));

    return NextResponse.json({ ok: true, message: `Poll ${slug} claimed to @${user.username}` });
  } catch (err) {
    console.error("claim poll failed", err);
    return NextResponse.json({ error: "Could not claim poll." }, { status: 500 });
  }
}
