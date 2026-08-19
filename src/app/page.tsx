"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";
import { fireMotionSafeConfetti } from "@/lib/confetti";

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
  const [polls, setPolls] = useState<Summary[] | null>(null);
  const [showMyPolls, setShowMyPolls] = useState(false);
  const [trendingPolls, setTrendingPolls] = useState<PublicPoll[]>([]);

  // Ephemeral Sandbox State (100% client-side, zero network API calls)
  const [sandboxFormat, setSandboxFormat] = useState<"standard" | "ranked" | "image">("standard");
  const [workflowStep, setWorkflowStep] = useState<"create" | "share" | "decide">("create");

  
  // Standard format state
  const [standardVote, setStandardVote] = useState<number | null>(null);
  const [standardTallies, setStandardTallies] = useState<number[]>([48, 56, 32, 25]);
  const standardOptions = [
    { label: "🏖️ Beachside Resort" },
    { label: "🌲 Mountain Cabin Retreat" },
    { label: "🏙️ Downtown Loft & City Tour" },
    { label: "🏕️ National Park Glamping" },
  ];

  // Ranked format state
  const [rankedOrder, setRankedOrder] = useState<string[]>([
    "⚡ Instant Realtime SSE Sync",
    "🛡️ Multi-Tier Fraud Defense",
    "📊 Interactive SVG Charts",
    "📱 Mobile Web Experience",
  ]);
  const [rankedSubmitted, setRankedSubmitted] = useState<boolean>(false);

  // Image format state
  const [imageVote, setImageVote] = useState<number | null>(null);
  const [imageTallies, setImageTallies] = useState<number[]>([54, 42, 38]);
  const imageOptions = [
    { icon: "📋", label: "Tally Clipboard", desc: "Classic & Clean" },
    { icon: "🗳️", label: "Ballot Mark", desc: "Minimalist Box" },
    { icon: "⚡", label: "Dynamic Slit", desc: "High Energy" },
  ];

  function handleStandardVote(index: number) {
    if (standardVote !== null) return;
    setStandardVote(index);
    setStandardTallies((prev) => {
      const copy = [...prev];
      copy[index] += 1;
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
    setRankedSubmitted(true);
    try { fireMotionSafeConfetti(); } catch {}
  }

  function handleImageVote(index: number) {
    if (imageVote !== null) return;
    setImageVote(index);
    setImageTallies((prev) => {
      const copy = [...prev];
      copy[index] += 1;
      return copy;
    });
    try { fireMotionSafeConfetti(); } catch {}
  }

  const standardTotal = standardTallies.reduce((a, b) => a + b, 0);
  const imageTotal = imageTallies.reduce((a, b) => a + b, 0);


  // Load user's local polls
  useEffect(() => {
    async function load() {
      let stored: StoredPoll[] = [];
      let adminKeys: Record<string, string> = {};
      try {
        stored = JSON.parse(localStorage.getItem("ballot:myPolls") ?? "[]");
        adminKeys = JSON.parse(localStorage.getItem("ballot:adminKeys") ?? "{}");
      } catch {
        stored = [];
      }
      stored.sort((a, b) => b.createdAt - a.createdAt);

      if (stored.length > 0) {
        setShowMyPolls(true);
      }

      const results = await Promise.all(
        stored.map(async (p) => {
          const key = p.adminKey || adminKeys[p.slug];
          const query = key ? `?key=${encodeURIComponent(key)}` : "";
          try {
            const res = await fetch(`/api/polls/${p.slug}${query}`);
            if (!res.ok) return { ...p, totalVotes: 0, isExpired: false };
            const data = await res.json();
            return {
              ...p,
              totalVotes: data.totalVotes ?? data.totalSelections ?? 0,
              isExpired: data.isExpired,
            };
          } catch {
            return { ...p, totalVotes: 0, isExpired: false };
          }
        })
      );
      setPolls(results);
    }
    load();

    // Fetch top 3 trending public polls
    async function loadTrending() {
      try {
        const res = await fetch("/api/explore?filter=trending");
        if (res.ok) {
          const data = await res.json();
          setTrendingPolls((data.polls || []).slice(0, 3));
        }
      } catch {}
    }
    loadTrending();
  }, []);

  return (
    <div className="wrap">
      {/* Top Navigation */}
      <header className="top">
        <Link href="/" style={{ textDecoration: "none" }}>
          <BallotLogo size={32} />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>Explore</Link>
          <ThemeToggle />
          <Link href="/new" className="btn-primary">+ Create poll</Link>
        </div>
      </header>

      <main>
        {/* 1. HERO SECTION */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="hero-grid">
            {/* Left Column: Value Proposition & CTAs */}
            <div>
              <div className="hero-badge-row">
                <span className="hero-pill">🏆 Ranked Choice IRV</span>
                <span className="hero-pill">🛡️ Anti-Fraud Defense</span>
                <span className="hero-pill">📊 Live Analytics</span>
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
                  >
                    Standard Poll
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sandboxFormat === "ranked"}
                    className={`sandbox-format-tab ${sandboxFormat === "ranked" ? "active" : ""}`}
                    onClick={() => setSandboxFormat("ranked")}
                  >
                    Ranked Choice
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sandboxFormat === "image"}
                    className={`sandbox-format-tab ${sandboxFormat === "image" ? "active" : ""}`}
                    onClick={() => setSandboxFormat("image")}
                  >
                    Image Poll
                  </button>
                </div>

                <div className="sandbox-header">
                  <span className="sandbox-tag">
                    {sandboxFormat === "standard" && "Standard Demo"}
                    {sandboxFormat === "ranked" && "Ranked Choice (IRV)"}
                    {sandboxFormat === "image" && "Image Grid Demo"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                    {sandboxFormat === "standard" && (standardVote !== null ? `${standardTotal} test votes` : "Try voting:")}
                    {sandboxFormat === "ranked" && (rankedSubmitted ? "Consensus calculated ✓" : "Rank your top picks:")}
                    {sandboxFormat === "image" && (imageVote !== null ? `${imageTotal} test votes` : "Pick your favorite:")}
                  </span>
                </div>

                {/* 1. Standard Format Interactive Body */}
                {sandboxFormat === "standard" && (
                  <div>
                    <div className="sandbox-title">Where should we host the team offsite?</div>

                    {standardVote === null ? (
                      <div role="radiogroup" aria-label="Standard demo options">
                        {standardOptions.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            role="radio"
                            aria-checked={false}
                            className="sandbox-option-btn"
                            onClick={() => handleStandardVote(i)}
                          >
                            <span>{opt.label}</span>
                            <span style={{ color: "var(--accent)", fontSize: 12 }}>Vote →</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div aria-live="polite">
                        {standardOptions.map((opt, i) => {
                          const count = standardTallies[i];
                          const pct = Math.round((count / standardTotal) * 100);
                          const isMine = standardVote === i;
                          return (
                            <div key={i} style={{ marginBottom: 9 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ fontWeight: isMine ? 700 : 500, color: isMine ? "var(--accent-ink)" : "var(--ink)" }}>
                                  {opt.label} {isMine && "(your pick ✓)"}
                                </span>
                                <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{pct}% · {count}</span>
                              </div>
                              <div className="ledger-track" style={{ height: 6 }}>
                                <div className="ledger-fill" style={{ width: `${pct}%`, background: isMine ? "var(--accent)" : "var(--faint)" }} />
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>
                          ✨ Standard pick-one poll preview
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Ranked Choice (IRV) Format Interactive Body */}
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
                        <div style={{ background: "var(--accent-soft)", padding: 12, borderRadius: 6, marginBottom: 10, border: "1px solid var(--accent)" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent-ink)", marginBottom: 4 }}>
                            🏆 IRV Consensus Winner: {rankedOrder[0]}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            Instant Runoff eliminated lowest options across 3 rounds until reaching 64% majority.
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                          ✨ Zero spoiler effect · Real preferences calculated
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Image Poll Format Interactive Body */}
                {sandboxFormat === "image" && (
                  <div>
                    <div className="sandbox-title">Which logo mark concept works best for Ballot?</div>

                    {imageVote === null ? (
                      <div className="sandbox-image-grid" role="radiogroup" aria-label="Image poll demo options">
                        {imageOptions.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            role="radio"
                            aria-checked={false}
                            className="sandbox-image-card"
                            onClick={() => handleImageVote(i)}
                          >
                            <span style={{ fontSize: 28 }}>{opt.icon}</span>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>{opt.label}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{opt.desc}</div>
                            <span style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>Vote →</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div aria-live="polite">
                        {imageOptions.map((opt, i) => {
                          const count = imageTallies[i];
                          const pct = Math.round((count / imageTotal) * 100);
                          const isMine = imageVote === i;
                          return (
                            <div key={i} style={{ marginBottom: 9 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ fontWeight: isMine ? 700 : 500, color: isMine ? "var(--accent-ink)" : "var(--ink)" }}>
                                  {opt.icon} {opt.label} {isMine && "(your pick ✓)"}
                                </span>
                                <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{pct}% · {count}</span>
                              </div>
                              <div className="ledger-track" style={{ height: 6 }}>
                                <div className="ledger-fill" style={{ width: `${pct}%`, background: isMine ? "var(--accent)" : "var(--faint)" }} />
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>
                          ✨ Visual image card poll preview
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

        {/* User's Created Polls Drawer (if returning creator) */}
        {polls && polls.length > 0 && (
          <section style={{ marginBottom: 44, border: "1px solid var(--line)", borderRadius: 8, padding: 20, background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📋</span>
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
        <section aria-labelledby="workflow-heading" style={{ margin: "48px 0" }}>
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
            </div>

            {/* Right Column: Detailed Benefit Rows */}
            <div className="stepper-panel" role="tabpanel" key={workflowStep}>
              {/* STEP 1: CREATE */}
              {workflowStep === "create" && (
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span className="stepper-row-badge">STEP 01 — CREATE</span>
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create in Seconds</h3>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
                    Set up your question with single choice, multi-selection, ranked voting (IRV), or visual image choices:
                  </p>


                  <div className="stepper-rows">
                    <div className="stepper-row-card">
                      <div className="stepper-row-left">
                        <span className="stepper-row-icon">⚡</span>
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
                        <span className="stepper-row-icon">🏆</span>
                        <div>
                          <div>
                            <span className="stepper-row-badge">Ranked Choice (IRV)</span>
                            <span className="stepper-row-title">Instant Runoff Voting</span>
                          </div>
                          <div className="stepper-row-desc">
                            Let voters rank their preferences and find the strongest overall choice without vote splitting or spoilers.
                          </div>
                        </div>
                      </div>
                      <span className="stepper-row-tag">→ Elections & group consensus</span>
                    </div>

                    <div className="stepper-row-card">
                      <div className="stepper-row-left">
                        <span className="stepper-row-icon">🖼️</span>
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
                        <span className="stepper-row-icon">🔗</span>
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
                        <span className="stepper-row-icon">📱</span>
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
                        <span className="stepper-row-icon">💻</span>
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
                        <span className="stepper-row-icon">🗳️</span>
                        <div>
                          <div>
                            <span className="stepper-row-badge">Voter Decision</span>
                            <span className="stepper-row-title">Cast with Absolute Clarity</span>
                          </div>
                          <div className="stepper-row-desc">
                            Voters easily express their authentic preferences through single votes, ranked IRV ballots, or visual cards—with zero signup friction.
                          </div>
                        </div>
                      </div>
                      <span className="stepper-row-tag">→ Frictionless voter experience</span>
                    </div>

                    <div className="stepper-row-card">
                      <div className="stepper-row-left">
                        <span className="stepper-row-icon">👑</span>
                        <div>
                          <div>
                            <span className="stepper-row-badge">Group Consensus</span>
                            <span className="stepper-row-title">Automated Majority Winner</span>
                          </div>
                          <div className="stepper-row-desc">
                            Live real-time SSE streams and automated IRV elimination algorithms reveal the genuine majority consensus without endless debate.
                          </div>
                        </div>
                      </div>
                      <span className="stepper-row-tag">→ Fast, trustworthy outcome</span>
                    </div>

                    <div className="stepper-row-card">
                      <div className="stepper-row-left">
                        <span className="stepper-row-icon">📊</span>
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
        <section aria-labelledby="pillars-heading">


          <div className="section-label">WHY BALLOT</div>
          <h2 id="pillars-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Built for trustworthy decisions
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            Multiple layers of vote protection and modern tooling help keep your results accurate and meaningful:
          </p>

          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">🚫</div>
              <div className="pillar-title">100% Ad-Free Experience</div>
              <div className="pillar-desc">
                No banner ads, video popups, or tracking cookies. Clean, distraction-free voting that respects your audience.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🛡️</div>
              <div className="pillar-title">Smart Fraud Defense</div>
              <div className="pillar-desc">
                Multiple layers of duplicate protection—choose from relaxed cookies, salted IP digests, or Turnstile bot defense.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🏆</div>
              <div className="pillar-title">Ranked Choice (IRV)</div>
              <div className="pillar-desc">
                Built-in Instant Runoff Voting ballots that eliminate spoiler effects without requiring enterprise add-ons.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">⚡</div>
              <div className="pillar-title">Adaptive Realtime Stream</div>
              <div className="pillar-desc">
                Live spectator counter and zero-polling SSE tallies with automatic traffic-spike protection.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">📊</div>
              <div className="pillar-title">Interactive SVG Charts</div>
              <div className="pillar-desc">
                Toggle seamlessly between Donut, Pie, and Ledger charts with one-click CSV and JSON data exports.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🌐</div>
              <div className="pillar-title">No Account Required</div>
              <div className="pillar-desc">
                Zero-friction participation for your audience means significantly higher response rates and faster decisions.
              </div>
            </div>
          </div>
        </section>

        {/* 6. NO ACCOUNT / NO FRICTION */}
        <section>
          <div className="frictionless-box">
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                No signup. No ads. No friction.
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

        {/* 7. QR CODE & REAL-WORLD USE CASES */}
        <section className="sharing-section" aria-labelledby="sharing-heading">
          <div className="section-label">VERSATILE SHARING</div>
          <h2 id="sharing-heading" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            From screens to group chats
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, maxWidth: 640 }}>
            Share your poll with a direct link, downloadable QR code, or embed it directly into your website or presentation:
          </p>

          <div className="usecase-pills">
            <span className="usecase-pill">💼 Product & Engineering Teams</span>
            <span className="usecase-pill">🎓 Classrooms & Lectures</span>
            <span className="usecase-pill">🎤 Live Conferences & Events</span>
            <span className="usecase-pill">🌐 Online Communities & Discord</span>
            <span className="usecase-pill">💬 Friends & Social Groups</span>
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
        <footer className="landing-footer">
          <div className="footer-top">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BallotLogo size={22} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>— Fast, ad-free polling engine.</span>
            </div>
            <div className="footer-links">
              <Link href="/new" className="footer-link">New Poll</Link>
              <Link href="/explore" className="footer-link">Explore</Link>
              <a href="https://github.com/reconnest/Ballot.git" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
            </div>
          </div>
          <div style={{ lineHeight: 1.5, fontSize: 11, color: "var(--faint)" }}>
            🔒 <strong>Privacy Disclosure:</strong> Ballot uses private session cookies and one-way salted IP digests solely to deter duplicate votes. No personal browsing activity is tracked, profiled, or sold.
          </div>
        </footer>
      </main>
    </div>
  );
}

