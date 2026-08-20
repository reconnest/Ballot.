"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getQRCodeUrl } from "@/lib/qr-generator";
import { calculateSlices, CHART_COLORS, exportToCSV, exportToJSON } from "@/lib/chart-utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";
import { fireMotionSafeConfetti } from "@/lib/confetti";

type OptionData = { id: string; label: string; imageUrl?: string | null; votes: number | null };
type VoterEntry = { name: string; choices: string[] };

type CreatorProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

type PollData = {
  slug: string;
  question: string;
  description: string | null;
  pollType: string;
  category: string;
  isPublic: boolean;
  status: string;
  allowVoteEdit: boolean;
  repolledFrom: string | null;
  createdAt: number;
  expiresAt: number | null;
  isExpired: boolean;
  isInactive: boolean;
  requireName: boolean;
  allowMultiple: boolean;
  minChoices: number;
  maxChoices: number | null;
  resultsVisibility: "always_public" | "after_vote" | "after_deadline" | "creator_only";
  securityMode: string;
  creator?: CreatorProfile | null;
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
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [poll, setPoll] = useState<PollData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voterName, setVoterName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isEditingVote, setIsEditingVote] = useState(false);
  const [toast, setToast] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"ledger" | "donut" | "pie">("ledger");

  const [activeViewers, setActiveViewers] = useState<number>(1);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  // Admin Settings Form States
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState("always_public");
  const [editAllowVoteEdit, setEditAllowVoteEdit] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);

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
      setEditDesc(data.description || "");
      setEditVisibility(data.resultsVisibility || "always_public");
      setEditAllowVoteEdit(data.allowVoteEdit ?? true);
    } catch {
      // transient network error
    }
  }

  // Real-time EventSource (SSE) stream listener
  useEffect(() => {
    fetchPoll();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/polls/${slug}/stream`);
      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "presence") {
            setActiveViewers(payload.viewers || 1);
          } else if (payload.type === "results_update") {
            fetchPoll();
          }
        } catch {}
      };
    } catch {}

    // Fallback polling every 5s if disconnected
    pollTimer.current = setInterval(() => {
      fetchPoll();
    }, 5000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [slug, adminKey]);

  function copyLink() {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    showToast("✓ Voter link copied to clipboard");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleSelect(id: string) {
    if (!poll) return;

    if (poll.pollType === "ranked_choice") {
      // Ranked Choice ordering
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    } else if (poll.allowMultiple) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      } else {
        if (!poll.maxChoices || selectedIds.length < poll.maxChoices) {
          setSelectedIds([...selectedIds, id]);
        }
      }
    } else {
      setSelectedIds([id]);
    }
  }

  async function handleVoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!poll) return;

    if (poll.isInactive) {
      showToast("❌ This poll is inactive/closed.");
      return;
    }

    if (selectedIds.length === 0) {
      showToast("Please select an option.");
      return;
    }

    if (poll.requireName && !voterName.trim() && !poll.hasVoted) {
      showToast("Please enter your name to cast your vote.");
      return;
    }

    setVoting(true);

    try {
      const res = await fetch(`/api/polls/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: selectedIds,
          voterName: voterName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not submit vote.");
      } else {
        fireMotionSafeConfetti();
        showToast(data.isEdit ? "✓ Vote updated successfully!" : "✓ Vote recorded!");
        setIsEditingVote(false);
        fetchPoll();
      }
    } catch {
      showToast("Network error. Please try again.");
    }
    setVoting(false);
  }

  // Admin Actions
  async function handleToggleStatus() {
    if (!adminKey && !poll?.isAdmin) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, action: "toggle_status" }),
      });
      if (res.ok) {
        showToast("✓ Poll status updated");
        fetchPoll();
      }
    } catch {}
    setAdminLoading(false);
  }

  async function handleRepoll() {
    if (!confirm("Start a new round (Repoll)? The current round results will be finalized.")) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, action: "repoll" }),
      });
      const data = await res.json();
      if (res.ok && data.newSlug) {
        showToast(`✓ Started Round 2 as ${data.newSlug}`);
        router.push(`/p/${data.newSlug}?key=${data.adminKey}&created=1`);
      }
    } catch {}
    setAdminLoading(false);
  }

  async function handleSaveSettings() {
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminKey,
          description: editDesc,
          resultsVisibility: editVisibility,
          allowVoteEdit: editAllowVoteEdit,
        }),
      });
      if (res.ok) {
        showToast("✓ Settings updated");
        setShowAdminModal(false);
        fetchPoll();
      }
    } catch {}
    setAdminLoading(false);
  }

  async function handleDeletePoll() {
    if (!confirm("Are you sure you want to delete this poll? It will no longer be accessible.")) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey || "" },
      });
      if (res.ok) {
        alert("Poll deleted successfully.");
        router.push("/explore");
      }
    } catch {}
    setAdminLoading(false);
  }

  if (notFound) {
    return (
      <div className="wrap" style={{ textAlign: "center", padding: "100px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗳️</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Poll Not Found</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
          This poll does not exist or has been removed by its creator.
        </p>
        <Link href="/explore" className="btn-primary">
          Explore Public Polls →
        </Link>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="wrap" style={{ textAlign: "center", padding: "100px 0", color: "var(--muted)", fontFamily: "monospace" }}>
        Loading poll...
      </div>
    );
  }

  const showVotingUI = (!poll.hasVoted || isEditingVote) && !poll.isInactive;
  const isBPC = poll.slug.startsWith("BPC-");

  return (
    <div className="wrap">
      {/* Top Header */}
      <header className="top">
        <Link href="/" style={{ textDecoration: "none" }}>
          <BallotLogo size={32} />
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>Explore</Link>
          <ThemeToggle />
          <Link href="/new" className="btn-primary" style={{ fontSize: 13 }}>+ Create poll</Link>
        </div>
      </header>

      {/* Repoll Round Banner (if linked) */}
      {poll.repolledFrom && (
        <div style={{
          background: "var(--accent-soft)",
          border: "1px solid var(--accent)",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13
        }}>
          <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>
            🔄 Round 2 Consensus · Linked from {poll.repolledFrom}
          </span>
          <Link href={`/p/${poll.repolledFrom}`} style={{ color: "var(--accent-ink)", fontWeight: 700, textDecoration: "underline" }}>
            View Round 1 Results →
          </Link>
        </div>
      )}

      {/* Inactive / Finalized Status Banner */}
      {poll.isInactive && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                Results Finalized
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                This poll is inactive and no longer accepting votes or vote changes.
              </div>
            </div>
          </div>
          {poll.isAdmin && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={adminLoading}
              className="btn-ghost"
              style={{ fontSize: 12 }}
            >
              Reactivate Poll
            </button>
          )}
        </div>
      )}

      <main style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 60 }}>
        {/* Poll Metadata Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge-category">{poll.category || "general"}</span>
              {poll.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
            </div>


            {/* Live Spectator Indicator */}
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: isLiveConnected ? "#10B981" : "#F59E0B", display: "inline-block" }} />
              <span>{activeViewers} live</span>
            </div>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: "var(--ink)", marginBottom: 8 }}>
            {poll.question}
          </h1>

          {poll.description && (
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
              {poll.description}
            </p>
          )}

          {/* Creator Attribution */}
          {poll.creator && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
              <span>Created by</span>
              <Link
                href={`/u/${poll.creator.username}`}
                style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                @{poll.creator.username}
              </Link>
            </div>
          )}
        </div>

        {/* 1. VOTING FORM */}
        {showVotingUI ? (
          <form onSubmit={handleVoteSubmit} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            {isEditingVote && (
              <div style={{
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>↺ Editing your vote</span>
                <button
                  type="button"
                  onClick={() => setIsEditingVote(false)}
                  style={{ background: "none", border: "none", color: "var(--accent-ink)", cursor: "pointer", fontSize: 11 }}
                >
                  Cancel Edit
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {poll.options.map((opt, i) => {
                const isSelected = selectedIds.includes(opt.id);
                const rankIndex = selectedIds.indexOf(opt.id);

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    style={{
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                      background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                      borderRadius: 8,
                      padding: "14px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {poll.pollType === "ranked_choice" ? (
                        <div style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: isSelected ? "var(--accent)" : "var(--line)",
                          color: isSelected ? "#FFFFFF" : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700
                        }}>
                          {isSelected ? rankIndex + 1 : ""}
                        </div>
                      ) : (
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: poll.allowMultiple ? 4 : "50%",
                          border: isSelected ? "5px solid var(--accent)" : "2px solid var(--muted)",
                          background: "#FFFFFF",
                        }} />
                      )}
                      <span style={{ fontSize: 15, fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)" }}>
                        {opt.label}
                      </span>
                    </div>

                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Voter Name Field (if required) */}
            {poll.requireName && !poll.hasVoted && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Your Name <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  className="input-text"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={voting || selectedIds.length === 0}
              className="btn-primary"
              style={{ width: "100%", padding: "14px", fontSize: 15 }}
            >
              {voting ? "Submitting..." : isEditingVote ? "Update My Vote →" : "Submit Vote →"}
            </button>
          </form>
        ) : (
          /* 2. RESULTS VIEW */
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Live Results</h2>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {poll.totalVotes || 0} {poll.totalVotes === 1 ? "ballot" : "ballots"} cast
                </div>
              </div>

              {/* Chart Switcher */}
              <div style={{ display: "flex", gap: 4, background: "var(--paper)", padding: 3, borderRadius: 6, border: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setChartType("ledger")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: chartType === "ledger" ? "var(--surface)" : "none",
                    fontWeight: chartType === "ledger" ? 700 : 500,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Bars
                </button>
                <button
                  type="button"
                  onClick={() => setChartType("donut")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: chartType === "donut" ? "var(--surface)" : "none",
                    fontWeight: chartType === "donut" ? 700 : 500,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Donut
                </button>
              </div>
            </div>

            {/* Result Bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {poll.options.map((opt, i) => {
                const count = opt.votes ?? 0;
                const total = poll.totalVotes || 1;
                const pct = Math.round((count / total) * 100);
                const isMyPick = poll.myVotes.includes(opt.id);

                return (
                  <div key={opt.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: isMyPick ? 700 : 500, color: isMyPick ? "var(--accent-ink)" : "var(--ink)" }}>
                        {opt.label} {isMyPick && "✓ (your pick)"}
                      </span>
                      <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                        {pct}% ({count})
                      </span>
                    </div>
                    <div className="ledger-track" style={{ height: 10, borderRadius: 5 }}>
                      <div
                        className="ledger-fill"
                        style={{
                          width: `${pct}%`,
                          background: isMyPick ? "var(--accent)" : CHART_COLORS[i % CHART_COLORS.length],
                          borderRadius: 5,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Voter Action: Change Vote Button (Locked Spec) */}
            {poll.hasVoted && !poll.isInactive && poll.allowVoteEdit && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(poll.myVotes);
                    setIsEditingVote(true);
                  }}
                  className="btn-ghost"
                  style={{ fontSize: 13, gap: 6 }}
                >
                  ↺ Change your vote
                </button>
              </div>
            )}
          </div>
        )}

        {/* Share & Admin Utility Bar */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={copyLink} className="btn-ghost" style={{ fontSize: 13 }}>
            📋 Copy Voter Link
          </button>
          <button type="button" onClick={() => setShowQR(true)} className="btn-ghost" style={{ fontSize: 13 }}>
            📱 QR Code
          </button>
          <button
            type="button"
            onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
            className="btn-ghost"
            style={{ fontSize: 13 }}
          >
            📥 CSV
          </button>

          {poll.isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="btn-primary"
              style={{ fontSize: 13 }}
            >
              ⚙️ Manage Poll
            </button>
          )}
        </div>
      </main>

      {/* Admin Management Modal Drawer */}
      {showAdminModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Poll Management</h2>
              <button type="button" className="btn-link" onClick={() => setShowAdminModal(false)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Lifecycle Status */}
              <div style={{ background: "var(--paper)", padding: 12, borderRadius: 8, border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Poll Lifecycle</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Current status: {poll.status.toUpperCase()}</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={adminLoading}
                  className="btn-ghost"
                  style={{ fontSize: 12 }}
                >
                  {poll.status === "live" ? "⏸️ Pause Poll" : "▶️ Reactivate"}
                </button>
              </div>

              {/* Repoll / Next Round */}
              <div style={{ background: "var(--paper)", padding: 12, borderRadius: 8, border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Start Next Round (Repoll)</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Spawns Round 2 and preserves Round 1 history.</div>
                </div>
                <button
                  type="button"
                  onClick={handleRepoll}
                  disabled={adminLoading}
                  className="btn-primary"
                  style={{ fontSize: 12 }}
                >
                  🔄 Repoll
                </button>
              </div>

              {/* Allow Vote Edit Toggle */}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editAllowVoteEdit}
                  onChange={(e) => setEditAllowVoteEdit(e.target.checked)}
                />
                <span>Allow voters to change their vote while live</span>
              </label>

              {/* Description Edit */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Context Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Update poll context..."
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleDeletePoll}
                  disabled={adminLoading}
                  style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                >
                  🗑️ Delete Poll
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setShowAdminModal(false)} className="btn-ghost">Cancel</button>
                  <button type="button" onClick={handleSaveSettings} disabled={adminLoading} className="btn-primary">Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ textAlign: "center", maxWidth: 320 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Scan to Vote</h2>
            <img
              src={getQRCodeUrl(typeof window !== "undefined" ? window.location.href : "")}
              alt="Poll QR Code"
              style={{ width: 200, height: 200, margin: "0 auto 16px", borderRadius: 8 }}
            />
            <button type="button" onClick={() => setShowQR(false)} className="btn-primary" style={{ width: "100%" }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "var(--ink)",
          color: "var(--paper)",
          padding: "10px 18px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
          zIndex: 999
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export default function PollPage() {
  return (
    <Suspense fallback={<div style={{ padding: "80px 0", textAlign: "center", color: "var(--muted)" }}>Loading...</div>}>
      <PollContent />
    </Suspense>
  );
}
