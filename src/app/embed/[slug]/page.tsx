"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type OptionData = { id: string; label: string; votes: number | null };

type PollData = {
  question: string;
  description: string | null;
  isExpired: boolean;
  allowMultiple: boolean;
  minChoices: number;
  maxChoices: number | null;
  options: OptionData[];
  totalVotes: number | null;
  myVotes: string[];
  hasVoted: boolean;
  canViewResults: boolean;
};

export default function EmbedPollPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [poll, setPoll] = useState<PollData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  async function fetchPoll() {
    try {
      const res = await fetch(`/api/polls/${slug}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPoll(data);
      }
    } catch {}
  }

  useEffect(() => {
    fetchPoll();
    const timer = setInterval(fetchPoll, 4000);
    return () => clearInterval(timer);
  }, [slug]);

  function toggleOption(id: string) {
    if (!poll) return;
    if (poll.allowMultiple) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  }

  async function castVote(directId?: string) {
    const finalSelection = directId ? [directId] : selectedIds;
    if (finalSelection.length === 0) return;

    setVoting(true);
    setError("");
    try {
      const res = await fetch(`/api/polls/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: finalSelection }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not vote.");
        return;
      }
      setSelectedIds([]);
      await fetchPoll();
    } catch {
      setError("Network error.");
    } finally {
      setVoting(false);
    }
  }

  if (!poll) {
    return (
      <div style={{ padding: 20, fontFamily: "sans-serif", fontSize: 13, color: "#666" }}>
        Loading poll…
      </div>
    );
  }

  const showResults = poll.canViewResults;
  const isMulti = poll.allowMultiple;

  return (
    <div
      style={{
        padding: "16px 20px",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: "var(--paper, #FAFAF7)",
        color: "var(--ink, #14181A)",
        borderRadius: 8,
        border: "1px solid var(--line, #E4E1D9)",
        maxWidth: 540,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{poll.question}</h2>
        <div style={{ fontSize: 11, color: "var(--faint, #9CA3AF)", fontFamily: "monospace" }}>
          {poll.totalVotes !== null ? `${poll.totalVotes} vote${poll.totalVotes === 1 ? "" : "s"}` : "Voting open"}
          {poll.isExpired ? " · closed" : poll.hasVoted ? " · you voted" : isMulti ? ` · pick ${poll.minChoices}+` : " · pick one"}
        </div>
      </div>

      {!poll.hasVoted && !poll.isExpired ? (
        <div>
          {!isMulti ? (
            <div>
              {poll.options.map((o) => (
                <button
                  key={o.id}
                  disabled={voting}
                  onClick={() => castVote(o.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 12px",
                    marginBottom: 6,
                    background: "#FFFFFF",
                    border: "1px solid #E4E1D9",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 14,
                    textAlign: "left",
                  }}
                >
                  <span>{o.label}</span>
                  <span style={{ color: "#0F766E", fontWeight: 600 }}>vote →</span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {poll.options.map((o) => {
                const checked = selectedIds.includes(o.id);
                return (
                  <div
                    key={o.id}
                    onClick={() => toggleOption(o.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      marginBottom: 6,
                      background: checked ? "#E8F2F0" : "#FFFFFF",
                      border: `1px solid ${checked ? "#0F766E" : "#E4E1D9"}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ width: 16, height: 16, border: "1px solid #999", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: checked ? "#0F766E" : "#fff", color: "#fff" }}>
                      {checked ? "✓" : ""}
                    </span>
                    <span>{o.label}</span>
                  </div>
                );
              })}
              <button
                disabled={voting || selectedIds.length < poll.minChoices}
                onClick={() => castVote()}
                style={{
                  marginTop: 8,
                  padding: "8px 16px",
                  background: "#14181A",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Submit Vote ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
      ) : null}

      {showResults && (
        <div style={{ marginTop: 8 }}>
          {poll.options.map((o) => {
            const count = o.votes ?? 0;
            const total = poll.totalVotes && poll.totalVotes > 0 ? poll.totalVotes : 1;
            const pct = Math.round((count / total) * 100);
            const isMine = poll.myVotes.includes(o.id);

            return (
              <div key={o.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span style={{ fontWeight: isMine ? 700 : 500, color: isMine ? "#0B5C56" : "inherit" }}>
                    {o.label} {isMine && "(your pick)"}
                  </span>
                  <span style={{ fontFamily: "monospace", color: "#6B7280" }}>{pct}% · {count}</span>
                </div>
                <div style={{ height: 5, background: "#E4E1D9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#0F766E", borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div style={{ color: "#B45309", fontSize: 12, marginTop: 6 }}>{error}</div>}

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #E4E1D9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
        <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "#0F766E", textDecoration: "none", fontWeight: 600 }}>
          Open in Ballot ↗
        </a>
        <span style={{ color: "#9CA3AF" }}>Powered by Ballot</span>
      </div>
    </div>
  );
}
