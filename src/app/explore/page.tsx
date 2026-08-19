"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";


type PollSummary = {


  id: string;
  slug: string;
  question: string;
  description: string | null;
  pollType: string;
  category: string | null;
  allowMultiple: boolean;
  voteCount: number;
  isExpired: boolean;
  createdAt: number;
};

const CATEGORIES = [
  { id: "all", label: "🌐 All" },
  { id: "tech", label: "💻 Tech" },
  { id: "gaming", label: "🎮 Gaming" },
  { id: "entertainment", label: "🎬 Entertainment" },
  { id: "sports", label: "⚽ Sports" },
  { id: "food", label: "🍕 Food" },
  { id: "general", label: "💬 General" },
];

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [filter, setFilter] = useState<"trending" | "recent" | "active">("trending");

  async function loadPolls() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("q", search);
      params.set("filter", filter);

      const res = await fetch(`/api/explore?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, filter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadPolls();
  }

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" style={{ textDecoration: "none" }}>
          <BallotLogo size={32} />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ThemeToggle />
          <Link href="/new" className="btn-primary">+ Create poll</Link>
        </div>
      </header>



      <main>
        <div className="section-label">Public Polls</div>
        <h1 className="poll-title" style={{ fontSize: 24, marginBottom: 16 }}>Explore & Discover</h1>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder="Search questions or topics… (press Enter)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              fontSize: 14,
            }}
          />
        </form>

        {/* Categories Pills */}
        <div className="expiry-row" style={{ marginBottom: 16 }}>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`expiry-chip ${category === c.id ? "active" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="chart-toolbar" style={{ marginBottom: 20 }}>
          <div className="chart-type-toggle">
            <button
              type="button"
              className={`chart-btn ${filter === "trending" ? "active" : ""}`}
              onClick={() => setFilter("trending")}
            >
              🔥 Trending
            </button>
            <button
              type="button"
              className={`chart-btn ${filter === "recent" ? "active" : ""}`}
              onClick={() => setFilter("recent")}
            >
              ✨ Recent
            </button>
            <button
              type="button"
              className={`chart-btn ${filter === "active" ? "active" : ""}`}
              onClick={() => setFilter("active")}
            >
              ⚡ Active
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
            {polls.length} poll{polls.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading explore feed…</div>
        ) : polls.length === 0 ? (
          <div className="empty">
            No polls found matching your criteria.
            <br /><br />
            <button type="button" className="btn-ghost" onClick={() => { setSearch(""); setCategory("all"); }}>
              Reset filters
            </button>
          </div>
        ) : (
          <div className="explore-cards-grid" role="list" aria-label="Public polls list">
            {polls.map((p) => (
              <Link href={`/p/${p.slug}`} key={p.id} className="poll-row" role="listitem" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <span className="badge-category">{p.category || "general"}</span>
                    {p.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
                    {p.pollType === "image" && <span className="badge-type">Image Poll</span>}
                  </div>
                  <div className="poll-q" style={{ fontSize: 15 }}>{p.question}</div>
                  {p.description && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <div className="poll-meta" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{p.voteCount} {p.voteCount === 1 ? "vote" : "votes"}</span>
                  <span>{p.isExpired ? "closed" : "active · vote →"}</span>
                </div>
              </Link>
            ))}
          </div>

        )}
      </main>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="loading" style={{ padding: 40, textAlign: "center" }}>Loading explore…</div></div>}>
      <ExploreContent />
    </Suspense>
  );
}
