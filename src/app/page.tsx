"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";

type StoredPoll = { slug: string; question: string; createdAt: number; adminKey?: string };

type Summary = StoredPoll & { totalVotes: number; isExpired?: boolean };

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export default function HomePage() {
  const [polls, setPolls] = useState<Summary[] | null>(null);

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
  }, []);

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">
          Ballot<span>.</span>
          <div className="brand-sub">quick polls</div>
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>Explore</Link>
          <ThemeToggle />
          <Link href="/new" className="btn-primary">New poll</Link>
        </div>

      </header>

      <main>
        <div className="section-label">Your polls</div>
        {polls === null && <div className="loading" role="status">Loading…</div>}
        {polls !== null && polls.length === 0 && (
          <div className="empty">
            <p>No polls yet.</p>
            <p style={{ marginTop: 6, color: "var(--faint)", fontSize: 13 }}>
              Create a poll in seconds and share the link to collect instant responses.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/new" className="btn-primary">Create your first poll →</Link>
            </div>
          </div>
        )}
        {polls?.map((p) => (
          <Link href={`/p/${p.slug}`} key={p.slug} className="poll-row">
            <div className="poll-row-top">
              <div className="poll-q">{p.question}</div>
              <div className="poll-meta">
                {p.isExpired ? (
                  <span style={{ color: "var(--muted)" }}>Closed · </span>
                ) : null}
                {p.totalVotes} vote{p.totalVotes === 1 ? "" : "s"}
              </div>
            </div>
            <div className="poll-meta">{timeAgo(p.createdAt)}</div>
          </Link>
        ))}
      </main>
    </div>
  );
}

