"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdSidebarContainer } from "@/components/AdSlot";
import { AnimatedSearchIcon } from "@/components/icons/AnimatedSearchIcon";
import {
  Globe,
  Terminal,
  Gamepad2,
  Clapperboard,
  Trophy,
  Utensils,
  MessageSquare,
  Flame,
  Sparkles,
  Zap,
  Search,
  X,
} from "lucide-react";


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
  { id: "all", label: "All", icon: Globe },
  { id: "tech", label: "Tech", icon: Terminal },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "entertainment", label: "Entertainment", icon: Clapperboard },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "food", label: "Food", icon: Utensils },
  { id: "general", label: "General", icon: MessageSquare },
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
  const [filter, setFilter] = useState<"recent" | "trending" | "active">("recent");

  async function loadPolls(
    targetPage = 1,
    append = false,
    currentSearch = search,
    currentCategory = category,
    currentFilter = filter
  ) {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams();
      if (currentCategory !== "all") params.set("category", currentCategory);
      if (currentSearch.trim()) params.set("q", currentSearch.trim());
      params.set("filter", currentFilter);
      params.set("page", String(targetPage));
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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadPolls(1, false, search, category, filter);
  }, [category, filter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadPolls(1, false, search, category, filter);
  }

  function handleClearSearch() {
    setSearch("");
    loadPolls(1, false, "", category, filter);
  }

  function handleLoadMore() {
    if (!loadingMore && hasMore) {
      loadPolls(page + 1, true, search, category, filter);
    }
  }

  const isRecentView = filter === "recent" && !search.trim();

  return (
    <div className="wrap">
      <Navbar />

      <AdSidebarContainer>
        <main>
          <div className="section-label">Public Polls</div>
          <h1 className="poll-title" style={{ fontSize: 24, marginBottom: 16 }}>Explore & Discover</h1>

          {/* Search Bar with Instant Clear */}
          <form onSubmit={handleSearchSubmit} style={{ marginBottom: 18, position: "relative" }}>
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--faint)" }}>
              <AnimatedSearchIcon size={18} />
            </div>
            <input
              type="text"
              placeholder="Search by question, creator @handle, topic, or poll ID… (press Enter)"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (val === "") {
                  loadPolls(1, false, "", category, filter);
                }
              }}
              style={{
                width: "100%",
                padding: "11px 40px 11px 40px",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
                fontSize: 14,
                color: "var(--ink)",
                outline: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                title="Clear search"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Categories Pills */}
          <div className="expiry-row" style={{ marginBottom: 16 }}>
            {CATEGORIES.map((c) => {
              const IconComp = c.icon;
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`expiry-chip ${category === c.id ? "active" : ""}`}
                  onClick={() => setCategory(c.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <IconComp size={13} color={category === c.id ? "var(--accent)" : "currentColor"} />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* Filter Tabs (Reordered: Recent, Trending, Active) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
            <div className="sort-tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
              <button
                type="button"
                className={`sort-tab ${filter === "recent" ? "active" : ""}`}
                onClick={() => setFilter("recent")}
              >
                <Sparkles size={13} color={filter === "recent" ? "var(--accent)" : "currentColor"} />
                <span>Recent</span>
              </button>
              <button
                type="button"
                className={`sort-tab ${filter === "trending" ? "active" : ""}`}
                onClick={() => setFilter("trending")}
              >
                <Flame size={13} color={filter === "trending" ? "var(--accent)" : "currentColor"} />
                <span>Trending</span>
              </button>
              <button
                type="button"
                className={`sort-tab ${filter === "active" ? "active" : ""}`}
                onClick={() => setFilter("active")}
              >
                <Zap size={13} color={filter === "active" ? "var(--accent)" : "currentColor"} />
                <span>Active</span>
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace", paddingBottom: 10 }}>
              {totalCount} poll{totalCount === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="explore-cards-grid" aria-label="Loading explore feed">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="skeleton-card" style={{ gap: 12 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div className="skeleton-box" style={{ width: 64, height: 20, borderRadius: 6 }} />
                    <div className="skeleton-box" style={{ width: 80, height: 20, borderRadius: 6 }} />
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
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Search size={36} color="var(--muted)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No matching polls found</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 400, margin: "0 auto 20px" }}>
                We couldn&apos;t find any polls matching &ldquo;{search || category}&rdquo;. Try another keyword or create the first one!
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleClearSearch}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Reset search & filters
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
                {/* 1st Position: "+ Create new poll" card in the Recent feed */}
                {isRecentView && (
                  <Link href="/new" className="explore-cta-card" aria-label="Create a new poll">
                    <div className="explore-cta-plus">+</div>
                    <div className="explore-cta-text">Create a new poll</div>
                    <div className="explore-cta-sub">Launch your question in seconds →</div>
                  </Link>
                )}

                {polls.map((p) => {
                  const typeLabel =
                    p.pollType === "ranked_choice"
                      ? "ranked choice"
                      : p.pollType === "image"
                      ? "image"
                      : p.pollType === "availability"
                      ? "availability"
                      : null;

                  return (
                    <Link href={`/p/${p.slug}`} key={p.id} className="explore-poll-card" role="listitem">
                      <div>
                        <div className="explore-card-badges">
                          <span className="badge-category">{p.category || "general"}</span>
                          {typeLabel && <span className="badge-type">{typeLabel}</span>}
                        </div>
                        <span className="explore-card-id">#{p.slug}</span>
                        <div className="explore-card-q">{p.question}</div>
                        {p.description && (
                          <div className="explore-card-desc" title={p.description}>
                            {p.description}
                          </div>
                        )}
                      </div>

                      <div className="explore-card-footer">
                        <span className="explore-card-votes">
                          {p.voteCount} {p.voteCount === 1 ? "vote" : "votes"}
                        </span>
                        <span className={`explore-card-action ${p.isExpired ? "closed" : ""}`}>
                          {p.isExpired ? "closed" : "vote →"}
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {/* Sparse State Fallback: for Trending / Active when under 4 polls */}
                {!isRecentView && polls.length > 0 && polls.length < 4 && (
                  <Link href="/new" className="explore-cta-card" aria-label="Create a new poll">
                    <div className="explore-cta-plus">+</div>
                    <div className="explore-cta-text">Create a new poll</div>
                    <div className="explore-cta-sub">Ask the community anything →</div>
                  </Link>
                )}
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

          <Footer />
        </main>
      </AdSidebarContainer>
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

