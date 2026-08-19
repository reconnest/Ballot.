import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { polls, votes, options } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const query = searchParams.get("q")?.toLowerCase() || "";
    const filter = searchParams.get("filter") || "trending"; // 'trending' | 'recent' | 'active'

    // Fetch public polls
    const publicPolls = await db
      .select({
        id: polls.id,
        slug: polls.slug,
        question: polls.question,
        description: polls.description,
        pollType: polls.pollType,
        category: polls.category,
        allowMultiple: polls.allowMultiple,
        createdAt: polls.createdAt,
        expiresAt: polls.expiresAt,
      })
      .from(polls)
      .where(and(eq(polls.isPublic, 1), eq(polls.resultsVisibility, "always_public")))
      .orderBy(desc(polls.createdAt))
      .limit(60);

    // Compute vote counts for each poll
    const allVotes = await db.select({ pollId: votes.pollId, voterToken: votes.voterToken }).from(votes);
    const voteCountByPoll: Record<string, number> = {};
    const voterSetByPoll: Record<string, Set<string>> = {};

    for (const v of allVotes) {
      if (!voterSetByPoll[v.pollId]) voterSetByPoll[v.pollId] = new Set();
      voterSetByPoll[v.pollId].add(v.voterToken);
    }
    for (const pollId in voterSetByPoll) {
      voteCountByPoll[pollId] = voterSetByPoll[pollId].size;
    }

    const now = Date.now();

    // Map and enrich items
    let items = publicPolls.map((p) => {
      const voteCount = voteCountByPoll[p.id] || 0;
      const isExpired = p.expiresAt ? now > p.expiresAt : false;
      return {
        ...p,
        voteCount,
        isExpired,
      };
    });

    // Apply text search
    if (query) {
      items = items.filter(
        (p) =>
          p.question.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (category && category !== "all") {
      items = items.filter((p) => (p.category || "general").toLowerCase() === category.toLowerCase());
    }

    // Sort based on filter
    if (filter === "trending") {
      items.sort((a, b) => b.voteCount - a.voteCount || b.createdAt - a.createdAt);
    } else if (filter === "active") {
      items = items.filter((p) => !p.isExpired);
      items.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      // Recent
      items.sort((a, b) => b.createdAt - a.createdAt);
    }

    return NextResponse.json({
      polls: items.slice(0, 30),
      total: items.length,
    });
  } catch (e) {
    console.error("explore fetch failed", e);
    return NextResponse.json({ error: "Could not load explore feed." }, { status: 500 });
  }
}
