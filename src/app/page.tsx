"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  const [activeTab, setActiveTab] = useState<"irv" | "image" | "realtime" | "security">("irv");

  // Ephemeral Sandbox State (100% client-side, zero network API calls)
  const [sandboxVote, setSandboxVote] = useState<number | null>(null);
  const [sandboxTallies, setSandboxTallies] = useState<number[]>([42, 38, 29, 54]);

  function handleSandboxVote(index: number) {
    if (sandboxVote !== null) return; // already voted in this session
    setSandboxVote(index);
    setSandboxTallies((prev) => {
      const copy = [...prev];
      copy[index] += 1;
      return copy;
    });
    try {
      fireMotionSafeConfetti();
    } catch {}
  }

  const sandboxTotal = sandboxTallies.reduce((a, b) => a + b, 0);
  const sandboxOptions = [
    { label: "⚡ Instant live updates (Adaptive SSE)", icon: "⚡" },
    { label: "🏆 Built-in Ranked Choice (IRV)", icon: "🏆" },
    { label: "🛡️ 3-Tier fraud & bot defense", icon: "🛡️" },
    { label: "📊 Ad-free design & visual charts", icon: "📊" },
  ];

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
        <Link href="/" className="brand">
          Ballot<span>.</span>
          <div className="brand-sub">quick polls</div>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>Explore</Link>
          <ThemeToggle />
          <Link href="/new" className="btn-primary">+ Create poll</Link>
        </div>
      </header>

      <main>
        {/* Responsive Desktop 2-Column Hero Section */}
        <section className="hero-section" aria-labelledby="hero-heading">
          <div className="hero-grid">
            {/* Left Column: Value Proposition & CTAs */}
            <div>
              <div className="hero-badge-row">
                <span className="hero-pill">⚡ 100% Ad-Free</span>
                <span className="hero-pill">🏆 Ranked Choice IRV</span>
                <span className="hero-pill">🛡️ 3-Tier Anti-Fraud</span>
                <span className="hero-pill">📊 Live Charts</span>
              </div>

              <h1 id="hero-heading" className="hero-title">
                Modern, Ad-Free Polling for Fast Decisions
              </h1>
              <p className="hero-desc">
                Create real-time polls with ranked-choice voting, 3-tier duplicate protection, and interactive SVG analytics in seconds. No account required.
              </p>

              <div className="hero-cta-group">
                <Link href="/new" className="btn-primary" style={{ padding: "12px 24px", fontSize: 15 }}>
                  + Create a Poll (Free) →
                </Link>
                <Link href="/explore" className="btn-ghost" style={{ padding: "12px 18px", fontSize: 14 }}>
                  🌐 Explore Public Feed
                </Link>
              </div>
            </div>

            {/* Right Column: Ephemeral Interactive Sandbox Demo */}
            <div>
              <div className="sandbox-card" role="region" aria-label="Interactive demo poll">
                <div className="sandbox-header">
                  <span className="sandbox-tag">Interactive Sandbox</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                    {sandboxVote !== null ? `${sandboxTotal} test votes` : "Try voting below:"}
                  </span>
                </div>

                <div className="sandbox-title">Which feature matters most to your team?</div>

                {sandboxVote === null ? (
                  <div role="radiogroup" aria-label="Demo poll options">
                    {sandboxOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={false}
                        className="sandbox-option-btn"
                        onClick={() => handleSandboxVote(i)}
                      >
                        <span>{opt.label}</span>
                        <span style={{ color: "var(--accent)", fontSize: 12 }}>Vote →</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div aria-live="polite" aria-label="Simulated demo results">
                    {sandboxOptions.map((opt, i) => {
                      const count = sandboxTallies[i];
                      const pct = Math.round((count / sandboxTotal) * 100);
                      const isMine = sandboxVote === i;

                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: isMine ? 700 : 500, color: isMine ? "var(--accent-ink)" : "var(--ink)" }}>
                              {opt.label} {isMine && "(your pick ✓)"}
                            </span>
                            <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>{pct}% · {count}</span>
                          </div>
                          <div className="ledger-track" style={{ height: 6 }}>
                            <div
                              className="ledger-fill"
                              style={{
                                width: `${pct}%`,
                                background: isMine ? "var(--accent)" : "var(--faint)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
                      ✨ Instant client-side preview — create your real poll above in 5 seconds!
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>


        {/* User's Created Polls Drawer (if any exist) */}
        {polls && polls.length > 0 && (
          <section style={{ marginBottom: 40, border: "1px solid var(--line)", borderRadius: 8, padding: 20, background: "var(--surface)" }}>
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

        {/* Core Pillars Grid */}
        <section aria-labelledby="pillars-heading">
          <div className="section-label">Why Choose Ballot</div>
          <h2 id="pillars-heading" style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
            Engineered for Integrity & Speed
          </h2>

          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">⚡</div>
              <div className="pillar-title">100% Ad-Free Experience</div>
              <div className="pillar-desc">
                No banner ads, popups, or surveillance scripts. Clean, distraction-free voting that respects your audience.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🛡️</div>
              <div className="pillar-title">3-Tier Fraud Prevention</div>
              <div className="pillar-desc">
                Choose from relaxed cookies, salted IP hashing, or strict bot challenges with dynamic anomaly velocity defense.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">🏆</div>
              <div className="pillar-title">Ranked Choice Voting (IRV)</div>
              <div className="pillar-desc">
                Run Instant Runoff Voting ballots with drag-and-drop preference ordering without paying for enterprise add-ons.
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">📊</div>
              <div className="pillar-title">Interactive SVG Analytics</div>
              <div className="pillar-desc">
                Switch seamlessly between horizontal ledgers, SVG Donut, and Pie charts with one-click CSV and JSON data exports.
              </div>
            </div>
          </div>
        </section>

        {/* Feature Showcase Tabs */}
        <section className="showcase-section" aria-labelledby="showcase-heading">
          <div className="section-label">Feature Deep-Dive</div>
          <h2 id="showcase-heading" style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Built for Modern Communities & Creators
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
            Explore how Ballot handles complex voting scenarios with zero friction:
          </p>

          <div className="showcase-desktop-layout">
            <div className="showcase-tabs" role="tablist" aria-label="Feature showcase tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "irv"}
                className={`showcase-tab ${activeTab === "irv" ? "active" : ""}`}
                onClick={() => setActiveTab("irv")}
              >
                🏆 Ranked Choice
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "image"}
                className={`showcase-tab ${activeTab === "image" ? "active" : ""}`}
                onClick={() => setActiveTab("image")}
              >
                🖼️ Image Polls
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "realtime"}
                className={`showcase-tab ${activeTab === "realtime" ? "active" : ""}`}
                onClick={() => setActiveTab("realtime")}
              >
                ⚡ Adaptive Realtime
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "security"}
                className={`showcase-tab ${activeTab === "security" ? "active" : ""}`}
                onClick={() => setActiveTab("security")}
              >
                🔒 Privacy & Salted IP
              </button>
            </div>

            <div className="showcase-preview-card" role="tabpanel">
              {activeTab === "irv" && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Instant Runoff Voting (IRV)</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                    Voters rank choices in order of preference (1st, 2nd, 3rd Choice). If no choice hits 50%, lowest-ranked options are eliminated and ballots reallocated until a consensus winner emerges.
                  </p>
                  <div style={{ background: "var(--paper)", padding: 14, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}>
                    ✓ Drag & drop priority ordering · ✓ Eliminates spoiler effect · ✓ Built into all free polls
                  </div>
                </div>
              )}

              {activeTab === "image" && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Visual Image Choices</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                    Perfect for design critiques, thumbnail selection, product feedback, and photo contests. Add high-res image URLs to any choice.
                  </p>
                  <div style={{ background: "var(--paper)", padding: 14, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}>
                    ✓ Responsive card grid · ✓ Mobile optimized · ✓ Automatic fallback icons
                  </div>
                </div>
              )}

              {activeTab === "realtime" && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Server-Sent Events (SSE) Engine</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                    Zero-polling live updates stream tallies to spectators instantly. When vote velocity spikes during viral events, a smart 1.5s circuit-breaker aggregates changes to protect client CPUs.
                  </p>
                  <div style={{ background: "var(--paper)", padding: 14, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}>
                    ✓ 🟢 Live spectator counter · ✓ 15s keepalive heartbeats · ✓ 90%+ bandwidth savings
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pseudo-Anonymized Salted IP Digests</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                    Ballot never stores raw IP addresses in plain text. Every poll generates a unique 16-byte cryptographic salt to hash voter IP digests solely for duplicate ballot deterrence.
                  </p>
                  <div style={{ background: "var(--paper)", padding: 14, borderRadius: 6, fontSize: 13, fontFamily: "monospace" }}>
                    ✓ Per-poll salt isolation · ✓ Relaxed mode for school/office Wi-Fi · ✓ Turnstile bot defense
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Trending Community Polls Snippet */}
        {trendingPolls.length > 0 && (
          <section style={{ margin: "48px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div className="section-label">Community</div>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>Trending Public Polls</h2>
              </div>
              <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>
                View all in Explore →
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
                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>{tp.voteCount} votes</span>
                    <span>Vote now →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}


        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-top">
            <div>
              <strong>Ballot</strong> — Fast, ad-free polling engine.
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
