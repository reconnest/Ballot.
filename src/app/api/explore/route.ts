import { NextRequest, NextResponse } from "next/server";
import { db, ensureDbSchema } from "@/db";
import { polls, votes, options, users } from "@/db/schema";
import { eq, desc, sql, and, ne, like } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const query = searchParams.get("q")?.toLowerCase() || "";
    const filter = searchParams.get("filter") || "trending"; // 'trending' | 'recent' | 'active'

    // Fetch public community polls strictly matching BPC- prefix and excluding deleted
    const publicPolls = await db
      .select({
        id: polls.id,
        slug: polls.slug,
        question: polls.question,
        description: polls.description,
        pollType: polls.pollType,
        category: polls.category,
        allowMultiple: polls.allowMultiple,
        status: polls.status,
        repolledFrom: polls.repolledFrom,
        createdAt: polls.createdAt,
        expiresAt: polls.expiresAt,
        creatorUserId: polls.creatorUserId,
      })
      .from(polls)
      .where(
        and(
          eq(polls.isPublic, 1),
          ne(polls.status, "deleted"),
          like(polls.slug, "BPC-%")
        )
      )
      .orderBy(desc(polls.createdAt))
      .limit(60);


    // Fetch all creators for enrichment
    const allUsers = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl }).from(users);
    const userById = new Map(allUsers.map((u) => [u.id, u]));

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
      const isInactive = p.status === "inactive" || isExpired;
      const creator = p.creatorUserId ? userById.get(p.creatorUserId) || null : null;

      return {
        ...p,
        voteCount,
        isExpired,
        isInactive,
        creator,
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

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") || "24")));
    const offset = (page - 1) * limit;

    const paginatedPolls = items.slice(offset, offset + limit);
    const hasMore = offset + limit < items.length;

    return NextResponse.json(
      {
        polls: paginatedPolls,
        total: items.length,
        page,
        limit,
        hasMore,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );

  } catch (e) {

    console.error("explore fetch failed", e);
    return NextResponse.json({ error: "Could not load explore feed." }, { status: 500 });
  }
}
