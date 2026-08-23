import { NextResponse } from "next/server";
import { db } from "@/db";
import { polls, votes } from "@/db/schema";
import { ne, count, countDistinct, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 10;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const [pollsResult] = await db
      .select({ count: count() })
      .from(polls)
      .where(ne(polls.status, "deleted"));

    const [votesResult] = await db
      .select({ count: countDistinct(sql`COALESCE(${votes.ballotId}, ${votes.voterToken})`) })
      .from(votes);


    const totalPolls = Number(pollsResult?.count || 0);
    const totalVotes = Number(votesResult?.count || 0);

    return NextResponse.json(
      {
        totalPolls,
        totalVotes,
        updatedAt: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/stats] Error:", error);
    return NextResponse.json(
      { totalPolls: 0, totalVotes: 0, updatedAt: Date.now() },
      { status: 500 }
    );
  }
}
