import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { resolveVoterToken, attachVoterCookie } from "@/lib/voter-token";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const optionId = (body.optionId ?? "").toString();
    const voterName = body.voterName ? body.voterName.toString().trim().slice(0, 60) : null;

    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }
    if (poll.expiresAt && Date.now() > poll.expiresAt) {
      return NextResponse.json({ error: "This poll is closed." }, { status: 403 });
    }
    if (poll.requireName && !voterName) {
      return NextResponse.json({ error: "This poll requires your name." }, { status: 400 });
    }

    const [option] = await db
      .select()
      .from(options)
      .where(and(eq(options.id, optionId), eq(options.pollId, poll.id)))
      .limit(1);
    if (!option) {
      return NextResponse.json({ error: "Option not found." }, { status: 400 });
    }

    const { token: voterToken, isNew } = resolveVoterToken(req);

    const [existing] = await db
      .select()
      .from(votes)
      .where(and(eq(votes.pollId, poll.id), eq(votes.voterToken, voterToken)))
      .limit(1);
    if (existing) {
      const res = NextResponse.json({ error: "You already voted on this poll." }, { status: 409 });
      if (isNew) attachVoterCookie(res, voterToken);
      return res;
    }

    await db.insert(votes).values({
      id: nanoid(),
      pollId: poll.id,
      optionId,
      voterToken,
      voterName,
      createdAt: Date.now(),
    });

    const res = NextResponse.json({ ok: true });
    if (isNew) attachVoterCookie(res, voterToken);
    return res;
  } catch (e) {
    console.error("vote failed", e);
    return NextResponse.json({ error: "Could not record vote. Please try again." }, { status: 500 });
  }
}
