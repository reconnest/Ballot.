"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type OptionData = { id: string; label: string; votes: number };
type PollData = {
  question: string;
  isExpired: boolean;
  options: OptionData[];
  totalVotes: number;
  myVote: string | null;
};

export default function PollPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [poll, setPoll] = useState<PollData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [voting, setVoting] = useState(false);
  const [toast, setToast] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchPoll() {
    try {
      const res = await fetch(`/api/polls/${slug}`, { cache: "no-store" });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setPoll(data);
    } catch {
      // leave previous state on transient network errors
    }
  }

  useEffect(() => {
    fetchPoll();
    pollTimer.current = setInterval(fetchPoll, 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  async function castVote(optionId: string) {
    setVoting(true);
    try {
      const res = await fetch(`/api/polls/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not vote.");
        setVoting(false);
        return;
      }
      await fetchPoll();
    } finally {
      setVoting(false);
    }
  }

  function copyLink() {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => showToast("Link copied"),
      () => showToast(url)
    );
  }

  if (notFound) {
    return (
      <div className="wrap">
        <header className="top">
          <Link href="/" className="brand">Ballot<span>.</span></Link>
        </header>
        <div className="empty">
          Poll not found.
          <br />
          <br />
          <Link href="/" className="btn-ghost">← Back to polls</Link>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="wrap">
        <header className="top">
          <Link href="/" className="brand">Ballot<span>.</span></Link>
        </header>
        <div className="loading">Loading…</div>
      </div>
    );
  }

  const showResults = !!poll.myVote || poll.isExpired;

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
        <div className="poll-header">
          <div className="poll-title">{poll.question}</div>
        </div>
        <div className="poll-sub">
          {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
          {poll.isExpired ? " · closed" : showResults ? " · you voted" : " · pick one"}
        </div>

        {!showResults &&
          poll.options.map((o) => (
            <button
              key={o.id}
              className="choice"
              disabled={voting}
              onClick={() => castVote(o.id)}
            >
              <div className="choice-inner">
                <span>{o.label}</span>
                <span className="choice-arrow">vote →</span>
              </div>
            </button>
          ))}

        {showResults &&
          poll.options.map((o) => {
            const pct = poll.totalVotes > 0 ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
            const mine = o.id === poll.myVote;
            return (
              <div className="ledger-row" key={o.id}>
                <div className="ledger-top">
                  <div className={`ledger-label ${mine ? "mine" : ""}`}>
                    {o.label}
                    {mine ? " · your pick" : ""}
                  </div>
                  <div className="ledger-nums">{pct}% · {o.votes}</div>
                </div>
                <div className="ledger-track">
                  <div className="ledger-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}

        <div className="poll-actions">
          <button className="copy-link" onClick={copyLink}>Copy share link</button>
          <Link href="/" className="btn-ghost">← All polls</Link>
        </div>
      </main>
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
