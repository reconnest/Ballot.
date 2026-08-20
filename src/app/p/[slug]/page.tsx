"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getQRCodeUrl } from "@/lib/qr-generator";
import { calculateSlices, CHART_COLORS, exportToCSV, exportToJSON } from "@/lib/chart-utils";
import type { RankedPointsResult } from "@/lib/ranking";
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
  rankedPointsResult?: RankedPointsResult | null;
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
  const [copiedLink, setCopiedLink] = useState(false);

  // Ranked Choice Interactive Order & Drag State
  const [rankedOptions, setRankedOptions] = useState<OptionData[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function moveRankedOption(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= rankedOptions.length) return;
    setRankedOptions((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }
  
  // Modals
  const [showQR, setShowQR] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState<"edit" | "settings" | "actions">("edit");
  
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"ledger" | "donut">("ledger");
  const [showIRVSteps, setShowIRVSteps] = useState(false);
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
  const showAdminModalRef = useRef(false);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const rankedInitializedRef = useRef(false);

  // Reset initialization flag when switching to a different poll slug
  useEffect(() => {
    rankedInitializedRef.current = false;
    setRankedOptions([]);
  }, [slug]);

  // Initialize rankedOptions ONLY when first loading or explicitly entering edit mode
  useEffect(() => {
    if (poll?.options && poll.options.length > 0) {
      if (!rankedInitializedRef.current || isEditingVote) {
        if (poll.myVotes && poll.myVotes.length > 0) {
          const ordered: OptionData[] = [];
          for (const id of poll.myVotes) {
            const found = poll.options.find((o) => o.id === id);
            if (found) ordered.push(found);
          }
          for (const o of poll.options) {
            if (!ordered.some((x) => x.id === o.id)) ordered.push(o);
          }
          setRankedOptions(ordered);
        } else if (rankedOptions.length === 0) {
          setRankedOptions([...poll.options]);
        }
        rankedInitializedRef.current = true;
      }
    }
  }, [poll, isEditingVote]);

  useEffect(() => {
    showAdminModalRef.current = showAdminModal;
  }, [showAdminModal]);


  function openManageModal() {
    if (poll) {
      setEditQuestion(poll.question || "");
      setEditOptions((poll.options || []).map((o) => ({ label: o.label, imageUrl: o.imageUrl || "" })));
      setEditDesc(poll.description || "");
      setEditVisibility(poll.resultsVisibility || "after_vote");
      setEditAllowVoteEdit(poll.allowVoteEdit ?? true);
    }
    setShowAdminModal(true);
  }

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
      // ONLY update edit fields if user is NOT currently editing in the modal
      if (!showAdminModalRef.current) {
        setEditQuestion(data.question || "");
        setEditOptions((data.options || []).map((o) => ({ label: o.label, imageUrl: o.imageUrl || "" })));
        setEditDesc(data.description || "");
        setEditVisibility(data.resultsVisibility || "after_vote");
        setEditAllowVoteEdit(data.allowVoteEdit ?? true);
      }
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

  function getShareUrl() {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ballot-poll.vercel.app";
    const path = typeof window !== "undefined" ? window.location.pathname : `/p/${slug}`;
    return `${origin}${path}?v=1`;
  }

  function getFormattedShareMessage() {
    const url = getShareUrl();
    const q = poll?.question ? `"${poll.question}"` : "this poll";
    return `🗳️ Cast your vote on Ballot:\n${q}\n\n👉 Tap to vote (100% free, no signup needed):\n${url}`;
  }

  function copyPollingLink() {
    const textToCopy = getFormattedShareMessage();
    navigator.clipboard.writeText(textToCopy);
    setCopiedLink(true);
    showToast("✓ Invite message with link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function handleShare() {
    const url = getShareUrl();
    const q = poll?.question || "Ballot Poll";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `🗳️ ${q} — Ballot`,
          text: `Cast your vote on: "${q}" (No signup required)`,
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

    const idsToSubmit = poll.pollType === "ranked_choice"
      ? rankedOptions.map((o) => o.id)
      : selectedIds;

    if (idsToSubmit.length === 0) {
      showToast("Please select an option.");
      return;
    }

    if (poll.requireName && !voterName.trim() && !poll.hasVoted) {
      showToast("Please enter your name to cast your vote.");
      return;
    }

    // Synchronously capture exact button position BEFORE async fetch starts!
    let originX: number | undefined;
    let originY: number | undefined;
    if (submitBtnRef.current) {
      const rect = submitBtnRef.current.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
    }

    setVoting(true);

    try {
      const res = await fetch(`/api/polls/${slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: idsToSubmit,
          voterName: voterName.trim() || undefined,
        }),
      });


      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Could not submit vote.");
      } else {
        fireMotionSafeConfetti(originX, originY);
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
    <div className="wrap-840">
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

      <main style={{ width: "100%", paddingBottom: 60 }}>

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

            {poll.pollType === "ranked_choice" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <div style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span>💡 Drag</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>⋮⋮</span>
                  <span>or use ▲ / ▼ to rank options from 1st to {rankedOptions.length}th Choice:</span>
                </div>

                {rankedOptions.map((opt, i) => {
                  const isDragging = draggedIndex === i;
                  const isDragOver = dragOverIndex === i;
                  const pointsForThisRank = Math.max(1, rankedOptions.length - i);

                  return (
                    <div
                      key={opt.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverIndex !== i) setDragOverIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== i) {
                          moveRankedOption(draggedIndex, i);
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderRadius: "var(--radius)",
                        border: isDragOver ? "2px dashed var(--accent)" : "1px solid var(--line)",
                        background: isDragOver ? "var(--accent-soft)" : "var(--paper)",
                        fontSize: 14,
                        transition: "all 0.15s ease",
                        opacity: isDragging ? 0.4 : 1,
                        cursor: "grab",
                      }}
                    >
                      {/* Left: 6-dot Drag Handle + Rank Number + Option Label */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* 6-dot Drag Handle */}
                        <div
                          title="Drag to reorder"
                          style={{
                            cursor: "grab",
                            display: "flex",
                            alignItems: "center",
                            color: "var(--muted)",
                            padding: "2px 4px",
                            userSelect: "none"
                          }}
                        >
                          <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
                            <circle cx="4" cy="3" r="1.5" />
                            <circle cx="10" cy="3" r="1.5" />
                            <circle cx="4" cy="9" r="1.5" />
                            <circle cx="10" cy="9" r="1.5" />
                            <circle cx="4" cy="15" r="1.5" />
                            <circle cx="10" cy="15" r="1.5" />
                          </svg>
                        </div>

                        {/* Rank Badge */}
                        <span style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: "var(--accent)",
                          fontSize: 13,
                          minWidth: 24,
                        }}>
                          #{i + 1}
                        </span>

                        {/* Points Badge */}
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--accent-ink)",
                          background: "var(--surface)",
                          border: "1px solid var(--accent)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontFamily: "monospace"
                        }}>
                          +{pointsForThisRank} pts
                        </span>

                        {/* Optional Image */}
                        {opt.imageUrl && (
                          <img src={opt.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                        )}

                        {/* Option Label */}
                        <span style={{
                          fontWeight: 600,
                          color: "var(--ink)",
                          fontSize: 14,
                        }}>
                          {opt.label}
                        </span>
                      </div>


                      {/* Right: Side-by-side Green Up and Red Down Arrow Buttons */}
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRankedOption(i, i - 1);
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            border: "1px solid var(--line)",
                            borderRadius: 4,
                            background: "var(--surface)",
                            cursor: i === 0 ? "not-allowed" : "pointer",
                            opacity: i === 0 ? 0.25 : 1,
                            color: i === 0 ? "var(--muted)" : "#10B981",
                            fontWeight: 700,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Move priority up"
                          title="Move priority up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={i === rankedOptions.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveRankedOption(i, i + 1);
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            border: "1px solid var(--line)",
                            borderRadius: 4,
                            background: "var(--surface)",
                            cursor: i === rankedOptions.length - 1 ? "not-allowed" : "pointer",
                            opacity: i === rankedOptions.length - 1 ? 0.25 : 1,
                            color: i === rankedOptions.length - 1 ? "var(--muted)" : "#EF4444",
                            fontWeight: 700,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Move priority down"
                          title="Move priority down"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Standard / Multi-Choice Voting UI */
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {poll.options.map((opt, i) => {
                  const isSelected = selectedIds.includes(opt.id);
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
                        <div style={{
                          width: 18,
                          height: 18,
                          borderRadius: poll.allowMultiple ? 4 : "50%",
                          border: isSelected ? "5px solid var(--accent)" : "2px solid var(--muted)",
                          background: "#FFFFFF",
                        }} />
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
            )}

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
              ref={submitBtnRef}
              type="submit"
              disabled={voting || (poll.pollType === "ranked_choice" ? rankedOptions.length === 0 : selectedIds.length === 0)}
              className="btn-primary"
              style={{ width: "100%", padding: "14px", fontSize: 15 }}
            >
              {voting
                ? "Submitting..."
                : poll.pollType === "ranked_choice"
                ? (isEditingVote ? "Update Ranked Order →" : "Submit Ranked Order →")
                : (isEditingVote ? "Update My Vote →" : "Submit Vote →")}
            </button>



          </form>
        ) : (
          /* 2. RESULTS VIEW */
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            {poll.pollType === "ranked_choice" ? (
              /* RANKED CHOICE (POINTS) DEDICATED LEADERBOARD VIEW */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ranked Points Results</h2>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {poll.totalVotes || 0} {poll.totalVotes === 1 ? "ballot recorded" : "total ballots recorded"} · {poll.rankedPointsResult?.totalPointsAwarded || 0} total points scored
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent-soft)", border: "1px solid var(--accent)", padding: "4px 8px", borderRadius: 6, fontFamily: "monospace" }}>
                    Points Scoring
                  </div>
                </div>

                {/* 🏆 Highest Scoring Winner Banner */}
                {poll.rankedPointsResult?.winner ? (
                  <div style={{
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    marginBottom: 20
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>🏆</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-ink)" }}>
                        Highest-Scoring Winner: {poll.rankedPointsResult.winner.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Accumulated <strong>{poll.rankedPointsResult.winner.totalPoints} points</strong> ({poll.rankedPointsResult.winner.scorePct}% score share) across {poll.totalVotes || 0} ballots · Weighted scoring (1st choice = {poll.options.length} pts down to 1 pt).
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 20,
                    fontSize: 12,
                    color: "var(--muted)"
                  }}>
                    ⚡ Waiting for ballots to calculate ranked points winner...
                  </div>
                )}

                {/* ↔ Split Comparison: Left = Your Preference, Right = Points Leaderboard */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
                  {/* Left Column: Your Personal Preference & Points */}
                  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <span>🗳️ Your Preference & Points</span>
                    </div>
                    {poll.myVotes && poll.myVotes.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {poll.myVotes.map((id, idx) => {
                          const opt = poll.options.find((o) => o.id === id);
                          if (!opt) return null;
                          const isTop = idx === 0;
                          const pointsContributed = Math.max(1, poll.options.length - idx);

                          return (
                            <div
                              key={id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 10px",
                                borderRadius: 6,
                                background: isTop ? "var(--accent-soft)" : "var(--surface)",
                                border: isTop ? "1px solid var(--accent)" : "1px solid var(--line)",
                                fontSize: 13,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                                <span style={{ fontFamily: "monospace", fontWeight: 700, color: isTop ? "var(--accent-ink)" : "var(--muted)", minWidth: 22 }}>
                                  #{idx + 1}
                                </span>
                                <span style={{ fontWeight: isTop ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {opt.label}
                                </span>
                              </div>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isTop ? "var(--accent-ink)" : "var(--muted)",
                                background: isTop ? "var(--surface)" : "var(--paper)",
                                border: "1px solid var(--line)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontFamily: "monospace"
                              }}>
                                +{pointsContributed} pts
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--muted)", padding: "16px 0", textAlign: "center" }}>
                        No personal ballot recorded.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Group Points Leaderboard */}
                  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <span>📊 Points Leaderboard</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(poll.rankedPointsResult?.leaderboard || poll.options.map((o, i) => ({
                        id: o.id,
                        label: o.label,
                        rank: i + 1,
                        totalPoints: 0,
                        scorePct: 0,
                        firstChoiceVotes: 0,
                        avgRank: 0,
                        status: "0 pts",
                      }))).map((item, idx) => {
                        const isWinner = idx === 0 && poll.rankedPointsResult?.winner;
                        const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              padding: "8px 10px",
                              borderRadius: 6,
                              background: isWinner ? "var(--accent-soft)" : "var(--surface)",
                              border: isWinner ? "1px solid var(--accent)" : "1px solid var(--line)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                                <span style={{ minWidth: 22, fontSize: idx < 3 ? 14 : 12, fontWeight: 700, fontFamily: "monospace", color: isWinner ? "var(--accent-ink)" : "var(--muted)" }}>
                                  {rankIcon}
                                </span>
                                <span style={{ fontWeight: isWinner ? 700 : 600, color: isWinner ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.label}
                                </span>
                              </div>
                              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: isWinner ? "var(--accent-ink)" : "var(--ink)" }}>
                                {item.totalPoints} pts <span style={{ color: "var(--muted)", fontWeight: 500 }}>({item.scorePct}%)</span>
                              </span>
                            </div>

                            {/* Point Score Progress Bar */}
                            <div className="ledger-track" style={{ height: 6, borderRadius: 3 }}>
                              <div
                                className="ledger-fill"
                                style={{
                                  width: `${item.scorePct}%`,
                                  background: isWinner ? "var(--accent)" : CHART_COLORS[idx % CHART_COLORS.length],
                                  borderRadius: 3,
                                }}
                              />
                            </div>

                            {/* Stats Sub-row */}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", paddingLeft: 30 }}>
                              <span>{item.firstChoiceVotes} 1st-choice picks</span>
                              {item.avgRank > 0 && <span>Avg Rank: #{item.avgRank}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (

              /* STANDARD & MULTIPLE CHOICE POLL RESULTS VIEW */
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Live Results</h2>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {poll.totalVotes || 0} {poll.totalVotes === 1 ? "vote recorded" : "total votes recorded"}
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

                {/* 1. Horizontal Bars View */}
                {chartType === "ledger" ? (
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
                ) : (
                  /* 2. Interactive SVG Donut Chart View */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "10px 0" }}>
                    <div style={{ position: "relative", width: 220, height: 220 }}>
                      <svg width="220" height="220" viewBox="0 0 240 240">
                        {calculateSlices(
                          poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes || 0 })),
                          poll.totalVotes || 0,
                          95,
                          60
                        ).map((slice, i) => (
                          slice.path ? (
                            <path
                              key={slice.id || i}
                              d={slice.path}
                              fill={slice.color}
                              stroke="var(--surface)"
                              strokeWidth="2"
                              style={{ transition: "opacity 0.2s ease", cursor: "pointer" }}
                            >
                              <title>{`${slice.label}: ${slice.votes} votes (${slice.pct}%)`}</title>
                            </path>
                          ) : null
                        ))}
                      </svg>
                      {/* Donut Center Count */}
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        textAlign: "center",
                        pointerEvents: "none"
                      }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>
                          {poll.totalVotes || 0}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                          Votes
                        </div>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, width: "100%" }}>
                      {poll.options.map((opt, i) => {
                        const count = opt.votes ?? 0;
                        const total = poll.totalVotes || 1;
                        const pct = Math.round((count / total) * 100);
                        const color = CHART_COLORS[i % CHART_COLORS.length];
                        const isMyPick = poll.myVotes.includes(opt.id);

                        return (
                          <div
                            key={opt.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: 12,
                              padding: "6px 10px",
                              background: "var(--paper)",
                              borderRadius: 6,
                              border: isMyPick ? "1px solid var(--accent)" : "1px solid var(--line)"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                              <span style={{ fontWeight: isMyPick ? 700 : 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {opt.label}
                              </span>
                            </div>
                            <span style={{ fontFamily: "monospace", color: "var(--muted)", marginLeft: 6 }}>
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}



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

        {/* Typeform-Style Minimalist Squircle Action Bar */}
        <div className="typeform-action-bar">
          {/* 1. Polling Link */}
          <button type="button" onClick={copyPollingLink} className="action-text-btn" title="Copy public polling link">
            <span>Polling link</span>
            <span className={`action-tile ${copiedLink ? "copied" : ""}`}>
              {copiedLink ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </span>
          </button>

          {/* 2. QR Code */}
          <button type="button" onClick={() => setShowQR(true)} className="action-text-btn" title="Scan to vote QR code">
            <span>QR code</span>
            <span className="action-tile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
          </button>

          {poll.isAdmin && (
            <>
              {/* Subtle Divider */}
              <span style={{ width: 1, height: 14, background: "var(--line)", display: "inline-block", margin: "0 2px" }} />

              {/* 3. Embed */}
              <button type="button" onClick={() => setShowEmbedModal(true)} className="action-text-btn" title="Embed poll widget">
                <span>Embed</span>
                <span className="action-tile">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </span>
              </button>

              {/* 4. CSV Export */}
              <button
                type="button"
                onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
                className="action-text-btn"
                title="Download raw CSV results"
              >
                <span>CSV</span>
                <span className="action-tile">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </span>
              </button>

              {/* 5. Manage Poll */}
              <button
                type="button"
                onClick={openManageModal}
                className="action-manage-btn"
                title="Open poll management controls"
              >
                <span>Manage poll</span>
                <span className="action-tile">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </span>
              </button>
            </>
          )}
        </div>

        {/* Viral Voter Marketing Section */}
        <section className="poll-marketing-section" aria-label="Create your own poll">
          <div className="poll-marketing-card">
            <div className="poll-marketing-badge">POWERED BY BALLOT</div>
            <h3 className="poll-marketing-title">Host your own decision in seconds.</h3>
            <p className="poll-marketing-desc">
              Create real-time polls with ranked voting, share one instant link with your audience, and decide together with live analytics. Zero signup required for voters.
            </p>

            <div className="poll-marketing-grid">
              <div className="poll-marketing-feature">
                <div className="poll-marketing-feature-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Ranked Choice</span>
                </div>
                <div className="poll-marketing-feature-desc">Instant runoff consensus voting</div>
              </div>

              <div className="poll-marketing-feature">
                <div className="poll-marketing-feature-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>Live Realtime Sync</span>
                </div>
                <div className="poll-marketing-feature-desc">Instant spectator vote tallies</div>
              </div>

              <div className="poll-marketing-feature">
                <div className="poll-marketing-feature-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Anti-Fraud</span>
                </div>
                <div className="poll-marketing-feature-desc">Device & IP deduplication defense</div>
              </div>
            </div>

            <div className="poll-marketing-actions">
              <Link href="/new" className="btn-primary" style={{ padding: "10px 18px", fontSize: 14 }}>
                + Create a Poll →
              </Link>
              <Link href="/explore" className="btn-ghost" style={{ padding: "10px 18px", fontSize: 14 }}>
                Explore Trending Polls
              </Link>
            </div>
          </div>
        </section>

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
          <div className="modal-box" style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ textAlign: "left" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Scan & Share Poll</h2>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Instant mobile voting via camera</div>
              </div>
              <button type="button" className="btn-link" onClick={() => setShowQR(false)}>✕</button>
            </div>

            {poll && (
              <div style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 14,
                textAlign: "left"
              }}>
                "{poll.question}"
              </div>
            )}
            
            <img
              src={getQRCodeUrl(typeof window !== "undefined" ? window.location.href : "")}
              alt="Poll QR Code"
              style={{ width: 200, height: 200, margin: "0 auto 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#FFFFFF", padding: 8 }}
            />

            <div style={{
              fontSize: 11,
              color: "var(--accent-ink)",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              padding: "4px 8px",
              marginBottom: 16,
              fontFamily: "monospace"
            }}>
              🔒 100% Safe · No App Install · No Signup
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary"
                style={{ flex: 1, fontSize: 13 }}
              >
                ↗ Share to Apps
              </button>
              <button
                type="button"
                onClick={copyPollingLink}
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13 }}
              >
                📋 Copy Invite
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
