"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getQRCodeUrl } from "@/lib/qr-generator";
import { calculateSlices, CHART_COLORS, exportToCSV, exportToJSON } from "@/lib/chart-utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
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
  resultsVisibility: "after_vote" | "after_deadline" | "creator_only";
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
  
  // Modals
  const [showQR, setShowQR] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState<"edit" | "settings" | "actions">("edit");
  
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"ledger" | "donut">("ledger");
  const [activeViewers, setActiveViewers] = useState<number>(1);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  // Admin Editable States
  const [editQuestion, setEditQuestion] = useState("");
  const [editOptions, setEditOptions] = useState<{ label: string; imageUrl: string }[]>([]);
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState<string>("after_vote");
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
    const cacheBuster = `_t=${Date.now()}`;
    const url = activeKey
      ? `/api/polls/${slug}?key=${encodeURIComponent(activeKey)}&${cacheBuster}`
      : `/api/polls/${slug}?${cacheBuster}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: PollData = await res.json();
      setPoll(data);
      setEditQuestion(data.question || "");
      setEditOptions((data.options || []).map((o) => ({ label: o.label, imageUrl: o.imageUrl || "" })));
      setEditDesc(data.description || "");
      setEditVisibility(data.resultsVisibility || "after_vote");
      setEditAllowVoteEdit(data.allowVoteEdit ?? true);
    } catch {}
  }


  useEffect(() => {
    fetchPoll();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/polls/${slug}/stream`);
      eventSource.onopen = () => setIsLiveConnected(true);
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

    pollTimer.current = setInterval(() => fetchPoll(), 5000);

    return () => {
      if (eventSource) eventSource.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [slug, adminKey]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function copyPollingLink() {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    showToast("✓ Polling link copied to clipboard");
  }

  async function handleShare() {
    const url = window.location.origin + window.location.pathname;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: poll?.question || "Ballot Poll",
          url,
        });
        return;
      } catch {}
    }
    copyPollingLink();
  }

  function handleSelect(id: string) {
    if (!poll) return;
    if (poll.pollType === "ranked_choice") {
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
      showToast("❌ This poll is closed / inactive.");
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

  // Pre-vote option editors
  function updateEditOption(i: number, val: string) {
    setEditOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: val } : o)));
  }
  function addEditOption() {
    if (editOptions.length < 30) {
      setEditOptions((prev) => [...prev, { label: "", imageUrl: "" }]);
    }
  }
  function removeEditOption(i: number) {
    if (editOptions.length > 2) {
      setEditOptions((prev) => prev.filter((_, idx) => idx !== i));
    }
  }

  // Admin Actions
  async function handleToggleStatus() {
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
    if (!confirm("Start a new round (Repoll)? Current round results will be finalized and preserved.")) return;
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

  async function handleSaveAdminChanges() {
    setAdminLoading(true);
    const hasZeroVotes = (poll?.totalVotes || 0) === 0;

    const payload: any = {
      adminKey,
      description: editDesc,
      resultsVisibility: editVisibility,
      allowVoteEdit: editAllowVoteEdit,
    };

    if (hasZeroVotes) {
      payload.question = editQuestion.trim();
      payload.options = editOptions.filter((o) => o.label.trim().length > 0);
    }

    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("✓ Poll changes saved!");
        setShowAdminModal(false);

        // Optimistically update React state immediately
        setPoll((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            question: hasZeroVotes && editQuestion.trim() ? editQuestion.trim() : prev.question,
            description: editDesc.trim() || null,
            resultsVisibility: editVisibility as any,
            allowVoteEdit: editAllowVoteEdit,
            options: hasZeroVotes && editOptions.length >= 2
              ? editOptions.filter((o) => o.label.trim().length > 0).map((o, idx) => ({
                  id: prev.options[idx]?.id || `opt-${idx}`,
                  label: o.label.trim(),
                  imageUrl: o.imageUrl,
                  votes: 0,
                }))
              : prev.options,
          };
        });

        // Fetch fresh server state
        await fetchPoll();
      } else {
        showToast(data.error || "Could not save changes.");
      }
    } catch {
      showToast("Network error while saving.");
    }
    setAdminLoading(false);
  }


  async function handleDeletePoll() {
    if (!confirm("Are you sure you want to delete this poll permanently? This cannot be undone.")) return;
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
  const hasZeroVotes = (poll.totalVotes || 0) === 0;

  return (
    <div className="wrap">
      {/* Top Header */}
      <Navbar />

      {/* Repoll Round Banner */}
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
            🔄 Round 2 Consensus · Linked from previous round
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
                This poll is inactive and no longer accepting votes.
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

            {/* Voter Name Field */}
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

            {/* Voter Action: Change Vote Button */}
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
          {/* 1. Polling Link (All users) */}
          <button type="button" onClick={copyPollingLink} className="btn-ghost" style={{ fontSize: 13, gap: 6 }}>
            🔗 Polling Link 📋
          </button>

          {/* 2. QR Code (All users) */}
          <button type="button" onClick={() => setShowQR(true)} className="btn-ghost" style={{ fontSize: 13, gap: 6 }}>
            📱 QR Code
          </button>

          {/* 3. Embed (Creator only) */}
          {poll.isAdmin && (
            <button type="button" onClick={() => setShowEmbedModal(true)} className="btn-ghost" style={{ fontSize: 13, gap: 6 }}>
              ‹/› Embed
            </button>
          )}

          {/* 4. CSV Export (Creator only) */}
          {poll.isAdmin && (
            <button
              type="button"
              onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
              className="btn-ghost"
              style={{ fontSize: 13, gap: 6 }}
            >
              📥 CSV
            </button>
          )}

          {/* 5. Manage Poll (Creator only) */}
          {poll.isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="btn-primary"
              style={{ fontSize: 13, gap: 6 }}
            >
              ⚙️ Manage Poll
            </button>
          )}
        </div>
      </main>

      {/* Redesigned Poll Management Modal */}
      {showAdminModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Poll Management</h2>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: poll.status === "live" ? "var(--accent-soft)" : "var(--line)",
                  color: poll.status === "live" ? "var(--accent-ink)" : "var(--muted)",
                  fontFamily: "monospace"
                }}>
                  ● {poll.status.toUpperCase()}
                </span>
              </div>
              <button type="button" className="btn-link" onClick={() => setShowAdminModal(false)}>✕</button>
            </div>

            {/* Pre-vote vs Post-vote Status Notice Banner */}
            {hasZeroVotes ? (
              <div style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                ✏️ Full Edit Mode · 0 votes cast so far. You can freely edit the question, options, and settings.
              </div>
            ) : (
              <div style={{ background: "var(--paper)", color: "var(--muted)", border: "1px solid var(--line)", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
                🔒 Question & options are locked permanently to protect voter integrity ({poll.totalVotes} votes received).
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Question Editing */}
              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Question</label>
                {hasZeroVotes ? (
                  <input
                    type="text"
                    maxLength={140}
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    className="input-text"
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div style={{ padding: "10px 12px", background: "var(--paper)", borderRadius: 6, border: "1px solid var(--line)", fontSize: 14, color: "var(--ink)" }}>
                    {poll.question}
                  </div>
                )}
              </div>

              {/* Options Editing (Pre-Vote Only) */}
              {hasZeroVotes && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Options ({editOptions.length})</label>
                    {editOptions.length < 30 && (
                      <button type="button" onClick={addEditOption} className="btn-link" style={{ fontSize: 12 }}>
                        + Add option
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {editOptions.map((opt, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace", width: 16 }}>{i + 1}.</span>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateEditOption(i, e.target.value)}
                          className="input-text"
                          style={{ flex: 1, padding: "8px 10px", fontSize: 13 }}
                        />
                        {editOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeEditOption(i)}
                            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14 }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Description */}
              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Context Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Add or update context description..."
                />
              </div>

              {/* Results Visibility */}
              <div>
                <label className="field-label" style={{ marginBottom: 6 }}>Results Visibility</label>
                <div className="expiry-row" style={{ gap: 6 }}>
                  {[
                    { value: "after_vote", label: "After voting" },
                    { value: "after_deadline", label: "After deadline" },
                    { value: "creator_only", label: "Creator only" },
                  ].map((v) => (
                    <button
                      type="button"
                      key={v.value}
                      className={`expiry-chip ${editVisibility === v.value ? "active" : ""}`}
                      onClick={() => setEditVisibility(v.value)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
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

              {/* Actions & Lifecycle Box */}
              <div style={{ background: "var(--paper)", padding: 14, borderRadius: 8, border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Lifecycle & Actions
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={adminLoading}
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    {poll.status === "live" ? "⏸️ Pause Poll" : "▶️ Reactivate Poll"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRepoll}
                    disabled={adminLoading}
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    🔄 Repoll (Next Round)
                  </button>

                  <button
                    type="button"
                    onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    📥 Download CSV
                  </button>
                </div>
              </div>

              {/* Bottom Footer Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={handleDeletePoll}
                  disabled={adminLoading}
                  style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
                >
                  🗑️ Delete Poll
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setShowAdminModal(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveAdminChanges} disabled={adminLoading} className="btn-primary">
                    {adminLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal with Share & Download */}
      {showQR && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Scan to Vote</h2>
              <button type="button" className="btn-link" onClick={() => setShowQR(false)}>✕</button>
            </div>
            
            <img
              src={getQRCodeUrl(typeof window !== "undefined" ? window.location.href : "")}
              alt="Poll QR Code"
              style={{ width: 220, height: 220, margin: "0 auto 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#FFFFFF", padding: 8 }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary"
                style={{ flex: 1, fontSize: 13 }}
              >
                ↗ Share Link
              </button>
              <button
                type="button"
                onClick={copyPollingLink}
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13 }}
              >
                📋 Copy Link
              </button>
            </div>

            <button type="button" onClick={() => setShowQR(false)} className="btn-ghost" style={{ width: "100%", fontSize: 12 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Embed Modal (Creator Only) */}
      {showEmbedModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Embed Poll Widget</h2>
              <button type="button" className="btn-link" onClick={() => setShowEmbedModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Copy and paste this HTML embed snippet into your blog, notion page, or website:
            </p>
            <textarea
              readOnly
              rows={3}
              value={`<iframe src="${typeof window !== "undefined" ? window.location.origin : ""}/embed/${slug}" width="100%" height="450" frameborder="0" style="border-radius: 12px; border: 1px solid #e2e8f0;"></iframe>`}
              style={{ fontFamily: "monospace", fontSize: 12, marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowEmbedModal(false)} className="btn-ghost">
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  const snippet = `<iframe src="${window.location.origin}/embed/${slug}" width="100%" height="450" frameborder="0" style="border-radius: 12px; border: 1px solid #e2e8f0;"></iframe>`;
                  navigator.clipboard.writeText(snippet);
                  showToast("✓ Embed snippet copied!");
                }}
                className="btn-primary"
              >
                Copy Embed Code
              </button>
            </div>
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
