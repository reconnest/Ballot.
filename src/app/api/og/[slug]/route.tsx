import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {

  try {
    const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
    if (!poll) {
      return new Response("Not found", { status: 404 });
    }

    const pollOptions = await db
      .select()
      .from(options)
      .where(eq(options.pollId, poll.id))
      .orderBy(options.position)
      .limit(4);

    const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
    const uniqueVoters = new Set(pollVotes.map((v) => v.voterToken)).size;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#FAFAF7",
            padding: "60px 80px",
            fontFamily: "sans-serif",
            color: "#14181A",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#14181A" }}>
                Ballot<span style={{ color: "#0F766E" }}>.</span>
              </span>
              <span style={{ fontSize: 16, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                LIVE POLL
              </span>
            </div>
            <div
              style={{
                backgroundColor: "#0F766E",
                color: "#FFFFFF",
                padding: "8px 20px",
                borderRadius: 24,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {uniqueVoters} {uniqueVoters === 1 ? "Vote" : "Votes"}
            </div>
          </div>

          {/* Question */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
            <h1
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: "#14181A",
                lineHeight: 1.25,
                margin: 0,
              }}
            >
              {poll.question.length > 90 ? poll.question.slice(0, 90) + "…" : poll.question}
            </h1>
          </div>

          {/* Top Options Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
            {pollOptions.map((opt, i) => (
              <div
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #E4E1D9",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#14181A",
                }}
              >
                <span>
                  {i + 1}. {opt.label}
                </span>
                <span style={{ color: "#0F766E", fontSize: 18, fontWeight: 700 }}>vote →</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 20,
              color: "#0F766E",
              fontSize: 16,
              fontWeight: 600,
              borderTop: "2px solid #E4E1D9",
              paddingTop: 16,
            }}
          >
            <span>🔒 Verified Poll · No Signup Required · 100% Free</span>
            <span style={{ color: "#6B7280" }}>ballot-poll.vercel.app</span>
          </div>
        </div>
      ),

      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
