import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getOrCreateVoterToken } from "@/lib/voter-token";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const optionId = (body.optionId ?? "").toString();

    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }
    if (poll.expiresAt && Date.now() > poll.expiresAt) {
      return NextResponse.json({ error: "This poll is closed." }, { status: 403 });
    }

    const [option] = await db
      .select()
      .from(options)
      .where(and(eq(options.id, optionId), eq(options.pollId, poll.id)))
      .limit(1);
    if (!option) {
      return NextResponse.json({ error: "Option not found." }, { status: 400 });
    }

    const voterToken = getOrCreateVoterToken();

    const [existing] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.pollId, poll.id), eq(votes.voterToken, voterToken)))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "You already voted on this poll." }, { status: 409 });
    }

    await db.insert(votes).values({
      id: nanoid(),
      pollId: poll.id,
      optionId,
      voterToken,
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vote failed", e);
    return NextResponse.json({ error: "Could not record vote." }, { status: 500 });
  }
}
