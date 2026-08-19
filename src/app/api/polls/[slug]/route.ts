import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readVoterTokenFromRequest } from "@/lib/voter-token";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
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

    const labelById: Record<string, string> = {};
    for (const o of pollOptions) labelById[o.id] = o.label;

    const counts: Record<string, number> = {};
    for (const o of pollOptions) counts[o.id] = 0;
    for (const v of pollVotes) counts[v.optionId] = (counts[v.optionId] ?? 0) + 1;

    const myToken = readVoterTokenFromRequest(req);
    const myVote = myToken ? pollVotes.find((v) => v.voterToken === myToken)?.optionId ?? null : null;

    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;

    const voterList = poll.requireName
      ? pollVotes
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((v) => ({
            name: v.voterName ?? "Anonymous",
            choice: labelById[v.optionId] ?? "—",
          }))
      : [];

    return NextResponse.json({
      question: poll.question,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      isExpired,
      requireName: !!poll.requireName,
      options: pollOptions.map((o) => ({ id: o.id, label: o.label, votes: counts[o.id] ?? 0 })),
      totalVotes: pollVotes.length,
      myVote,
      voters: voterList,
    });
  } catch (e) {
    console.error("get poll failed", e);
    return NextResponse.json({ error: "Could not load poll." }, { status: 500 });
  }
}
