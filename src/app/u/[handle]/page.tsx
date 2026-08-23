"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Search, Lock } from "lucide-react";




type CreatorProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: number;
};

type UserPoll = {
  id: string;
  slug: string;
  question: string;
  pollType: string;
  category: string;
  status: string;
  isPublic?: number;
  voteCount: number;
  isExpired: boolean;
  expiresAt?: number | null;
  hasVoted?: boolean;
  createdAt: number;
};



export default function CreatorProfilePage() {
  const params = useParams();
  const rawHandle = (params.handle as string) || "";
  const handle = rawHandle.replace(/^@/, "").toLowerCase();

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [polls, setPolls] = useState<UserPoll[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch(`/api/u/${handle}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCreator(data.creator);
          setPolls(data.polls || []);
          setTotalVotes(data.totalVotes || 0);
          setIsOwner(!!data.isOwner);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    }
    if (handle) loadProfile();
  }, [handle]);


  return (
    <div className="wrap">
      {/* Top Header */}
      <Navbar />

      <main style={{ maxWidth: 920, margin: "0 auto", paddingBottom: 60, width: "100%" }}>


        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "var(--muted)", fontFamily: "monospace" }}>
            Loading creator profile...
          </div>
        ) : notFound || !creator ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <Search size={36} color="var(--muted)" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Creator not found</h1>
            <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
              The handle @{handle} does not exist or has not published any public polls yet.
            </p>
            <Link href="/explore" className="btn-primary">
              Explore Community Polls →
            </Link>
          </div>
        ) : (
          <div>
            {/* Creator Hero Card */}
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "28px",
              marginBottom: 32,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 20
            }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: "1 1 320px", minWidth: 0 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  color: "var(--accent-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  border: "2px solid var(--accent)",
                  fontFamily: "Space Grotesk, sans-serif",
                  flexShrink: 0
                }}>
                  {creator.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.25, wordBreak: "break-word" }}>
                      {creator.displayName}
                    </h1>
                    <span style={{ fontSize: 11, background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "2px 8px", borderRadius: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Verified Creator
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>
                    @{creator.username}
                  </div>
                  {creator.bio && (
                    <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, maxWidth: 500, lineHeight: 1.4, wordBreak: "break-word" }}>
                      {creator.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Badge */}
              <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center", background: "var(--paper)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{polls.length}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Polls</div>
                </div>
                <div style={{ textAlign: "center", background: "var(--paper)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{totalVotes}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Votes Cast</div>
                </div>
              </div>
            </div>

            {/* Polls List */}
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                {isOwner ? "Your Created Polls" : `Community Polls by @${creator.username}`}
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                {polls.length} {polls.length === 1 ? "poll" : "polls"}
              </span>
            </div>

            {polls.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}>
                <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: isOwner ? 16 : 0 }}>
                  {isOwner ? "You haven't created any polls yet." : "No public polls published yet."}
                </p>
                {isOwner && (
                  <Link href="/new" className="btn-primary" style={{ display: "inline-flex", fontSize: 13 }}>
                    + Create Your First Poll
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {polls.map((p) => {
                  const isLive = p.status === "live" && !p.isExpired && (!p.expiresAt || Date.now() <= p.expiresAt);

                  return (
                    <Link
                      href={`/p/${p.slug}`}
                      key={p.id}
                      className="poll-row"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 16,
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="badge-category">{p.category || "general"}</span>
                            {p.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
                            {p.pollType === "image" && <span className="badge-type">Image Poll</span>}
                            {isOwner && p.isPublic === 0 && (
                              <span style={{
                                fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "var(--paper)",
                                border: "1px solid var(--line)",
                                color: "var(--muted)",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}>
                                <Lock size={10} />
                                <span>Unlisted</span>
                              </span>
                            )}
                            <span style={{
                              fontSize: 10,
                              fontFamily: "'JetBrains Mono', monospace",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isLive ? "var(--accent-soft)" : "var(--line)",
                              color: isLive ? "var(--accent-ink)" : "var(--muted)",
                              fontWeight: 600,
                              letterSpacing: "0.03em"
                            }}>
                              {isLive ? "LIVE" : "CLOSED"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--faint)", marginBottom: 4 }}>
                            Poll ID: {p.slug.replace(/^(BPC|BPP)-/, "")}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 4, wordBreak: "break-word" }} title={p.question}>
                            {p.question}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {p.voteCount} {p.voteCount === 1 ? "vote" : "votes"}
                          </span>
                          <div style={{ fontSize: 11, color: isLive ? "var(--accent)" : "var(--muted)", marginTop: 4, fontWeight: 600 }}>
                            {isOwner
                              ? "Manage & Results →"
                              : !isLive
                              ? "Results Finalized →"
                              : p.hasVoted
                              ? "Voted · Results →"
                              : "Vote now →"}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}



          </div>
        )}

        <Footer />
      </main>
    </div>
  );
}


