"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
import { AnimatedSearchIcon } from "@/components/icons/AnimatedSearchIcon";


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
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [filter, setFilter] = useState<"trending" | "recent" | "active">("trending");

  async function loadPolls(targetPage = 1, append = false) {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("q", search);
      params.set("filter", filter);
      params.set("page", targetPage.toString());
      params.set("limit", "24");

      const res = await fetch(`/api/explore?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const newPolls = data.polls || [];
        setPolls((prev) => (append ? [...prev, ...newPolls] : newPolls));
        setTotalCount(data.total || newPolls.length);
        setHasMore(data.hasMore || false);
        setPage(targetPage);
      }
    } catch (err) {
      console.error("[loadPolls] Failed to load explore feed:", err);
    }
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadPolls(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, filter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadPolls(1, false);
  }

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      loadPolls(page + 1, true);
    }
  }

  return (
    <div className="wrap">
      <Navbar />

      <main>
        <div className="section-label">Public Polls</div>
        <h1 className="poll-title" style={{ fontSize: 24, marginBottom: 16 }}>Explore & Discover</h1>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ marginBottom: 18, position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--faint)" }}>
            <AnimatedSearchIcon size={18} />
          </div>
          <input
            type="text"
            placeholder="Search questions or topics… (press Enter)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px 11px 40px",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              fontSize: 14,
              color: "var(--ink)",
              outline: "none",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
            {totalCount} poll{totalCount === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="explore-cards-grid" aria-label="Loading explore feed">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="skeleton-card" style={{ gap: 12 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="skeleton-box" style={{ width: 64, height: 20, borderRadius: 10 }} />
                  <div className="skeleton-box" style={{ width: 80, height: 20, borderRadius: 10 }} />
                </div>
                <div className="skeleton-box" style={{ width: "90%", height: 22, marginTop: 4 }} />
                <div className="skeleton-box" style={{ width: "70%", height: 16 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <div className="skeleton-box" style={{ width: 50, height: 14 }} />
                  <div className="skeleton-box" style={{ width: 60, height: 14 }} />
                </div>
              </div>
            ))}
          </div>
        ) : polls.length === 0 ? (
          <div className="empty" style={{ padding: "48px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No matching polls found</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 400, margin: "0 auto 20px" }}>
              We couldn&apos;t find any polls matching &ldquo;{search || category}&rdquo;. Try another keyword or create the first one!
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setSearch(""); setCategory("all"); }}
                style={{ padding: "8px 16px", fontSize: 13 }}
              >
                Reset filters
              </button>
              <Link
                href="/new"
                className="btn-primary"
                style={{ padding: "8px 18px", fontSize: 13, textDecoration: "none" }}
              >
                + Create a Poll
              </Link>
            </div>
          </div>
        ) : (

          <>
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

            {/* Pagination / Load More Button */}
            {hasMore && (
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="btn-ghost"
                  style={{ padding: "10px 24px", fontSize: 13 }}
                >
                  {loadingMore ? "Loading more polls…" : "↓ Load More Polls"}
                </button>
              </div>
            )}
          </>
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
