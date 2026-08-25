import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, options, votes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readVoterTokenFromRequest } from "@/lib/voter-token";
import { createHash } from "crypto";
import { getSessionUser } from "@/lib/auth";

import { calculateRankedPoints } from "@/lib/ranking";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";



export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {

  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll || poll.status === "deleted") {
      return NextResponse.json({ error: "Poll not found or has been removed." }, { status: 404 });
    }

    const sessionUser = await getSessionUser(req);

    // Check if requester provides a valid creator admin key OR is logged in as the poll's creator
    const urlKey = req.nextUrl.searchParams.get("key") ?? req.nextUrl.searchParams.get("adminKey");
    const headerKey = req.headers.get("x-admin-key");
    const providedKey = urlKey || headerKey;
    let isAdmin = false;

    if (poll.creatorUserId) {
      // If poll belongs to an authenticated user, ONLY that creator user has admin rights
      if (sessionUser && sessionUser.id === poll.creatorUserId) {
        isAdmin = true;
      }
    } else {
      // If poll was created as a guest, verify via secret adminKey
      if (providedKey && poll.adminKeyHash) {
        const hashed = createHash("sha256").update(providedKey.trim()).digest("hex");
        isAdmin = hashed === poll.adminKeyHash;
      }
    }

    // Fetch creator profile if attached
    let creatorProfile = null;
    if (poll.creatorUserId) {
      const [creatorUser] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, poll.creatorUserId))
        .limit(1);

      if (creatorUser) creatorProfile = creatorUser;
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
    const isInactive = poll.status === "inactive" || isExpired;

    // Calculate unique ballots (distinct ballotIds or voterTokens)
    const totalBallots = new Set(pollVotes.map((v) => v.ballotId || v.voterToken)).size;


    // Determine results visibility
    const visibility = poll.resultsVisibility || "always_public";
    let canViewResults = false;
    if (isAdmin) {
      canViewResults = true;
    } else if (visibility === "always_public") {
      canViewResults = true;
    } else if (visibility === "after_vote") {
      canViewResults = hasVoted || isInactive;
    } else if (visibility === "after_deadline") {
      canViewResults = isInactive;
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

    // Calculate Ranked Points Consensus if ranked choice
    let rankedPointsResult = null;
    if (poll.pollType === "ranked_choice" && canViewResults) {
      const ballotGroups = new Map<string, { optionId: string; rankPosition: number | null }[]>();
      for (const v of pollVotes) {
        const key = v.ballotId || v.voterToken;
        if (!ballotGroups.has(key)) {
          ballotGroups.set(key, []);
        }
        ballotGroups.get(key)!.push({
          optionId: v.optionId,
          rankPosition: v.rankPosition ?? null,
        });
      }

      const ballots: string[][] = [];
      for (const items of ballotGroups.values()) {
        items.sort((a, b) => (a.rankPosition ?? 999) - (b.rankPosition ?? 999));
        ballots.push(items.map((i) => i.optionId));
      }

      rankedPointsResult = calculateRankedPoints(pollOptions, ballots);
    }


    return NextResponse.json({
      id: poll.id,
      slug: poll.slug,
      question: poll.question,
      description: poll.description,
      status: poll.status || "live",
      allowVoteEdit: poll.allowVoteEdit === 1,
      repolledFrom: poll.repolledFrom || null,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      isExpired,
      isInactive,
      requireName: !!poll.requireName,
      pollType: poll.pollType || "standard",
      category: poll.category || "general",
      isPublic: poll.isPublic === 1,
      allowMultiple: !!poll.allowMultiple,
      minChoices: poll.minChoices ?? 1,
      maxChoices: poll.maxChoices,
      resultsVisibility: visibility,
      securityMode: poll.securityMode || "standard",
      creator: creatorProfile,
      creatorName: poll.creatorName || (poll.creatorUserId ? null : "Guest"),
      options: pollOptions.map((o) => ({

        id: o.id,
        label: o.label,
        imageUrl: o.imageUrl,
        votes: canViewResults ? (counts[o.id] ?? 0) : null,
      })),
      rankedPointsResult,

      totalVotes: canViewResults ? totalBallots : null,
      totalSelections: canViewResults ? pollVotes.length : null,
      myVote: poll.securityMode === "unlimited" ? null : myVote,
      myVotes: poll.securityMode === "unlimited" ? [] : myVotesList,
      hasVoted,
      canViewResults,
      isAdmin,
      voters: voterList,
    }, {


      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (e) {

    console.error("get poll failed", e);
    return NextResponse.json({ error: "Could not load poll." }, { status: 500 });
  }
}
