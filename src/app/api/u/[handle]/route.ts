import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, polls, votes } from "@/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { readVoterTokenFromRequest } from "@/lib/voter-token";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  try {
    const rawHandle = (params.handle ?? "").toString().trim().toLowerCase();
    const handle = rawHandle.replace(/^@/, "");

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.username, handle))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    const sessionUser = await getSessionUser(req);
    const isOwner = sessionUser ? sessionUser.id === user.id : false;
    const myToken = readVoterTokenFromRequest(req);

    // Fetch user's public polls
    const userPolls = await db
      .select({
        id: polls.id,
        slug: polls.slug,
        question: polls.question,
        pollType: polls.pollType,
        category: polls.category,
        status: polls.status,
        createdAt: polls.createdAt,
        expiresAt: polls.expiresAt,
      })
      .from(polls)
      .where(
        and(
          eq(polls.creatorUserId, user.id),
          eq(polls.isPublic, 1),
          ne(polls.status, "deleted")
        )
      )
      .orderBy(desc(polls.createdAt));

    // Calculate votes for each poll
    const allVotes = await db.select({ pollId: votes.pollId, voterToken: votes.voterToken }).from(votes);
    const votesByPoll: Record<string, Set<string>> = {};
    const myVotedPollIds = new Set<string>();

    for (const v of allVotes) {
      if (!votesByPoll[v.pollId]) votesByPoll[v.pollId] = new Set();
      votesByPoll[v.pollId].add(v.voterToken);
      if (myToken && v.voterToken === myToken) {
        myVotedPollIds.add(v.pollId);
      }
    }

    let totalVotes = 0;
    const enrichedPolls = userPolls.map((p) => {
      const count = (votesByPoll[p.id] || new Set()).size;
      totalVotes += count;
      return {
        ...p,
        voteCount: count,
        isExpired: p.expiresAt ? Date.now() > p.expiresAt : false,
        hasVoted: myVotedPollIds.has(p.id),
      };
    });

    return NextResponse.json({
      creator: user,
      polls: enrichedPolls,
      totalVotes,
      isOwner,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });

  } catch (err) {
    console.error("user profile api error:", err);
    return NextResponse.json({ error: "Could not load creator profile." }, { status: 500 });
  }
}
