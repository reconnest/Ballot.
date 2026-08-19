"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StoredPoll = { slug: string; question: string; createdAt: number };
type Summary = StoredPoll & { totalVotes: number };

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
      try {
        stored = JSON.parse(localStorage.getItem("ballot:myPolls") ?? "[]");
      } catch {
        stored = [];
      }
      stored.sort((a, b) => b.createdAt - a.createdAt);

      const results = await Promise.all(
        stored.map(async (p) => {
          try {
            const res = await fetch(`/api/polls/${p.slug}`);
            if (!res.ok) return { ...p, totalVotes: 0 };
            const data = await res.json();
            return { ...p, totalVotes: data.totalVotes ?? 0 };
          } catch {
            return { ...p, totalVotes: 0 };
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
        <Link href="/new" className="btn-primary">New poll</Link>
      </header>
      <main>
        <div className="section-label">Your polls</div>
        {polls === null && <div className="loading">Loading…</div>}
        {polls !== null && polls.length === 0 && (
          <div className="empty">No polls yet. Create one and share the link to start collecting votes.</div>
        )}
        {polls?.map((p) => (
          <Link href={`/p/${p.slug}`} key={p.slug} className="poll-row">
            <div className="poll-row-top">
              <div className="poll-q">{p.question}</div>
              <div className="poll-meta">{p.totalVotes} vote{p.totalVotes === 1 ? "" : "s"}</div>
            </div>
            <div className="poll-meta">{timeAgo(p.createdAt)}</div>
          </Link>
        ))}
      </main>
    </div>
  );
}
