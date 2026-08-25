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
    let pollType = "standard";
    let pollOptions: { id: string; label: string; voteCount: number }[] = [];
    let voteCount = 0;

    try {
      const [poll] = await db.select().from(polls).where(eq(polls.slug, params.slug)).limit(1);
      if (poll) {
        question = poll.question;
        pollType = poll.pollType || "standard";
        const opts = await db
          .select()
          .from(options)
          .where(eq(options.pollId, poll.id))
          .orderBy(options.position)
          .limit(4);

        const pollVotes = await db.select().from(votes).where(eq(votes.pollId, poll.id));
        const uniqueVoters = new Set(pollVotes.map((v) => v.voterToken));
        voteCount = uniqueVoters.size;

        // Count votes per option
        const counts: Record<string, number> = {};
        for (const opt of opts) counts[opt.id] = 0;
        for (const v of pollVotes) {
          if (counts[v.optionId] !== undefined) counts[v.optionId]++;
        }

        pollOptions = opts.map((o) => ({ id: o.id, label: o.label, voteCount: counts[o.id] ?? 0 }));
      }
    } catch (dbErr) {
      console.error("DB error in OG route:", dbErr);
    }

    const hasVotes = voteCount > 0;
    const maxVotes = hasVotes ? Math.max(...pollOptions.map((o) => o.voteCount), 1) : 1;
    const pollTypeLabel = pollType === "ranked_choice" ? "Ranked Choice" : pollType === "image" ? "Image Poll" : "Standard Poll";

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
            padding: "52px 72px",
            fontFamily: "sans-serif",
            color: "#14181A",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: "#14181A", letterSpacing: "-1px" }}>
                Ballot<span style={{ color: "#0F766E" }}>.</span>
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "#0F766E",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  background: "#E8F2F0",
                  padding: "4px 12px",
                  borderRadius: 20,
                }}
              >
                {pollTypeLabel}
              </span>
            </div>
            <div
              style={{
                backgroundColor: hasVotes ? "#0F766E" : "#E4E1D9",
                color: hasVotes ? "#FFFFFF" : "#6B7280",
                padding: "8px 20px",
                borderRadius: 24,
                fontSize: 17,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
              }}
            >
              {voteCount} {voteCount === 1 ? "Vote" : "Votes"}
            </div>
          </div>

          {/* Question */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
            <h1
              style={{
                fontSize: question.length > 70 ? 40 : 50,
                fontWeight: 800,
                color: "#14181A",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {question.length > 90 ? question.slice(0, 90) + "…" : question}
            </h1>
          </div>

          {/* Options with vote bars or clean list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            {pollOptions.length > 0 ? (
              pollOptions.map((opt, i) => {
                const pct = hasVotes ? Math.round((opt.voteCount / maxVotes) * 100) : 0;
                const isWinner = hasVotes && opt.voteCount === maxVotes && opt.voteCount > 0;
                return (
                  <div
                    key={opt.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      backgroundColor: isWinner ? "#E8F2F0" : "#FFFFFF",
                      border: `2px solid ${isWinner ? "#0F766E" : "#E4E1D9"}`,
                      borderRadius: 10,
                      padding: "10px 20px",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 20, fontWeight: isWinner ? 700 : 500, color: isWinner ? "#0B5C56" : "#14181A" }}>
                        {i + 1}. {opt.label.length > 45 ? opt.label.slice(0, 45) + "…" : opt.label}
                        {isWinner && hasVotes ? " 🏆" : ""}
                      </span>
                      {hasVotes && (
                        <span style={{ fontSize: 16, fontWeight: 700, color: isWinner ? "#0F766E" : "#6B7280", fontFamily: "monospace" }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                    {hasVotes && (
                      <div style={{ height: 4, background: "#E4E1D9", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: isWinner ? "#0F766E" : "#9CA3AF", borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                );
              })
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
                  fontSize: 20,
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
              fontSize: 14,
              fontWeight: 600,
              borderTop: "2px solid #E4E1D9",
              paddingTop: 14,
            }}
          >
            <span>Free · No Signup for Voters · Real-Time Results</span>
            <span style={{ color: "#9CA3AF" }}>ballot-poll.vercel.app</span>
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


