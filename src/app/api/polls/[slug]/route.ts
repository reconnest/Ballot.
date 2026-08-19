import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readVoterTokenFromRequest } from "@/lib/voter-token";
import { createHash } from "crypto";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }

    // Check if requester provides a valid creator admin key
    const urlKey = req.nextUrl.searchParams.get("key") ?? req.nextUrl.searchParams.get("adminKey");
    const headerKey = req.headers.get("x-admin-key");
    const providedKey = urlKey || headerKey;
    let isAdmin = false;
    if (providedKey && poll.adminKeyHash) {
      const hashed = createHash("sha256").update(providedKey.trim()).digest("hex");
      isAdmin = hashed === poll.adminKeyHash;
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
    const myVotesList = myToken ? pollVotes.filter((v) => v.voterToken === myToken).map((v) => v.optionId) : [];
    const hasVoted = myVotesList.length > 0;
    const myVote = myVotesList.length > 0 ? myVotesList[0] : null;

    const isExpired = poll.expiresAt ? Date.now() > poll.expiresAt : false;

    // Calculate unique ballots (distinct voterTokens or ballotIds)
    const uniqueVoters = new Set(pollVotes.map((v) => v.voterToken)).size;

    // Determine results visibility
    const visibility = poll.resultsVisibility || "always_public";
    let canViewResults = false;
    if (isAdmin) {
      canViewResults = true;
    } else if (visibility === "always_public") {
      canViewResults = true;
    } else if (visibility === "after_vote") {
      canViewResults = hasVoted || isExpired;
    } else if (visibility === "after_deadline") {
      canViewResults = isExpired;
    } else if (visibility === "creator_only") {
      canViewResults = false;
    }

    // Group voter entries if names are required and results are visible
    const voterMap: Record<string, { name: string; choices: string[] }> = {};
    if (poll.requireName && canViewResults) {
      for (const v of pollVotes) {
        const key = v.ballotId || v.voterToken;
        if (!voterMap[key]) {
          voterMap[key] = {
            name: v.voterName ?? "Anonymous",
            choices: [],
          };
        }
        if (labelById[v.optionId]) {
          voterMap[key].choices.push(labelById[v.optionId]);
        }
      }
    }

    const voterList = Object.values(voterMap);

    return NextResponse.json({
      question: poll.question,
      description: poll.description,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      isExpired,
      requireName: !!poll.requireName,
      allowMultiple: !!poll.allowMultiple,
      minChoices: poll.minChoices ?? 1,
      maxChoices: poll.maxChoices,
      resultsVisibility: visibility,
      options: pollOptions.map((o) => ({
        id: o.id,
        label: o.label,
        votes: canViewResults ? (counts[o.id] ?? 0) : null,
      })),
      totalVotes: canViewResults ? uniqueVoters : null,
      totalSelections: canViewResults ? pollVotes.length : null,
      myVote,
      myVotes: myVotesList,
      hasVoted,
      canViewResults,
      isAdmin,
      voters: voterList,
    });
  } catch (e) {
    console.error("get poll failed", e);
    return NextResponse.json({ error: "Could not load poll." }, { status: 500 });
  }
}

