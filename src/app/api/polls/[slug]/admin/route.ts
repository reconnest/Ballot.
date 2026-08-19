import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

function verifyAdminKey(key: string | null, hash: string | null): boolean {
  if (!key || !hash) return false;
  const computed = createHash("sha256").update(key.trim()).digest("hex");
  return computed === hash;
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-admin-key");
    if (!verifyAdminKey(key, poll.adminKeyHash)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key." }, { status: 401 });
    }

    const pollOptions = await db
      .select()
      .from(options)
      .where(eq(options.pollId, poll.id))
      .orderBy(options.position);

    const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));

    const counts: Record<string, number> = {};
    for (const o of pollOptions) counts[o.id] = 0;
    for (const v of pollVotes) counts[v.optionId] = (counts[v.optionId] ?? 0) + 1;

    const uniqueBallots = new Set(pollVotes.map((v) => v.voterToken)).size;

    return NextResponse.json({
      poll,
      options: pollOptions.map((o) => ({ ...o, votes: counts[o.id] ?? 0 })),
      totalBallots: uniqueBallots,
      totalSelections: pollVotes.length,
      votes: pollVotes.map((v) => ({
        id: v.id,
        optionId: v.optionId,
        voterName: v.voterName,
        createdAt: v.createdAt,
      })),
    });
  } catch (e) {
    console.error("admin get failed", e);
    return NextResponse.json({ error: "Could not fetch admin data." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const body = await req.json();
    const key = (body.adminKey ?? req.headers.get("x-admin-key") ?? "").toString();
    if (!verifyAdminKey(key, poll.adminKeyHash)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key." }, { status: 401 });
    }

    const updateFields: Partial<{
      expiresAt: number | null;
      resultsVisibility: string;
    }> = {};

    if (body.action === "close_now") {
      updateFields.expiresAt = Date.now();
    } else if (typeof body.expiresAt === "number" || body.expiresAt === null) {
      updateFields.expiresAt = body.expiresAt;
    }

    if (typeof body.resultsVisibility === "string") {
      const valid = ["always_public", "after_vote", "after_deadline", "creator_only"];
      if (valid.includes(body.resultsVisibility)) {
        updateFields.resultsVisibility = body.resultsVisibility;
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db.update(polls).set(updateFields).where(eq(polls.id, poll.id));
    }

    return NextResponse.json({ ok: true, updated: updateFields });
  } catch (e) {
    console.error("admin patch failed", e);
    return NextResponse.json({ error: "Could not update poll." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-admin-key");
    if (!verifyAdminKey(key, poll.adminKeyHash)) {
      return NextResponse.json({ error: "Unauthorized. Invalid admin key." }, { status: 401 });
    }

    // Delete votes, options, and poll
    await db.delete(votes).where(eq(votes.pollId, poll.id));
    await db.delete(options).where(eq(options.pollId, poll.id));
    await db.delete(polls).where(eq(polls.id, poll.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin delete failed", e);
    return NextResponse.json({ error: "Could not delete poll." }, { status: 500 });
  }
}
