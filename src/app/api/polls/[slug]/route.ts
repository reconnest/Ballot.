import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readVoterToken } from "@/lib/voter-token";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
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

    const myToken = readVoterToken();
    const myVote = myToken ? pollVotes.find((v) => v.voterToken === myToken)?.optionId ?? null : null;

    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;

    return NextResponse.json({
      question: poll.question,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      isExpired,
      options: pollOptions.map((o) => ({ id: o.id, label: o.label, votes: counts[o.id] ?? 0 })),
      totalVotes: pollVotes.length,
      myVote,
    });
  } catch (e) {
    console.error("get poll failed", e);
    return NextResponse.json({ error: "Could not load poll." }, { status: 500 });
  }
}
