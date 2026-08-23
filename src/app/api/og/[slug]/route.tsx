import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { polls, options, votes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    let question = "Live Poll on Ballot";
    let pollOptions: { id: string; label: string }[] = [];
    let voteCount = 0;

    try {
      const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
      if (poll) {
        question = poll.question;
        const opts = await db
          .select()
          .from(options)
          .where(eq(options.pollId, poll.id))
          .orderBy(options.position)
          .limit(4);
        pollOptions = opts;

        const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        voteCount = new Set(pollVotes.map((v) => v.voterToken)).size;
      }
    } catch (dbErr) {
      console.error("DB error in OG route:", dbErr);
    }

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
              <span style={{ fontSize: 36, fontWeight: 800, color: "#14181A" }}>
                Ballot<span style={{ color: "#0F766E" }}>.</span>
              </span>
              <span style={{ fontSize: 16, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                LIVE POLL
              </span>
            </div>
            <div
              style={{
                backgroundColor: "#0F766E",
                color: "#FFFFFF",
                padding: "8px 22px",
                borderRadius: 24,
                fontSize: 18,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
              }}
            >
              {voteCount} {voteCount === 1 ? "Vote" : "Votes"}
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
              {question.length > 90 ? question.slice(0, 90) + "…" : question}
            </h1>
          </div>

          {/* Top Options Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
            {pollOptions.length > 0 ? (
              pollOptions.map((opt, i) => (
                <div
                  key={opt.id || i}
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
                  <span style={{ color: "#0F766E", fontSize: 18, fontWeight: 700 }}>Vote →</span>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #E4E1D9",
                  borderRadius: 10,
                  padding: "16px 24px",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#0F766E",
                }}
              >
                Tap to view options & cast your vote →
              </div>
            )}
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
            <span>Verified Poll · No Signup Required · 100% Free</span>

            <span style={{ color: "#6B7280" }}>ballot-poll.vercel.app</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: any) {
    console.error("Critical OG error:", err);
    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#FAFAF7"/><text x="80" y="120" font-family="sans-serif" font-size="44" font-weight="bold" fill="#14181A">Ballot<tspan fill="#0F766E">.</tspan></text><text x="80" y="260" font-family="sans-serif" font-size="48" font-weight="bold" fill="#14181A">Live Poll — Cast your vote</text><text x="80" y="340" font-family="sans-serif" font-size="28" fill="#6B7280">100% free · Zero signup required · Instant results</text><rect x="80" y="420" width="300" height="60" rx="30" fill="#0F766E"/><text x="130" y="460" font-family="sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">Vote on Ballot →</text></svg>`;
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }
}

