"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { getQRCodeUrl } from "@/lib/qr-generator";
import { calculateSlices, CHART_COLORS, exportToCSV, exportToJSON } from "@/lib/chart-utils";

type OptionData = { id: string; label: string; votes: number | null };
type VoterEntry = { name: string; choices: string[] };

type PollData = {
  question: string;
  description: string | null;
  createdAt: number;
  expiresAt: number | null;
  isExpired: boolean;
  requireName: boolean;
  allowMultiple: boolean;
  minChoices: number;
  maxChoices: number | null;
  resultsVisibility: "always_public" | "after_vote" | "after_deadline" | "creator_only";
  options: OptionData[];
  totalVotes: number | null;
  totalSelections: number | null;
  myVote: string | null;
  myVotes: string[];
  hasVoted: boolean;
  canViewResults: boolean;
  isAdmin: boolean;
  voters: VoterEntry[];
};

function PollContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [poll, setPoll] = useState<PollData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voterName, setVoterName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [botVerified, setBotVerified] = useState(false);
  const [chartType, setChartType] = useState<"ledger" | "donut" | "pie">("ledger");

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read admin key from query or localStorage
  useEffect(() => {
    const keyFromUrl = searchParams.get("key");
    if (keyFromUrl) {
      setAdminKey(keyFromUrl);
      try {
        const adminKeys = JSON.parse(localStorage.getItem("ballot:adminKeys") ?? "{}");
        adminKeys[slug] = keyFromUrl;
        localStorage.setItem("ballot:adminKeys", JSON.stringify(adminKeys));
      } catch {}
    } else {
      try {
        const adminKeys = JSON.parse(localStorage.getItem("ballot:adminKeys") ?? "{}");
        if (adminKeys[slug]) {
          setAdminKey(adminKeys[slug]);
        }
      } catch {}
    }
  }, [slug, searchParams]);

  async function fetchPoll(customKey?: string | null) {
    const activeKey = customKey !== undefined ? customKey : adminKey;
    const url = activeKey ? `/api/polls/${slug}?key=${encodeURIComponent(activeKey)}` : `/api/polls/${slug}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: PollData = await res.json();
      setPoll(data);
    } catch {
      // transient network error
    }
  }

  useEffect(() => {
    fetchPoll();
    pollTimer.current = setInterval(() => fetchPoll(), 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, adminKey]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function toggleOption(id: string) {
    if (!poll) return;
    if (poll.allowMultiple) {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((item) => item !== id);
        } else {
          if (poll.maxChoices && prev.length >= poll.maxChoices) {
            showToast(`Maximum ${poll.maxChoices} choices allowed`);
            return prev;
          }
          return [...prev, id];
        }
      });
    } else {
      setSelectedIds([id]);
    }
  }

  async function castVote(directId?: string) {
    const finalSelection = directId ? [directId] : selectedIds;
    if (finalSelection.length === 0) {
      showToast("Please choose an option first.");
      return;
    }
    if (poll?.allowMultiple && finalSelection.length < poll.minChoices) {
      showToast(`Please choose at least ${poll.minChoices} option${poll.minChoices === 1 ? "" : "s"}.`);
      return;
    }
    if (poll?.requireName && !voterName.trim()) {
      showToast("Please enter your name.");
      return;
    }

    setVoting(true);
    try {
      const res = await fetch(`/api/polls/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: finalSelection,
          voterName: voterName.trim() || undefined,
          turnstileToken: botVerified ? "cf_token_passed" : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresTurnstile) {
          showToast("Security verification required. Please verify below.");
          setBotVerified(true);
          return;
        }
        showToast(data.error ?? "Could not record vote.");
        return;
      }
      setSelectedIds([]);
      await fetchPoll();
      showToast("Vote submitted!");
    } catch (e) {
      console.error("vote request failed", e);
      showToast("Could not submit vote — check your connection.");
    } finally {
      setVoting(false);
    }
  }

  async function handleClosePoll() {
    if (!adminKey) return;
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, action: "close_now" }),
      });
      if (res.ok) {
        showToast("Poll closed.");
        fetchPoll();
        setShowAdminModal(false);
      } else {
        showToast("Could not close poll.");
      }
    } catch {
      showToast("Error updating poll.");
    }
  }

  function copyLink() {
    const url = typeof window !== "undefined" ? window.location.origin + `/p/${slug}` : "";
    navigator.clipboard?.writeText(url).then(
      () => showToast("Share link copied!"),
      () => showToast(url)
    );
  }

  function copyAdminLink() {
    if (!adminKey) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}?key=${adminKey}` : "";
    navigator.clipboard?.writeText(url).then(
      () => showToast("Admin link copied to clipboard!"),
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
          <br /><br />
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
        <div className="loading" role="status" aria-live="polite">Loading poll…</div>
      </div>
    );
  }

  const showResults = poll.canViewResults;
  const isMulti = poll.allowMultiple;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : "";
  const embedCode = typeof window !== "undefined"
    ? `<iframe src="${window.location.origin}/embed/${slug}" width="100%" height="450" frameborder="0" style="border-radius: 8px; border: 1px solid #E4E1D9;"></iframe>`
    : "";

  const chartData = poll.options.map((o) => ({
    id: o.id,
    label: o.label,
    votes: o.votes ?? 0,
  }));

  const totalChartVotes = poll.totalVotes && poll.totalVotes > 0
    ? poll.totalVotes
    : chartData.reduce((acc, curr) => acc + curr.votes, 0);

  const slices = calculateSlices(
    chartData,
    totalChartVotes,
    chartType === "donut" ? 95 : 95,
    chartType === "donut" ? 55 : 0
  );

  return (
    <div className="wrap">
      <header className="top">
        <Link href="/" className="brand">
          Ballot<span>.</span>
          <div className="brand-sub">quick polls</div>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {poll.isAdmin && (
            <button
              type="button"
              className="badge-creator"
              onClick={() => setShowAdminModal(true)}
              aria-label="Creator admin settings"
            >
              ⚙ Creator Admin
            </button>
          )}
          <Link href="/new" className="btn-primary">New poll</Link>
        </div>
      </header>

      <main>
        <div className="poll-header">
          <h1 className="poll-title">{poll.question}</h1>
          {poll.description && (
            <div className="poll-desc">{poll.description}</div>
          )}
        </div>

        <div className="poll-sub" aria-live="polite">
          {poll.totalVotes !== null ? `${poll.totalVotes} vote${poll.totalVotes === 1 ? "" : "s"}` : "Voting open"}
          {poll.isExpired ? " · closed" : poll.hasVoted ? " · you voted" : isMulti ? ` · pick ${poll.minChoices}${poll.maxChoices ? `–${poll.maxChoices}` : "+"}` : " · pick one"}
        </div>

        {/* Voting Form if voter hasn't voted and poll is active */}
        {!poll.hasVoted && !poll.isExpired && (
          <div className="vote-section" role="form" aria-label="Voting choices">
            {poll.requireName && (
              <div className="name-input-wrap">
                <label className="field-label" htmlFor="voterName">
                  Your name <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input
                  id="voterName"
                  type="text"
                  maxLength={60}
                  placeholder="e.g. Alex"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                />
              </div>
            )}

            {/* Single Click Choice for Single Choice polls */}
            {!isMulti ? (
              <div role="radiogroup" aria-label="Single choice voting options">
                {poll.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedIds.includes(o.id)}
                    className={`choice ${selectedIds.includes(o.id) ? "selected" : ""}`}
                    disabled={voting}
                    onClick={() => castVote(o.id)}
                  >
                    <div className="choice-inner">
                      <span>{o.label}</span>
                      <span className="choice-arrow">{voting ? "Voting…" : "vote →"}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Multi-choice Checkboxes */
              <div role="group" aria-label="Multiple choice voting options">
                {poll.options.map((o) => {
                  const isChecked = selectedIds.includes(o.id);
                  return (
                    <div
                      key={o.id}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      className={`choice-multi ${isChecked ? "checked" : ""}`}
                      onClick={() => toggleOption(o.id)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleOption(o.id);
                        }
                      }}
                    >
                      <div className="checkbox-indicator" aria-hidden="true">
                        {isChecked ? "✓" : ""}
                      </div>
                      <span className="choice-label">{o.label}</span>
                    </div>
                  );
                })}

                <div className="multi-submit-bar">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={voting || selectedIds.length < poll.minChoices}
                    onClick={() => castVote()}
                  >
                    {voting ? "Submitting…" : `Submit Vote (${selectedIds.length} selected)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Masking Notice */}
        {!showResults && (poll.hasVoted || poll.isExpired) && (
          <div className="results-notice" role="status">
            {poll.resultsVisibility === "after_deadline" && !poll.isExpired && (
              <div>⏳ Results will be revealed when this poll closes.</div>
            )}
            {poll.resultsVisibility === "creator_only" && (
              <div>🔒 Results for this poll are private to the creator.</div>
            )}
          </div>
        )}

        {/* Visual Analytics / Results Section */}
        {showResults && (
          <div className="results-container">
            {/* View Selector & Export Toolbar */}
            <div className="chart-toolbar">
              <div className="chart-type-toggle">
                <button
                  type="button"
                  className={`chart-btn ${chartType === "ledger" ? "active" : ""}`}
                  onClick={() => setChartType("ledger")}
                >
                  Bars
                </button>
                <button
                  type="button"
                  className={`chart-btn ${chartType === "donut" ? "active" : ""}`}
                  onClick={() => setChartType("donut")}
                >
                  Donut
                </button>
                <button
                  type="button"
                  className={`chart-btn ${chartType === "pie" ? "active" : ""}`}
                  onClick={() => setChartType("pie")}
                >
                  Pie
                </button>
              </div>

              <div className="export-actions">
                <button
                  type="button"
                  className="btn-ghost-small"
                  onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes ?? 0 })), totalChartVotes)}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="btn-ghost-small"
                  onClick={() => exportToJSON(poll)}
                >
                  JSON
                </button>
              </div>
            </div>

            {/* View 1: Horizontal Ledger */}
            {chartType === "ledger" && (
              <div className="ledger-section" aria-label="Poll results breakdown">
                {poll.options.map((o, idx) => {
                  const count = o.votes ?? 0;
                  const total = totalChartVotes > 0 ? totalChartVotes : 1;
                  const pct = Math.round((count / total) * 100);
                  const isMine = poll.myVotes.includes(o.id);
                  const color = CHART_COLORS[idx % CHART_COLORS.length];

                  return (
                    <div className="ledger-row" key={o.id}>
                      <div className="ledger-top">
                        <div className={`ledger-label ${isMine ? "mine" : ""}`}>
                          <span className="color-dot" style={{ background: color }} />
                          {o.label}
                          {isMine && <span className="mine-badge"> · your pick</span>}
                        </div>
                        <div className="ledger-nums">{pct}% · {count}</div>
                      </div>
                      <div className="ledger-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${o.label}: ${pct}%`}>
                        <div className="ledger-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View 2 & 3: Donut & Pie Chart */}
            {(chartType === "donut" || chartType === "pie") && (
              <div className="svg-chart-wrap">
                <div className="svg-chart-container">
                  <svg viewBox="0 0 240 240" width="220" height="220" className="chart-svg">
                    {slices.map((slice) =>
                      slice.path ? (
                        <path
                          key={slice.id}
                          d={slice.path}
                          fill={slice.color}
                          stroke="#FAFAF7"
                          strokeWidth="2"
                          className="slice-path"
                        >
                          <title>{`${slice.label}: ${slice.pct}% (${slice.votes} votes)`}</title>
                        </path>
                      ) : null
                    )}
                    {chartType === "donut" && (
                      <text x="120" y="125" textAnchor="middle" className="donut-center-text">
                        {totalChartVotes} {totalChartVotes === 1 ? "vote" : "votes"}
                      </text>
                    )}
                  </svg>
                </div>

                <div className="chart-legend">
                  {slices.map((slice) => (
                    <div className="legend-item" key={slice.id}>
                      <span className="legend-color" style={{ background: slice.color }} />
                      <span className="legend-name">{slice.label}</span>
                      <span className="legend-val">{slice.pct}% ({slice.votes})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voter Ledger if Name Required */}
        {showResults && poll.requireName && poll.voters.length > 0 && (
          <div className="voter-section">
            <div className="section-label">Who voted ({poll.voters.length})</div>
            {poll.voters.map((v, i) => (
              <div className="voter-row" key={i}>
                <div className="voter-name">{v.name}</div>
                <div className="voter-choice">{v.choices.join(", ")}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions Bar */}
        <div className="poll-actions">
          <button type="button" className="copy-link" onClick={copyLink}>
            Copy share link
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowEmbedModal(true)}>
            ⟨/⟩ Embed
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowQR(true)}>
            📱 QR Code
          </button>
          <Link href="/" className="btn-ghost">← All polls</Link>
        </div>
      </main>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="modal-backdrop" onClick={() => setShowEmbedModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Embed Poll Widget">
            <div className="modal-head">
              <h3>Embed on your Website</h3>
              <button className="close-btn" onClick={() => setShowEmbedModal(false)} aria-label="Close modal">&times;</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Copy and paste this HTML code into your blog post, news article, or forum:
            </div>
            <textarea
              readOnly
              className="input-textarea"
              rows={3}
              value={embedCode}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(embedCode);
                  showToast("Embed code copied!");
                  setShowEmbedModal(false);
                }}
              >
                Copy Embed Code
              </button>
              <button className="btn-ghost" onClick={() => setShowEmbedModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="modal-backdrop" onClick={() => setShowQR(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Poll QR Code">
            <div className="modal-head">
              <h3>Scan to Vote</h3>
              <button className="close-btn" onClick={() => setShowQR(false)} aria-label="Close modal">&times;</button>
            </div>
            <div className="qr-box">
              <img
                src={getQRCodeUrl(pageUrl, 240)}
                alt="Poll QR Code"
                width={240}
                height={240}
                style={{ borderRadius: 8, background: "#fff", padding: 8 }}
              />
            </div>
            <div className="modal-sub">Scan with phone camera to open this poll instantly.</div>
            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button className="btn-primary" onClick={copyLink}>Copy Link</button>
              <button className="btn-ghost" onClick={() => setShowQR(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Admin Modal */}
      {showAdminModal && poll.isAdmin && (
        <div className="modal-backdrop" onClick={() => setShowAdminModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Creator Admin Panel">
            <div className="modal-head">
              <h3>Creator Admin Panel</h3>
              <button className="close-btn" onClick={() => setShowAdminModal(false)} aria-label="Close modal">&times;</button>
            </div>
            <div className="admin-info-box">
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>Creator Key:</strong> Keep this link private to manage your poll.
              </div>
              <button type="button" className="btn-ghost" onClick={copyAdminLink} style={{ width: "100%", fontSize: 12 }}>
                📋 Copy Private Admin Link
              </button>
            </div>

            {!poll.isExpired && (
              <div style={{ marginTop: 16 }}>
                <button type="button" className="btn-danger" onClick={handleClosePoll} style={{ width: "100%" }}>
                  🔒 Close Poll Immediately
                </button>
              </div>
            )}
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button className="btn-ghost" onClick={() => setShowAdminModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="assertive">{toast}</div>
    </div>
  );
}

export default function PollPage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="loading" style={{ padding: 40, textAlign: "center" }}>Loading poll…</div></div>}>
      <PollContent />
    </Suspense>
  );
}



