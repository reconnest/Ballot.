"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navbar, SessionUser } from "@/components/Navbar";
import { BallotLogo } from "@/components/BallotLogo";
import { fireMotionSafeConfetti } from "@/lib/confetti";
import { getCachedSessionUser } from "@/lib/session-cache";
import { AnimatedTrophyIcon } from "@/components/icons/AnimatedTrophyIcon";
import { AnimatedRefreshIcon } from "@/components/icons/AnimatedRefreshIcon";
import { Footer } from "@/components/Footer";
import {
  Zap,
  Trophy,
  Image as ImageIcon,
  ShieldCheck,
  BarChart3,
  Link2,
  QrCode,
  Laptop,
  CheckCircle2,
  Crown,
  Medal,
  Award,
  Globe,
  ClipboardList,
  Sparkles,
  Palmtree,
  Trees,
  Building2,
  Tent,
  RefreshCw,
} from "lucide-react";

type StoredPoll = { slug: string; question: string; createdAt: number; adminKey?: string };
type Summary = StoredPoll & { totalVotes: number; isExpired?: boolean };

type PublicPoll = {
  id: string;
  slug: string;
  question: string;
  category: string | null;
  pollType: string;
  voteCount: number;
};

export default function HomePage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => getCachedSessionUser());
  const [polls, setPolls] = useState<Summary[] | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("ballot_my_polls");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn("[ballot_my_polls] Storage parse warning:", e);
      }
    }
    return null;
  });
  const [showMyPolls, setShowMyPolls] = useState<boolean>(false);
  const [trendingPolls, setTrendingPolls] = useState<PublicPoll[]>([]);

  // Ephemeral Sandbox State (100% client-side, zero network API calls)
  const [sandboxFormat, setSandboxFormat] = useState<"standard" | "ranked" | "image">("standard");
  const [workflowStep, setWorkflowStep] = useState<"create" | "share" | "decide">("create");

  // Standard format state
  const [selectedStandard, setSelectedStandard] = useState<number | null>(null);
  const [standardVoteSubmitted, setStandardVoteSubmitted] = useState<boolean>(false);
  const [standardTallies, setStandardTallies] = useState<number[]>([48, 56, 32, 25]);
  const standardOptions = [
    { label: "Beachside Resort", icon: Palmtree },
    { label: "Mountain Cabin Retreat", icon: Trees },
    { label: "Downtown Loft & City Tour", icon: Building2 },
    { label: "National Park Glamping", icon: Tent },
  ];

  // Ranked format state
  const [rankedOrder, setRankedOrder] = useState<string[]>([
    "Instant Realtime SSE Sync",
    "Multi-Tier Fraud Defense",
    "Interactive SVG Charts",
    "Mobile Web Experience",
  ]);
  const [rankedSubmitted, setRankedSubmitted] = useState<boolean>(false);

  // Image format state
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [imageVoteSubmitted, setImageVoteSubmitted] = useState<boolean>(false);
  const [imageTallies, setImageTallies] = useState<number[]>([54, 42, 38]);
  const imageOptions = [
    {
      label: "Minimal Logo",
      subtitle: "Geometric Monogram",
      iconComponent: Sparkles,
      color: "#0f766e",
    },
    {
      label: "Dynamic Slit",
      subtitle: "High Energy Motion",
      iconComponent: Zap,
      color: "#2563eb",
    },
    {
      label: "Ballot Box",
      subtitle: "Clean & Modern",
      iconComponent: CheckCircle2,
      color: "#7c3aed",
    },
  ];



  function handleStandardSubmit() {
    if (selectedStandard === null || standardVoteSubmitted) return;
    setStandardVoteSubmitted(true);
    setStandardTallies((prev) => {
      const copy = [...prev];
      copy[selectedStandard] += 1;
      return copy;
    });
    try { fireMotionSafeConfetti(); } catch {}
  }

  function handleRankMove(index: number, direction: "up" | "down") {
    if (rankedSubmitted) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rankedOrder.length) return;
    setRankedOrder((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  }

  function handleRankedSubmit() {
    if (rankedSubmitted) return;
    setRankedSubmitted(true);
    try { fireMotionSafeConfetti(); } catch {}
  }

  function handleImageSubmit() {
    if (selectedImage === null || imageVoteSubmitted) return;
    setImageVoteSubmitted(true);
    setImageTallies((prev) => {
      const copy = [...prev];
      copy[selectedImage] += 1;
      return copy;
    });
    try { fireMotionSafeConfetti(); } catch {}
  }

  const standardTotal = standardTallies.reduce((a, b) => a + b, 0);
  const imageTotal = imageTallies.reduce((a, b) => a + b, 0);



  // Fetch top 3 trending public polls
  useEffect(() => {
    async function loadTrending() {
      try {
        const res = await fetch("/api/explore?filter=trending", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setTrendingPolls((data.polls || []).slice(0, 3));
        }
      } catch (err) {
        console.warn("[loadTrending] Failed to load trending polls:", err);
      }
    }
    loadTrending();
  }, []);

  // Only load user's created polls when creator is logged in
  useEffect(() => {
    async function loadCreatorPolls() {
      if (!sessionUser) {
        setPolls(null);
        setShowMyPolls(false);
        try { localStorage.removeItem("ballot_my_polls"); } catch (e) { console.warn(e); }
        return;
      }

      try {
        const res = await fetch(`/api/u/${sessionUser.username}?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.polls && Array.isArray(data.polls)) {
            const formatted: Summary[] = data.polls.map((p: { slug: string; question: string; createdAt: number; voteCount?: number; totalVotes?: number; isExpired?: boolean }) => ({
              slug: p.slug,
              question: p.question,
              createdAt: p.createdAt,
              totalVotes: p.voteCount ?? p.totalVotes ?? 0,
              isExpired: p.isExpired || false,
            }));
            setPolls(formatted);

            setShowMyPolls(formatted.length > 0);
            try { localStorage.setItem("ballot_my_polls", JSON.stringify(formatted)); } catch (e) { console.warn(e); }
          }
        }
      } catch (err) {
        console.warn("[loadCreatorPolls] Failed to load polls for user:", err);
      }
    }

    loadCreatorPolls();
  }, [sessionUser]);



  return (
    <div className="wrap">
      {/* Top Navigation */}
      <Navbar onUserChange={(u) => setSessionUser(u)} showLandingLinks={true} />


      <main>
        {/* 1. HERO SECTION */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="hero-grid">
            {/* Left Column: Value Proposition & CTAs */}
            <div>
              <div className="hero-badge-row">
                <span className="hero-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Trophy size={13} color="var(--accent)" /> Ranked Choice (Points)
                </span>
                <span className="hero-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={13} color="var(--accent)" /> Anti-Fraud Defense
                </span>
                <span className="hero-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <BarChart3 size={13} color="var(--accent)" /> Live Analytics
                </span>
              </div>


              <h1 id="hero-heading" className="hero-title">
                Create<span style={{ color: "var(--accent)" }}>.</span> Share<span style={{ color: "var(--accent)" }}>.</span> Decide<span style={{ color: "var(--accent)" }}>.</span>
              </h1>

              <p className="hero-desc">
                Create real-time polls with ranked voting, share one instant link with your audience, and decide together with live analytics.
              </p>

              <div className="hero-cta-group">
                <Link href="/new" className="btn-primary" style={{ padding: "12px 24px", fontSize: 15 }}>
                  Create a Poll →
                </Link>
                <Link href="/explore" className="btn-ghost" style={{ padding: "12px 18px", fontSize: 14 }}>
                  Explore Polls
                </Link>
              </div>

              <div className="trust-line">
                <span>No signup for voters</span>
                <span>•</span>
                <span>Real-time results</span>
              </div>
            </div>

            {/* Right Column: 2. INTERACTIVE 3-FORMAT SANDBOX DEMO */}
            <div>
              <div className="sandbox-card" role="region" aria-label="Interactive demo poll">
                {/* Format Switcher */}
                <div className="sandbox-format-tabs" role="tablist" aria-label="Demo poll formats">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sandboxFormat === "standard"}
                    className={`sandbox-format-tab ${sandboxFormat === "standard" ? "active" : ""}`}
                    onClick={() => setSandboxFormat("standard")}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Zap size={14} />
                    <span>Standard Poll</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sandboxFormat === "ranked"}
                    className={`sandbox-format-tab ${sandboxFormat === "ranked" ? "active" : ""}`}
                    onClick={() => setSandboxFormat("ranked")}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Trophy size={14} />
                    <span>Ranked Choice</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sandboxFormat === "image"}
                    className={`sandbox-format-tab ${sandboxFormat === "image" ? "active" : ""}`}
                    onClick={() => setSandboxFormat("image")}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <ImageIcon size={14} />
                    <span>Image Poll</span>
                  </button>
                </div>

                <div className="sandbox-header">
                  <span className="sandbox-tag">
                    {sandboxFormat === "standard" && "Standard Poll"}
                    {sandboxFormat === "ranked" && "Ranked Choice"}
                    {sandboxFormat === "image" && "Image Poll"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                    {sandboxFormat === "standard" && (standardVoteSubmitted ? `${standardTotal} votes recorded` : "Select an option:")}
                    {sandboxFormat === "ranked" && (rankedSubmitted ? "Leaderboard calculated ✓" : "Rank by preference:")}
                    {sandboxFormat === "image" && (imageVoteSubmitted ? `${imageTotal} votes recorded` : "Select a card:")}
                  </span>
                </div>

                {/* 1. Standard Format Interactive Body */}
                {sandboxFormat === "standard" && (
                  <div>
                    <div className="sandbox-title">Where should we host the team offsite?</div>

                    {!standardVoteSubmitted ? (
                      <div>
                        <div role="radiogroup" aria-label="Standard demo options" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                          {standardOptions.map((opt, i) => {
                            const isSelected = selectedStandard === i;
                            const IconComponent = opt.icon;
                            return (
                              <div
                                key={i}
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={0}
                                onClick={() => setSelectedStandard(i)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedStandard(i);
                                  }
                                }}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                                  background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  transition: "all 0.15s ease",
                                  boxShadow: isSelected ? "0 2px 8px rgba(15, 118, 110, 0.12)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <IconComponent size={15} color={isSelected ? "var(--accent)" : "var(--muted)"} />
                                  <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)" }}>
                                    {opt.label}
                                  </span>
                                </div>



                                <span style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  border: isSelected ? "5px solid var(--accent)" : "2px solid var(--line)",
                                  background: "var(--surface)",
                                  display: "inline-block",
                                  boxSizing: "border-box",
                                }} />
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={selectedStandard === null}
                          onClick={handleStandardSubmit}
                          className="btn-primary"
                          style={{ width: "100%", padding: "10px 14px", fontSize: 13, justifyContent: "center" }}
                        >
                          Submit Vote →
                        </button>
                      </div>
                    ) : (
                      <div aria-live="polite">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Live Results</span>
                          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{standardTotal} total votes</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(() => {
                            const maxStandard = Math.max(...standardTallies);
                            return standardOptions.map((opt, i) => {
                              const count = standardTallies[i];
                              const pct = Math.round((count / standardTotal) * 100);
                              const isLeader = maxStandard > 0 && count === maxStandard;
                              const isMine = selectedStandard === i;
                              return (
                                <div key={i}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontWeight: isLeader ? 700 : 500, color: isLeader ? "var(--accent-ink)" : "var(--ink)" }}>
                                        {opt.label}
                                      </span>
                                      {isLeader && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                          <AnimatedTrophyIcon size={12} /> Leader
                                        </span>
                                      )}
                                      {isMine && (
                                        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>
                                          (your pick ✓)
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{pct}% ({count})</span>
                                  </div>
                                  <div className="ledger-track" style={{ height: 7, borderRadius: 4 }}>
                                    <div className="ledger-fill" style={{ width: `${pct}%`, background: isLeader ? "var(--accent)" : "var(--faint)", borderRadius: 4 }} />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>


                        <div style={{ marginTop: 14, textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStandard(null);
                              setStandardVoteSubmitted(false);
                            }}
                            className="btn-ghost"
                            style={{ fontSize: 12, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <AnimatedRefreshIcon size={13} />
                            <span>Cast Another Vote</span>
                          </button>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* 2. Ranked Choice (Points) Format Interactive Body */}
                {sandboxFormat === "ranked" && (
                  <div>
                    <div className="sandbox-title">Rank your team's top priorities for Q3:</div>

                    {!rankedSubmitted ? (
                      <div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                          Use arrows to rank preferences from 1st to 4th Choice:
                        </div>
                        {rankedOrder.map((item, idx) => (
                          <div
                            key={item}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              marginBottom: 6,
                              borderRadius: "var(--radius)",
                              border: "1px solid var(--line)",
                              background: "var(--paper)",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)", fontSize: 11 }}>
                                #{idx + 1}
                              </span>
                              <span>{item}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleRankMove(idx, "up")}
                                style={{ padding: "2px 6px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 3, background: "var(--surface)", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}
                                aria-label="Move priority up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === rankedOrder.length - 1}
                                onClick={() => handleRankMove(idx, "down")}
                                style={{ padding: "2px 6px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 3, background: "var(--surface)", cursor: idx === rankedOrder.length - 1 ? "not-allowed" : "pointer", opacity: idx === rankedOrder.length - 1 ? 0.3 : 1 }}
                                aria-label="Move priority down"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleRankedSubmit}
                          style={{ width: "100%", marginTop: 8, padding: "9px 12px", fontSize: 13, justifyContent: "center" }}
                        >
                          Submit Ranked Ballot →
                        </button>
                      </div>
                    ) : (
                      <div aria-live="polite">
                        {(() => {
                          const baselineRanked = {
                            "Instant Realtime SSE Sync": { points: 34, firstChoices: 3 },
                            "Multi-Tier Fraud Defense": { points: 40, firstChoices: 5 },
                            "Interactive SVG Charts": { points: 26, firstChoices: 2 },
                            "Mobile Web Experience": { points: 16, firstChoices: 1 },
                          };

                          const rankedLeaderboard = Object.keys(baselineRanked).map((title) => {
                            const base = baselineRanked[title as keyof typeof baselineRanked];
                            const userRankIdx = rankedOrder.indexOf(title);
                            const addedPoints = userRankIdx === 0 ? 4 : userRankIdx === 1 ? 3 : userRankIdx === 2 ? 2 : 1;
                            const addedFirstChoice = userRankIdx === 0 ? 1 : 0;
                            const totalPoints = base.points + addedPoints;
                            const firstChoiceVotes = base.firstChoices + addedFirstChoice;
                            return {
                              title,
                              totalPoints,
                              firstChoiceVotes,
                            };
                          });

                          const totalPointsAll = rankedLeaderboard.reduce((sum, item) => sum + item.totalPoints, 0);
                          rankedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
                          const itemsWithPct = rankedLeaderboard.map((item, idx) => ({
                            ...item,
                            rank: idx + 1,
                            scorePct: Math.round((item.totalPoints / totalPointsAll) * 100),
                          }));

                          return (
                            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                <BarChart3 size={13} color="var(--accent)" />
                                <span>Points Leaderboard</span>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {itemsWithPct.map((item, idx) => {
                                  const isTop = idx === 0;
                                  const rankIcon = idx === 0 ? (
                                    <Crown size={13} color="var(--accent)" />
                                  ) : idx === 1 ? (
                                    <Medal size={13} color="#8B5CF6" />
                                  ) : idx === 2 ? (
                                    <Award size={13} color="#EC4899" />
                                  ) : (
                                    <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted)" }}>#{idx + 1}</span>
                                  );
                                  const trackColor = isTop ? "var(--accent)" : idx === 1 ? "#8B5CF6" : idx === 2 ? "#EC4899" : "#F59E0B";


                                  return (
                                    <div
                                      key={item.title}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 3,
                                        padding: "5px 8px",
                                        borderRadius: 6,
                                        background: isTop ? "var(--accent-soft)" : "var(--surface)",
                                        border: isTop ? "1px solid var(--accent)" : "1px solid var(--line)",
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", maxWidth: "62%" }}>
                                          <span style={{ display: "inline-flex", alignItems: "center" }}>{rankIcon}</span>
                                          <span style={{ fontWeight: isTop ? 700 : 600, color: isTop ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {item.title}
                                          </span>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                          <span style={{ fontSize: 10, color: "var(--muted)" }}>
                                            {item.firstChoiceVotes} 1st picks
                                          </span>
                                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: isTop ? "var(--accent-ink)" : "var(--ink)" }}>
                                            {item.totalPoints} pts <span style={{ color: "var(--muted)", fontWeight: 500 }}>({item.scorePct}%)</span>
                                          </span>
                                        </div>
                                      </div>

                                      {/* Point Score Progress Bar */}
                                      <div className="ledger-track" style={{ height: 4, borderRadius: 2 }}>
                                        <div
                                          className="ledger-fill"
                                          style={{
                                            width: `${item.scorePct}%`,
                                            background: trackColor,
                                            borderRadius: 2,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        <div style={{ textAlign: "center", marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setRankedOrder([
                                "Instant Realtime SSE Sync",
                                "Multi-Tier Fraud Defense",
                                "Interactive SVG Charts",
                                "Mobile Web Experience",
                              ]);
                              setRankedSubmitted(false);
                            }}
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}
                          >
                            <RefreshCw size={12} />
                            <span>Rank Again</span>
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}



                {/* 3. Image Poll Format Interactive Body */}
                {sandboxFormat === "image" && (
                  <div>
                    <div className="sandbox-title">Which design direction for the brand redesign?</div>

                    {!imageVoteSubmitted ? (
                      <div>
                        <div role="radiogroup" aria-label="Image demo options" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                          {imageOptions.map((opt, i) => {
                            const isSelected = selectedImage === i;
                            const IconComponent = opt.iconComponent;
                            return (
                              <div
                                key={i}
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={0}
                                onClick={() => setSelectedImage(i)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSelectedImage(i);
                                  }
                                }}
                                style={{
                                  borderRadius: 8,
                                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                                  background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                                  overflow: "hidden",
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  transition: "all 0.15s ease",
                                  boxShadow: isSelected ? "0 4px 12px rgba(15, 118, 110, 0.15)" : "none",
                                }}
                              >
                                <div style={{
                                  height: 70,
                                  background: "var(--surface)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderBottom: "1px solid var(--line)",
                                }}>
                                  <IconComponent size={24} color={opt.color} />
                                </div>
                                <div style={{ padding: "8px 6px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <div style={{ fontWeight: 700, fontSize: 11, color: isSelected ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                                    {opt.label}
                                  </div>
                                  <span style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    border: isSelected ? "4px solid var(--accent)" : "1.5px solid var(--line)",
                                    background: "var(--surface)",
                                    display: "inline-block",
                                    boxSizing: "border-box",
                                    marginTop: 4
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={selectedImage === null}
                          onClick={handleImageSubmit}
                          className="btn-primary"
                          style={{ width: "100%", padding: "10px 14px", fontSize: 13, justifyContent: "center" }}
                        >
                          Submit Vote →
                        </button>
                      </div>
                    ) : (
                      <div aria-live="polite">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Live Results</span>
                          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{imageTotal} total votes</span>
                        </div>

                        {/* 3-Column Cards Results View */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {(() => {
                            const maxImage = Math.max(...imageTallies);
                            return imageOptions.map((opt, i) => {
                              const count = imageTallies[i];
                              const pct = Math.round((count / imageTotal) * 100);
                              const isLeader = maxImage > 0 && count === maxImage;
                              const isMine = selectedImage === i;
                              const IconComponent = opt.iconComponent;
                              return (
                                <div
                                  key={i}
                                  style={{
                                    background: "var(--paper)",
                                    border: isLeader ? "2px solid var(--accent)" : "1px solid var(--line)",
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    boxShadow: isLeader ? "0 4px 12px rgba(15, 118, 110, 0.15)" : "none",
                                  }}
                                >
                                  <div style={{
                                    height: 65,
                                    background: "var(--surface)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderBottom: "1px solid var(--line)",
                                    position: "relative",
                                  }}>
                                    <IconComponent size={24} color={opt.color} />
                                    <div style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 4,
                                      background: isLeader ? "var(--accent)" : "rgba(0,0,0,0.75)",
                                      color: "#FFFFFF",
                                      padding: "1px 5px",
                                      borderRadius: 3,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      fontFamily: "monospace"
                                    }}>
                                      {pct}%
                                    </div>
                                  </div>

                                  <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                                      <div style={{ fontSize: 11, fontWeight: isLeader ? 700 : 600, color: isLeader ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {opt.label}
                                      </div>
                                      {isLeader && (
                                        <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 4px", borderRadius: 2, background: "var(--accent-soft)", flexShrink: 0 }}>
                                          <Trophy size={11} color="var(--accent)" />
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--muted)" }}>
                                      <span>{count} votes</span>
                                      {isMine && <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓ You</span>}
                                    </div>
                                    <div className="ledger-track" style={{ height: 4, borderRadius: 2, marginTop: 2 }}>
                                      <div className="ledger-fill" style={{ width: `${pct}%`, background: isLeader ? "var(--accent)" : "var(--faint)", borderRadius: 2 }} />
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>


                        <div style={{ marginTop: 14, textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImage(null);
                              setImageVoteSubmitted(false);
                            }}
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto" }}
                          >
                            <RefreshCw size={12} />
                            <span>Cast Another Vote</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>


        {/* User's Created Polls Drawer (Only when creator is logged in) */}
        {sessionUser && polls && polls.length > 0 && (
          <section style={{ marginBottom: 44, border: "1px solid var(--line)", borderRadius: 8, padding: 20, background: "var(--surface)" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ClipboardList size={18} color="var(--accent)" />
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Your Created Polls ({polls.length})</h2>
              </div>


              <button
                type="button"
                className="btn-link"
                onClick={() => setShowMyPolls(!showMyPolls)}
                style={{ fontSize: 12 }}
              >
                {showMyPolls ? "Hide" : "View"}
              </button>
            </div>

            {showMyPolls && (
              <div role="list" aria-label="Your created polls">
                {polls.map((p) => (
                  <Link href={`/p/${p.slug}`} key={p.slug} className="poll-row" role="listitem">
                    <div className="poll-row-top">
                      <div className="poll-q">{p.question}</div>
                      <div className="poll-meta">
                        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{p.totalVotes} {p.totalVotes === 1 ? "vote" : "votes"}</span>
                        <span>{p.isExpired ? "closed" : "active"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3. INTERACTIVE 3-STAGE WORKFLOW STEPPER */}
        <section id="how-it-works" aria-labelledby="workflow-heading" style={{ margin: "48px 0" }}>
          <div className="section-label">HOW IT WORKS</div>

          <h2 id="workflow-heading" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Three simple steps to a clear consensus
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            No complicated setup. From idea to decision in seconds:
          </p>

          <div className="stepper-layout">
            {/* Left Column: Progressive Sized Step Tabs */}
            <div className="stepper-tabs" role="tablist" aria-label="Workflow step tabs">
              <button
                type="button"
                role="tab"
                aria-selected={workflowStep === "create"}
                className={`stepper-tab-btn step-1 ${workflowStep === "create" ? "active" : ""}`}
                onClick={() => setWorkflowStep("create")}
              >
                <div className="stepper-circle">01</div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: workflowStep === "create" ? "var(--accent-ink)" : "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    STEP 01 · CREATE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: workflowStep === "create" ? "var(--ink)" : "var(--muted)", marginTop: 2 }}>
                    Create in Seconds
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={workflowStep === "share"}
                className={`stepper-tab-btn step-2 ${workflowStep === "share" ? "active" : ""}`}
                onClick={() => setWorkflowStep("share")}
              >
                <div className="stepper-circle">02</div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: workflowStep === "share" ? "var(--accent-ink)" : "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    STEP 02 · SHARE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: workflowStep === "share" ? "var(--ink)" : "var(--muted)", marginTop: 2 }}>
                    Share Everywhere
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={workflowStep === "decide"}
                className={`stepper-tab-btn step-3 ${workflowStep === "decide" ? "active" : ""}`}
                onClick={() => setWorkflowStep("decide")}
              >
                <div className="stepper-circle">03</div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: workflowStep === "decide" ? "var(--accent-ink)" : "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    STEP 03 · DECIDE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: workflowStep === "decide" ? "var(--ink)" : "var(--muted)", marginTop: 2 }}>
                    Decide with Confidence
                  </div>
                </div>
              </button>

              {/* Dynamic Step Spot Illustration (Transparent Floating) */}
              <div className="stepper-illustration-box" aria-hidden="true" key={workflowStep}>
                {workflowStep === "create" && (
                  <>
                    <img
                      src="/illustrations/step_1_light.png"
                      alt="Create poll on laptop"
                      className="illustration-light"
                      width={512}
                      height={512}
                    />
                    <img
                      src="/illustrations/step_1_dark.png"
                      alt="Create poll on laptop"
                      className="illustration-dark"
                      width={512}
                      height={512}
                    />
                  </>
                )}
                {workflowStep === "share" && (
                  <>
                    <img
                      src="/illustrations/step_2_light.png"
                      alt="Share poll link and QR code"
                      className="illustration-light"
                      width={512}
                      height={512}
                    />
                    <img
                      src="/illustrations/step_2_dark.png"
                      alt="Share poll link and QR code"
                      className="illustration-dark"
                      width={512}
                      height={512}
                    />
                  </>
                )}
                {workflowStep === "decide" && (
                  <>
                    <img
                      src="/illustrations/step_3_light.png"
                      alt="Live poll results and charts"
                      className="illustration-light"
                      width={512}
                      height={512}
                    />
                    <img
                      src="/illustrations/step_3_dark.png"
                      alt="Live poll results and charts"
                      className="illustration-dark"
                      width={512}
                      height={512}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Right Column: Detailed Benefit Rows */}

            <div className="stepper-panel" role="tabpanel" key={workflowStep}>
              {/* STEP 1: CREATE */}
              {workflowStep === "create" && (

                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span className="stepper-row-badge">STEP 01 — CREATE</span>
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create in Seconds</h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
                      Set up your question with single choice, multi-selection, ranked points, or visual image choices:
                    </p>

                    <div className="stepper-rows">
                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <Zap size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Standard Poll</span>
                              <span className="stepper-row-title">Single & Multi-Choice</span>
                            </div>
                            <div className="stepper-row-desc">
                              Simple voting when you need a quick answer. Support for pick-one or bounded multi-selection rules.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Quick decisions & check-ins</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <Trophy size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Ranked Choice (Points)</span>
                              <span className="stepper-row-title">Weighted Points Scoring</span>
                            </div>
                            <div className="stepper-row-desc">
                              Let voters rank their preferences. 1st choice earns maximum points to find the highest-scoring winner.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Elections & team rankings</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <ImageIcon size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Image Poll</span>
                              <span className="stepper-row-title">Visual Choices</span>
                            </div>
                            <div className="stepper-row-desc">
                              Let people vote visually with image-based choices. Add high-res thumbnails for designs, products, and contests.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Design critiques & picks</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="stepper-next-btn"
                    onClick={() => setWorkflowStep("share")}
                  >
                    Next: Share Everywhere →
                  </button>
                </div>
              )}

              {/* STEP 2: SHARE */}
              {workflowStep === "share" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span className="stepper-row-badge">STEP 02 — SHARE</span>
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reach Your Audience Everywhere</h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
                      Distribute your poll in seconds through direct links, downloadable QR codes, or embedded widgets:
                    </p>

                    <div className="stepper-rows">
                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <Link2 size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Direct Link</span>
                              <span className="stepper-row-title">One Clean URL</span>
                            </div>
                            <div className="stepper-row-desc">
                              Copy a shareable link and send it over email, Slack, Discord, or any messaging app instantly.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Team channels & messages</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <QrCode size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">QR Code</span>
                              <span className="stepper-row-title">Downloadable QR</span>
                            </div>
                            <div className="stepper-row-desc">
                              Generate a high-res QR code as PNG or SVG. Print it anywhere, project on live screens or presentation slides.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Events & physical spaces</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <Laptop size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Embed</span>
                              <span className="stepper-row-title">Live Website Embed</span>
                            </div>
                            <div className="stepper-row-desc">
                              Drop a single lightweight iframe snippet into any webpage or blog and your poll renders inline, live and interactive.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Blogs, landing pages & apps</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="stepper-next-btn"
                    onClick={() => setWorkflowStep("decide")}
                  >
                    Next: Decide with Confidence →
                  </button>
                </div>
              )}

              {/* STEP 3: DECIDE (VOTER DECISION & CREATOR/GROUP CONSENSUS) */}
              {workflowStep === "decide" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span className="stepper-row-badge">STEP 03 — DECIDE</span>
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Decide with Confidence</h3>

                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
                      How voters cast their true choices and how creators reach undeniable consensus:
                    </p>

                    <div className="stepper-rows">
                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <CheckCircle2 size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Voter Decision</span>
                              <span className="stepper-row-title">Cast with Absolute Clarity</span>
                            </div>
                            <div className="stepper-row-desc">
                              Voters easily express their authentic preferences through single votes, ranked point ballots, or visual cards—with zero signup friction.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Frictionless voter experience</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <Crown size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Group Consensus</span>
                              <span className="stepper-row-title">Ranked Points Winner</span>
                            </div>
                            <div className="stepper-row-desc">
                              Live real-time SSE streams and automated weighted ranking algorithms reveal the highest-scoring winner without endless debate.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Fast, trustworthy outcome</span>
                      </div>

                      <div className="stepper-row-card">
                        <div className="stepper-row-left">
                          <span className="stepper-row-icon">
                            <BarChart3 size={18} color="var(--accent)" />
                          </span>
                          <div>
                            <div>
                              <span className="stepper-row-badge">Actionable Data</span>
                              <span className="stepper-row-title">Live Analytics & Raw Export</span>
                            </div>
                            <div className="stepper-row-desc">
                              Inspect real-time SVG charts (Donut, Pie, Ledger) and download raw CSV/JSON records to document and share your final decision.
                            </div>
                          </div>
                        </div>
                        <span className="stepper-row-tag">→ Complete data transparency</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="stepper-next-btn"
                    onClick={() => setWorkflowStep("create")}
                  >
                    Start with Step 1: Create in Seconds ↺
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>


        {/* 4. DIFFERENTIATORS ("Built for trustworthy decisions") */}
        <section id="why-ballot" aria-labelledby="pillars-heading" style={{ margin: "48px 0" }}>
          <div className="section-label">WHY BALLOT</div>
          <h2 id="pillars-heading" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Built for trustworthy decisions
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            Multiple layers of vote protection and modern tooling help keep your results accurate and meaningful:
          </p>

          <div className="why-ballot-grid">
            {/* Top Row: 2 Features (Equal 50% / 50% screen share) */}
            <div className="why-ballot-row-top">
              <div className="pillar-card">
                <div>
                  <div className="pillar-icon">
                    <ShieldCheck size={26} color="var(--accent)" />
                  </div>
                  <div className="pillar-title">Smart Fraud Defense</div>
                  <div className="pillar-desc">
                    Multiple layers of duplicate protection—choose from relaxed cookies, salted IP digests, or Turnstile bot defense.
                  </div>
                </div>
                <div className="pillar-tag">→ Multi-Tier Security</div>
              </div>

              <div className="pillar-card">
                <div>
                  <div className="pillar-icon">
                    <Zap size={26} color="var(--accent)" />
                  </div>
                  <div className="pillar-title">Adaptive Realtime Stream</div>
                  <div className="pillar-desc">
                    Live spectator counter and zero-polling SSE tallies with automatic traffic-spike protection and sub-100ms sync.
                  </div>
                </div>
                <div className="pillar-tag">→ Instant Sync Engine</div>
              </div>
            </div>

            {/* Bottom Row: 3 Features (25% | 50% | 25% screen share) */}
            <div className="why-ballot-row-bottom">
              {/* 25% Feature */}
              <div className="pillar-card">
                <div>
                  <div className="pillar-icon">
                    <Trophy size={26} color="var(--accent)" />
                  </div>
                  <div className="pillar-title">Ranked Choice (Points)</div>
                  <div className="pillar-desc">
                    Built-in weighted point ballots (#1 gets max points) that find the highest-consensus choice without requiring enterprise add-ons.
                  </div>
                </div>
                <div className="pillar-tag">→ Highest Scoring Winner</div>
              </div>

              {/* 50% Center Hero Feature */}
              <div className="pillar-card">
                <div>
                  <div className="pillar-icon">
                    <BarChart3 size={26} color="var(--accent)" />
                  </div>
                  <div className="pillar-title">Interactive SVG Charts & Data Exports</div>
                  <div className="pillar-desc">
                    Inspect vote share with real-time Donut, Pie, and Ranked Points charts. Download raw CSV and JSON records instantly for transparent auditing or your own custom reporting pipeline.
                  </div>
                </div>
                <div className="pillar-tag">→ Complete Data Transparency & Analytics</div>
              </div>


              {/* 25% Feature */}
              <div className="pillar-card">
                <div>
                  <div className="pillar-icon">
                    <Globe size={26} color="var(--accent)" />
                  </div>
                  <div className="pillar-title">Zero-Friction Voting</div>
                  <div className="pillar-desc">
                    No account or app download required for voters. Share one clean URL or printable QR code for maximum turnout.
                  </div>
                </div>
                <div className="pillar-tag">→ Maximum Participation</div>
              </div>
            </div>
          </div>
        </section>






        {/* 6. NO ACCOUNT / NO FRICTION */}
        <section>
          <div className="frictionless-box">
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                No signup. Instant voting. Zero friction.
              </h2>
              <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 520, lineHeight: 1.5 }}>
                Create a poll, share the link, and let people vote without forcing them through an account-creation process.
              </p>
            </div>
            <Link href="/new" className="btn-primary" style={{ padding: "12px 22px", fontSize: 14, whiteSpace: "nowrap" }}>
              Create a Poll Now →
            </Link>
          </div>
        </section>


        {/* 8. EXPLORE PUBLIC POLLS */}
        {trendingPolls.length > 0 && (
          <section style={{ margin: "48px 0" }} aria-labelledby="trending-heading">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div className="section-label">COMMUNITY</div>
                <h2 id="trending-heading" style={{ fontSize: 22, fontWeight: 700 }}>Trending Public Polls</h2>
              </div>
              <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>
                Explore Public Feed →
              </Link>
            </div>

            <div className="explore-cards-grid" role="list" aria-label="Trending public polls">
              {trendingPolls.map((tp) => (
                <Link href={`/p/${tp.slug}`} key={tp.id} className="poll-row" role="listitem" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <span className="badge-category">{tp.category || "general"}</span>
                      {tp.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
                    </div>
                    <div className="poll-q" style={{ fontSize: 15 }}>{tp.question}</div>
                  </div>
                  <div className="poll-meta" style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>{tp.voteCount} {tp.voteCount === 1 ? "vote" : "votes"}</span>
                    <span>Vote now →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 9. FINAL CTA */}
        <section className="final-cta-section" aria-labelledby="final-cta-heading">
          <h2 id="final-cta-heading" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Ready to make a decision?
          </h2>
          <p style={{ fontSize: 15, color: "var(--muted)", marginBottom: 24, maxWidth: 460, margin: "0 auto 24px" }}>
            Create your first poll and share it in seconds. No account required.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/new" className="btn-primary" style={{ padding: "12px 24px", fontSize: 15 }}>
              Create a Poll →
            </Link>
            <Link href="/explore" className="btn-ghost" style={{ padding: "12px 18px", fontSize: 14 }}>
              Explore Polls
            </Link>
          </div>
        </section>

        {/* 10. FOOTER */}
        <Footer />
      </main>
    </div>
  );
}


