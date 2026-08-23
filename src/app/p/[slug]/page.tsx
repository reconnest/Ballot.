"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getQRCodeUrl } from "@/lib/qr-generator";
import { calculateSlices, CHART_COLORS, exportToCSV, exportToJSON } from "@/lib/chart-utils";
import type { RankedPointsResult } from "@/lib/ranking";
import type { ResultsVisibility } from "@/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navbar } from "@/components/Navbar";
import { AuthModal } from "@/components/AuthModal";
import { Footer } from "@/components/Footer";
import { AdSidebarContainer } from "@/components/AdSlot";
import { fireMotionSafeConfetti } from "@/lib/confetti";
import { AnimatedCopyIcon } from "@/components/icons/AnimatedCopyIcon";
import { AnimatedTrophyIcon } from "@/components/icons/AnimatedTrophyIcon";
import { AnimatedRefreshIcon } from "@/components/icons/AnimatedRefreshIcon";
import {
  Zap,
  Trophy,
  Image as ImageIcon,
  Crown,
  Medal,
  Award,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Key,
  Copy,
  Download,
  RefreshCw,
  Trash2,
  Settings,
  Share2,
  Code2,
  QrCode,
  Check,
  CheckCircle2,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Lightbulb,
  BarChart3,
  LayoutGrid,
  PieChart,
  Infinity as InfinityIcon,
  Vote,
  Edit3,
  PlayCircle,
  RotateCcw,
  CopyPlus,
} from "lucide-react";





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
  resultsVisibility: ResultsVisibility;
  securityMode: string;
  creator?: CreatorProfile | null;
  creatorName?: string | null;
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
  const [chartType, setChartType] = useState<"cards" | "ledger" | "donut">("ledger");
  const [showAdminKeyBanner, setShowAdminKeyBanner] = useState(true);
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showIRVSteps, setShowIRVSteps] = useState(false);

  // Reactivation Modal State
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [reactivateChoice, setReactivateChoice] = useState<"resume" | "reset" | "clone">("resume");
  const [reactivateDeadlineMs, setReactivateDeadlineMs] = useState<number | null>(24 * 60 * 60 * 1000);
  const [reactivateVisibility, setReactivateVisibility] = useState<string>("after_vote");
  const [reactivating, setReactivating] = useState(false);

  const [activeViewers, setActiveViewers] = useState<number>(1);

  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isCastingAnotherVote, setIsCastingAnotherVote] = useState<boolean>(false);



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
  const chartTypeInitializedRef = useRef(false);

  // Reset initialization flag when switching to a different poll slug
  useEffect(() => {
    rankedInitializedRef.current = false;
    chartTypeInitializedRef.current = false;
    setRankedOptions([]);
  }, [slug]);

  // ── Fix 2.4: Inject noindex meta for private polls to prevent search engine indexing ──
  useEffect(() => {
    if (!slug) return;
    if (slug.startsWith("BPP-")) {
      let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
      }
      meta.content = "noindex, nofollow";
      return () => { meta?.remove(); };
    }
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
      if (data.pollType === "image" && !chartTypeInitializedRef.current) {
        setChartType("cards");
        chartTypeInitializedRef.current = true;
      }
      // ONLY update edit fields if user is NOT currently editing in the modal

      if (!showAdminModalRef.current) {
        setEditQuestion(data.question || "");
        setEditOptions((data.options || []).map((o) => ({ label: o.label, imageUrl: o.imageUrl || "" })));
        setEditDesc(data.description || "");
        setEditVisibility(data.resultsVisibility || "after_vote");
        setEditAllowVoteEdit(data.allowVoteEdit ?? true);
      }
    } catch (err) {
      console.error("[fetchPoll] Failed to fetch poll details:", err);
    }
  }




  useEffect(() => {
    fetchPoll();

    let eventSource: EventSource | null = null;
    let sseConnected = false;

    try {
      eventSource = new EventSource(`/api/polls/${slug}/stream`);

      eventSource.onopen = () => {
        sseConnected = true;
        setIsLiveConnected(true);
        // ── Fix 2.1: Clear any fallback timer once SSE is established ──
        if (pollTimer.current) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
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

      // ── Fix 2.1: Only start fallback polling if SSE fails/closes ──
      eventSource.onerror = () => {
        setIsLiveConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Start fallback interval only if SSE never connected or dropped
        if (!pollTimer.current) {
          pollTimer.current = setInterval(() => fetchPoll(), 8000);
        }
      };
    } catch {
      // SSE not available — fall back to polling immediately
      pollTimer.current = setInterval(() => fetchPoll(), 8000);
    }

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
        setIsCastingAnotherVote(false);
        fetchPoll();
      }

    } catch (err) {
      console.error("[handleVote] Submission error:", err);
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showToast("You're offline. Please reconnect and try again. ☁️");
      } else {
        showToast("Network error. Please try again.");
      }
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

  function openReactivateModal() {
    if (!poll) return;
    setReactivateChoice("resume");
    setReactivateDeadlineMs(24 * 60 * 60 * 1000);
    setReactivateVisibility(poll.resultsVisibility || "after_vote");
    setShowReactivateModal(true);
  }

  async function handleConfirmReactivate() {
    if (!poll) return;

    // Choice 3: Duplicate / Clone as New Poll
    if (reactivateChoice === "clone") {
      const cloneData = {
        question: poll.question,
        description: poll.description || "",
        pollType: poll.pollType,
        category: poll.category,
        options: poll.options.map((o) => ({ label: o.label, imageUrl: o.imageUrl || "" })),
        allowMultiple: poll.allowMultiple,
        minChoices: poll.minChoices,
        maxChoices: poll.maxChoices,
        resultsVisibility: poll.resultsVisibility,
        securityMode: poll.securityMode,
        requireName: poll.requireName,
        allowVoteEdit: poll.allowVoteEdit,
      };
      sessionStorage.setItem("ballot_clone_poll", JSON.stringify(cloneData));
      setShowReactivateModal(false);
      router.push("/new");
      return;
    }

    // Choice 2: Reset & Fresh Start confirmation
    if (reactivateChoice === "reset") {
      const confirmReset = confirm(
        `Are you sure you want to reset and clear all ${poll.totalVotes || 0} existing votes? This action cannot be undone.`
      );
      if (!confirmReset) return;
    }

    setReactivating(true);
    try {
      const newExpiresAt = reactivateDeadlineMs === null ? null : Date.now() + reactivateDeadlineMs;
      const action = reactivateChoice === "reset" ? "reactivate_reset" : "reactivate_resume";

      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminKey,
          action,
          expiresAt: newExpiresAt,
          resultsVisibility: reactivateVisibility,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          reactivateChoice === "reset"
            ? "✓ Poll reset and restarted with 0 votes!"
            : "✓ Poll reactivated and accepting new votes!"
        );
        setShowReactivateModal(false);
        fetchPoll();
      } else {
        showToast(data.error || "Could not reactivate poll.");
      }
    } catch (err) {
      console.error("[handleConfirmReactivate] Error:", err);
      showToast("Network error reactivating poll.");
    }
    setReactivating(false);
  }

  // Admin Actions
  async function handleToggleStatus() {
    if (poll?.status === "inactive" || poll?.isExpired) {
      openReactivateModal();
      return;
    }
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/polls/${slug}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, action: "toggle_status" }),
      });
      if (res.ok) {
        showToast("✓ Poll paused");
        fetchPoll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "Could not update status.");
      }
    } catch (err) {
      console.error("[handleToggleStatus] Error:", err);
      showToast("Network error updating status.");
    }
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
      } else {
        showToast(data.error || "Could not create repoll.");
      }
    } catch (err) {
      console.error("[handleRepoll] Error:", err);
      showToast("Network error creating repoll.");
    }
    setAdminLoading(false);
  }

  async function handleSaveAdminChanges() {
    setAdminLoading(true);
    const hasZeroVotes = (poll?.totalVotes || 0) === 0;

    const payload: Record<string, unknown> = {
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
            resultsVisibility: editVisibility as ResultsVisibility,
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
    } catch (err) {
      console.error("[handleSaveAdminChanges] Error:", err);
      showToast("Network error while saving.");
    }
    setAdminLoading(false);
  }

  async function handleClaimAfterAuth(user: { id: string; username: string }) {
    if (!adminKey) return;
    try {
      const res = await fetch("/api/polls/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, adminKey }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🎉 Poll claimed & secured to @${user.username}!`);
        setShowAdminKeyBanner(false);
        fetchPoll();
      } else {
        showToast(data.error || "Could not claim poll.");
      }
    } catch (err) {
      console.error("[handleClaimAfterAuth] Error:", err);
      showToast("Network error while claiming poll.");
    }
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
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "Could not delete poll.");
      }
    } catch (err) {
      console.error("[handleDeletePoll] Error:", err);
      showToast("Network error while deleting poll.");
    }
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

  // Voters see voting UI by default until they vote.
  // Creators (admins) default directly to Live Results, but can click "Test / Cast Ballot" or "Cast Another Vote" to switch to voting UI.
  const isUnlimited = poll.securityMode === "unlimited";
  const showVotingUI = isCastingAnotherVote || (poll.isAdmin
    ? isEditingVote
    : (!poll.hasVoted || isEditingVote) && !poll.isInactive);
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
          <span style={{ color: "var(--accent-ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={13} color="var(--accent)" />
            <span>Round 2 Consensus · Linked from previous round</span>
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
            <Lock size={16} color="var(--muted)" />
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
              onClick={openReactivateModal}
              disabled={adminLoading}
              className="btn-ghost"
              style={{ fontSize: 12 }}
            >
              Reactivate Poll
            </button>
          )}

        </div>
      )}

      <AdSidebarContainer>
        <main style={{ maxWidth: 920, margin: "0 auto", paddingBottom: 60, width: "100%" }}>


        {/* Guest Creator Temporary Setup & Account Security Callout Banner */}
        {showAdminKeyBanner && adminKey && !poll.creator && (
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 4px 16px rgba(15, 118, 110, 0.08)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    Temporary Guest Poll · Secure Your Results
                  </div>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                    You created this poll without logging in. This browser link is a temporary setup — if you lose this URL or clear your browser data, you will lose permanent admin access to manage this poll and its live voter analytics.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminKeyBanner(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "2px 6px", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Dismiss notice"
              >
                <X size={16} />
              </button>
            </div>

            {/* Actions Row */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="btn-primary"
                style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Lock size={13} />
                <span>Sign In to Secure & Claim This Poll</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(`${window.location.origin}/p/${slug}?key=${adminKey}`);
                    setAdminLinkCopied(true);
                    setTimeout(() => setAdminLinkCopied(false), 2000);
                  }
                }}
                className="btn-ghost"
                style={{ fontSize: 12, padding: "8px 14px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {adminLinkCopied ? <Check size={13} color="var(--accent)" /> : <Key size={13} />}
                <span>{adminLinkCopied ? "Link Copied!" : "Copy Secret Admin Link"}</span>
              </button>
            </div>
          </div>
        )}


        {/* Poll Metadata Header */}
        <div style={{ marginBottom: 20 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge-category">{poll.category || "general"}</span>
              {poll.pollType === "image" && <span className="badge-type">Image Poll</span>}
              {poll.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
              {poll.pollType === "standard" && poll.allowMultiple && <span className="badge-type">Multiple Choice</span>}
              {poll.securityMode === "unlimited" && (
                <span className="badge-type" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <InfinityIcon size={12} />
                  <span>Unlimited</span>
                </span>
              )}
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
          {poll.creator ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
              <span>Created by</span>
              <Link
                href={`/u/${poll.creator.username}`}
                style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                @{poll.creator.username}
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
              <span>Created by</span>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {poll.creatorName || "Guest"}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--paper)", border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 4, color: "var(--muted)" }}>
                Guest
              </span>
            </div>
          )}
        </div>


        {/* 1. VOTING FORM */}
        {showVotingUI ? (
          <form onSubmit={handleVoteSubmit} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 20 }}>
            {isCastingAnotherVote && (
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
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Vote size={13} color="var(--accent)" />
                  <span>Casting a new ballot</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCastingAnotherVote(false)}
                  style={{ background: "none", border: "none", color: "var(--accent-ink)", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <X size={12} />
                  <span>Back to Results</span>
                </button>
              </div>
            )}

            {isEditingVote && !isCastingAnotherVote && (
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
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Edit3 size={13} color="var(--accent)" />
                  <span>Editing your vote</span>
                </span>
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
                  <Sparkles size={13} color="var(--accent)" />
                  <span>Drag or use arrows to rank options from 1st to {rankedOptions.length}th Choice:</span>
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
                        background: "var(--paper)",
                        cursor: "grab",
                        opacity: isDragging ? 0.4 : 1,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                        <GripVertical size={14} color="var(--muted)" />
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)", fontSize: 13, minWidth: 24 }}>
                          #{i + 1}
                        </span>
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
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                            style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                          />
                        )}
                        <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opt.label}
                        </span>
                      </div>

                      {/* Rank Movement Controls */}
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => moveRankedOption(i, i - 1)}
                          disabled={i === 0}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: i === 0 ? "transparent" : "var(--surface)",
                            color: i === 0 ? "var(--faint)" : "#10B981",
                            cursor: i === 0 ? "not-allowed" : "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Move priority up"
                          title="Move priority up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRankedOption(i, i + 1)}
                          disabled={i === rankedOptions.length - 1}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: i === rankedOptions.length - 1 ? "transparent" : "var(--surface)",
                            color: i === rankedOptions.length - 1 ? "var(--faint)" : "#EF4444",
                            cursor: i === rankedOptions.length - 1 ? "not-allowed" : "pointer",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          aria-label="Move priority down"
                          title="Move priority down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : poll.pollType === "image" ? (
              /* 🖼️ IMAGE POLL 3-COLUMN VISUAL VOTING GRID */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                {poll.options.map((opt) => {
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(opt.id)}
                      style={{
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                        background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 4px 12px rgba(15, 118, 110, 0.15)" : "var(--shadow-sm)",
                      }}
                    >
                      {/* Image Preview Box */}
                      <div style={{ width: "100%", height: 130, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line)", overflow: "hidden" }}>
                        {opt.imageUrl ? (
                          <img
                            src={opt.imageUrl}
                            alt={opt.label}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <ImageIcon size={28} color="var(--muted)" />
                        )}

                      </div>

                      {/* Bottom Caption & Select Radio / Checkbox */}
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {opt.label}
                        </span>

                        <div style={{
                          width: 18,
                          height: 18,
                          minWidth: 18,
                          borderRadius: poll.allowMultiple ? 4 : "50%",
                          border: isSelected ? "2px solid var(--accent)" : "2px solid var(--muted)",
                          background: isSelected ? "var(--accent)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {isSelected && (poll.allowMultiple ? <Check size={11} strokeWidth={3} /> : "●")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              /* Standard Single / Multi-choice list */
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {poll.options.map((opt) => {
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelect(opt.id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "var(--radius)",
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                        background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)", fontSize: 15 }}>
                        {opt.label}
                      </span>
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: poll.allowMultiple ? 4 : "50%",
                        border: isSelected ? "2px solid var(--accent)" : "2px solid var(--muted)",
                        background: isSelected ? "var(--accent)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {isSelected && (poll.allowMultiple ? <Check size={12} strokeWidth={3} /> : "●")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit Vote Button */}
            <button
              type="submit"
              disabled={voting || (poll.pollType !== "ranked_choice" && selectedIds.length === 0)}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: 15, fontWeight: 700 }}
            >
              {voting ? "Recording Vote..." : poll.pollType === "ranked_choice" ? "Submit Ranked Choices →" : "Cast Vote →"}
            </button>

          </form>
        ) : (
          /* 2. RESULTS VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {poll.pollType === "ranked_choice" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 1. Official Points Consensus Winner Banner */}
                <div>
                  {(() => {
                    const lb = poll.rankedPointsResult?.leaderboard;
                    if (!lb || lb.length === 0 || poll.totalVotes === 0) {
                      return (
                        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                          Leaderboard will be calculated once votes are received.
                        </div>
                      );
                    }

                    const winner = lb[0];
                    const isTied = lb.length > 1 && lb[1].totalPoints === winner.totalPoints && winner.totalPoints > 0;

                    return (
                      <div style={{
                        background: isTied ? "var(--paper)" : "var(--accent-soft)",
                        border: isTied ? "1px solid var(--line)" : "1px solid var(--accent)",
                        borderRadius: 8,
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        boxShadow: isTied ? "none" : "0 4px 12px rgba(15, 118, 110, 0.12)",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                            {isTied ? <BarChart3 size={13} /> : <Trophy size={13} />}
                            <span>{isTied ? "Tied Consensus (Equal Points)" : "Official Points Consensus Winner"}</span>
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                            {winner.label}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            {winner.firstChoiceVotes} first-choice picks ({winner.scorePct}% score share)
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-ink)", fontFamily: "monospace" }}>
                            {winner.totalPoints} pts
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ↔ Split Comparison: Left 35% = Your Preference, Right 65% = Points Leaderboard */}
                <div className="ranked-split-grid">
                  {/* Left Column (35%): Your Personal Preference & Points */}
                  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Vote size={13} color="var(--accent)" />
                      <span>Your Preference & Points</span>
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

                  {/* Right Column (65%): Group Points Leaderboard with Ties Grouped */}
                  <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <BarChart3 size={13} color="var(--accent)" />
                      <span>Points Leaderboard</span>
                    </div>

                    {(() => {
                      const rawItems = poll.rankedPointsResult?.leaderboard || poll.options.map((o, i) => ({
                        id: o.id,
                        label: o.label,
                        rank: i + 1,
                        totalPoints: 0,
                        scorePct: 0,
                        firstChoiceVotes: 0,
                        avgRank: 0,
                        status: "0 pts",
                      }));

                      // Group items by totalPoints for clean tie presentation
                      type PointsGroup = {
                        points: number;
                        scorePct: number;
                        items: typeof rawItems;
                      };

                      const groups: PointsGroup[] = [];
                      rawItems.forEach((item) => {
                        const last = groups[groups.length - 1];
                        if (last && last.points === item.totalPoints && item.totalPoints > 0) {
                          last.items.push(item);
                        } else {
                          groups.push({
                            points: item.totalPoints,
                            scorePct: item.scorePct,
                            items: [item],
                          });
                        }
                      });

                      let runningRank = 1;

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {groups.map((grp, gIdx) => {
                            const isTop = gIdx === 0 && grp.points > 0;
                            const isTied = grp.items.length > 1;
                            const thisGroupRank = runningRank;
                            const rankIcon = gIdx === 0 ? (
                              <Crown size={14} color="var(--accent)" />
                            ) : gIdx === 1 ? (
                              <Medal size={14} color="#8B5CF6" />
                            ) : gIdx === 2 ? (
                              <Award size={14} color="#EC4899" />
                            ) : (
                              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>#{thisGroupRank}</span>
                            );
                            runningRank += grp.items.length;

                            if (isTied) {
                              return (
                                <div
                                  key={`group-${gIdx}`}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    padding: "10px 12px",
                                    borderRadius: 6,
                                    background: isTop ? "var(--accent-soft)" : "var(--surface)",
                                    border: isTop ? "1px solid var(--accent)" : "1px solid var(--line)",
                                  }}
                                >
                                  {/* Tied Group Header */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--line)", paddingBottom: 6 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                                        {rankIcon}
                                      </span>
                                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: isTop ? "var(--accent-ink)" : "var(--muted)" }}>
                                        #{thisGroupRank} (Tied) · {grp.items.length} Options
                                      </span>
                                    </div>
                                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: isTop ? "var(--accent-ink)" : "var(--ink)" }}>
                                      {grp.points} pts <span style={{ color: "var(--muted)", fontWeight: 500 }}>({grp.scorePct}%)</span>
                                    </span>
                                  </div>


                                  {/* Individual items inside tie */}
                                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {grp.items.map((item, itemIdx) => (
                                      <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                                          <span style={{ fontWeight: 600, color: isTop ? "var(--accent-ink)" : "var(--ink)" }}>
                                            {item.label}
                                          </span>
                                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                            {item.firstChoiceVotes} 1st-choice picks
                                          </span>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="ledger-track" style={{ height: 6, borderRadius: 3 }}>
                                          <div
                                            className="ledger-fill"
                                            style={{
                                              width: `${item.scorePct}%`,
                                              background: isTop ? "var(--accent)" : CHART_COLORS[(gIdx * 2 + itemIdx) % CHART_COLORS.length],
                                              borderRadius: 3,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            // Single Option (No Tie)
                            const item = grp.items[0];
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 6,
                                  padding: "8px 10px",
                                  borderRadius: 6,
                                  background: isTop ? "var(--accent-soft)" : "var(--surface)",
                                  border: isTop ? "1px solid var(--accent)" : "1px solid var(--line)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                                    <span style={{ minWidth: 22, fontSize: gIdx < 3 ? 14 : 12, fontWeight: 700, fontFamily: "monospace", color: isTop ? "var(--accent-ink)" : "var(--muted)" }}>
                                      {rankIcon}
                                    </span>
                                    <span style={{ fontWeight: isTop ? 700 : 600, color: isTop ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {item.label}
                                    </span>
                                  </div>
                                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: isTop ? "var(--accent-ink)" : "var(--ink)" }}>
                                    {item.totalPoints} pts <span style={{ color: "var(--muted)", fontWeight: 500 }}>({item.scorePct}%)</span>
                                  </span>
                                </div>

                                {/* Point Score Progress Bar */}
                                <div className="ledger-track" style={{ height: 6, borderRadius: 3 }}>
                                  <div
                                    className="ledger-fill"
                                    style={{
                                      width: `${item.scorePct}%`,
                                      background: isTop ? "var(--accent)" : CHART_COLORS[gIdx % CHART_COLORS.length],
                                      borderRadius: 3,
                                    }}
                                  />
                                </div>

                                {/* Stats Sub-row (No Avg Rank) */}
                                <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 10, color: "var(--muted)" }}>
                                  <span>{item.firstChoiceVotes} 1st-choice picks</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (


              /* STANDARD & MULTIPLE CHOICE POLL RESULTS VIEW */
              <div>
                {(() => {
                  const totalVotesCast = poll.options.reduce((sum, o) => sum + (o.votes ?? 0), 0);
                  const maxOptionVotes = Math.max(...poll.options.map((o) => o.votes ?? 0), 0);
                  const isUnlimited = poll.securityMode === "unlimited";

                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div>
                          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Live Results</h2>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {totalVotesCast} {totalVotesCast === 1 ? "vote recorded" : "total votes recorded"}
                          </div>
                        </div>

                        {/* Chart Switcher */}
                        <div style={{ display: "flex", gap: 4, background: "var(--paper)", padding: 3, borderRadius: 6, border: "1px solid var(--line)" }}>
                          {poll.pollType === "image" && (
                            <button
                              type="button"
                              onClick={() => setChartType("cards")}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "none",
                                background: chartType === "cards" ? "var(--surface)" : "none",
                                fontWeight: chartType === "cards" ? 700 : 500,
                                fontSize: 11,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <LayoutGrid size={12} color={chartType === "cards" ? "var(--accent)" : "currentColor"} />
                              <span>Cards</span>
                            </button>
                          )}
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
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <BarChart3 size={12} color={chartType === "ledger" ? "var(--accent)" : "currentColor"} />
                            <span>Bars</span>
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
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <PieChart size={12} color={chartType === "donut" ? "var(--accent)" : "currentColor"} />
                            <span>Donut</span>
                          </button>
                        </div>
                      </div>

                      {/* 1. 🖼️ Visual Cards Grid View (Default for Image Polls) */}
                      {chartType === "cards" && poll.pollType === "image" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                          {poll.options.map((opt, i) => {
                            const count = opt.votes ?? 0;
                            const pct = totalVotesCast > 0 ? Math.round((count / totalVotesCast) * 100) : 0;
                            const isLeader = maxOptionVotes > 0 && count === maxOptionVotes;
                            const isMyPick = !isUnlimited && poll.myVotes.includes(opt.id);
                            const isHighlighted = isLeader;

                            return (
                              <div
                                key={opt.id}
                                style={{
                                  background: "var(--paper)",
                                  border: isLeader ? "2px solid var(--accent)" : "1px solid var(--line)",
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  display: "flex",
                                  flexDirection: "column",
                                  boxShadow: isLeader ? "0 4px 12px rgba(15, 118, 110, 0.15)" : "var(--shadow-sm)",
                                }}
                              >
                                {/* Image Box with Floating % Badge */}
                                <div style={{
                                  width: "100%",
                                  height: 130,
                                  background: "var(--surface)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  borderBottom: "1px solid var(--line)",
                                  overflow: "hidden",
                                  position: "relative"
                                }}>
                                  {opt.imageUrl ? (
                                    <img
                                      src={opt.imageUrl}
                                      alt={opt.label}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                    />
                                  ) : (
                                    <ImageIcon size={28} color="var(--muted)" />
                                  )}
                                  <div style={{
                                    position: "absolute",
                                    top: 6,
                                    right: 6,
                                    background: isLeader ? "var(--accent)" : "rgba(0,0,0,0.75)",
                                    color: "#FFFFFF",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    fontFamily: "monospace"
                                  }}>
                                    {pct}%
                                  </div>
                                </div>

                                {/* Details */}
                                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: isLeader ? 700 : 600, color: isLeader ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {opt.label}
                                    </span>
                                    <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                      {isLeader && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                          <AnimatedTrophyIcon size={13} /> Leader
                                        </span>
                                      )}

                                      {isMyPick && (
                                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "var(--line)", padding: "1px 4px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 2 }}>
                                          <Check size={10} strokeWidth={3} /> You
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--muted)" }}>
                                    <span>{count} {count === 1 ? "vote" : "votes"}</span>
                                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{pct}%</span>
                                  </div>

                                  {/* Mini Progress Track */}
                                  <div className="ledger-track" style={{ height: 5, borderRadius: 3 }}>
                                    <div
                                      className="ledger-fill"
                                      style={{
                                        width: `${pct}%`,
                                        background: isLeader ? "var(--accent)" : CHART_COLORS[i % CHART_COLORS.length],
                                        borderRadius: 3,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : chartType === "ledger" ? (
                        /* 2. Horizontal Bars View */
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {poll.options.map((opt, i) => {
                            const count = opt.votes ?? 0;
                            const pct = totalVotesCast > 0 ? Math.round((count / totalVotesCast) * 100) : 0;
                            const isLeader = maxOptionVotes > 0 && count === maxOptionVotes;
                            const isMyPick = !isUnlimited && poll.myVotes.includes(opt.id);
                            const isHighlighted = isLeader;

                            return (
                              <div key={opt.id}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 5 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                                    {opt.imageUrl && (
                                      <img
                                        src={opt.imageUrl}
                                        alt=""
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = "none";
                                        }}
                                        style={{ width: 26, height: 26, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                                      />
                                    )}
                                    <span style={{ fontWeight: isLeader ? 700 : 500, color: isLeader ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {opt.label}
                                    </span>
                                    {isLeader && (
                                      <span className="badge-leader" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                        <AnimatedTrophyIcon size={14} /> Leader
                                      </span>
                                    )}
                                    {isMyPick && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", background: "var(--line)", padding: "1px 4px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                                        <Check size={10} strokeWidth={3} /> You
                                      </span>
                                    )}
                                  </div>


                                  <span style={{ fontFamily: "monospace", color: "var(--muted)", flexShrink: 0, marginLeft: 8 }}>
                                    {pct}% ({count})
                                  </span>
                                </div>

                                <div className="ledger-track" style={{ height: 10, borderRadius: 5 }}>
                                  <div
                                    className="ledger-fill"
                                    style={{
                                      width: `${pct}%`,
                                      background: isHighlighted ? "var(--accent)" : CHART_COLORS[i % CHART_COLORS.length],
                                      borderRadius: 5,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* 3. Interactive SVG Donut Chart View */
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "10px 0" }}>
                          <div style={{ position: "relative", width: 220, height: 220 }}>
                            <svg width="220" height="220" viewBox="0 0 240 240">
                              {calculateSlices(
                                poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes || 0 })),
                                totalVotesCast,
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
                                {totalVotesCast}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>
                                Votes
                              </div>
                            </div>
                          </div>

                          {/* Legend Pills */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500 }}>
                            {poll.options.map((opt, i) => {
                              const count = opt.votes ?? 0;
                              const pct = totalVotesCast > 0 ? Math.round((count / totalVotesCast) * 100) : 0;
                              return (
                                <div
                                  key={opt.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    background: "var(--surface)",
                                    border: "1px solid var(--line)",
                                    padding: "4px 8px",
                                    borderRadius: 6
                                  }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i % CHART_COLORS.length], display: "inline-block" }} />
                                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{opt.label}</span>
                                  <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Voter Action: Change Vote Button or Creator Test Vote Button */}
                      {!poll.isInactive && (
                        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)", textAlign: "center" }}>
                          {poll.securityMode === "unlimited" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds([]);
                                setIsEditingVote(false);
                                setIsCastingAnotherVote(true);
                              }}
                              className="btn-ghost"
                              style={{ fontSize: 13, gap: 6, display: "inline-flex", alignItems: "center" }}
                            >
                              <AnimatedRefreshIcon size={14} />
                              <span>Cast Another Vote</span>
                            </button>
                          ) : poll.hasVoted && poll.allowVoteEdit ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds(poll.myVotes);
                                setIsEditingVote(true);
                                setIsCastingAnotherVote(false);
                              }}
                              className="btn-ghost"
                              style={{ fontSize: 13, gap: 6, display: "inline-flex", alignItems: "center" }}
                            >
                              <AnimatedRefreshIcon size={14} />
                              <span>Change your vote</span>
                            </button>
                          ) : poll.isAdmin ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds([]);
                                setIsEditingVote(true);
                                setIsCastingAnotherVote(false);
                              }}
                              className="btn-ghost"
                              style={{ fontSize: 13, gap: 6, display: "inline-flex", alignItems: "center" }}
                            >
                              <Edit3 size={13} />
                              <span>Test / Cast Ballot</span>
                            </button>
                          ) : null}
                        </div>
                      )}
                    </>
                  );
                })()}
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
              <AnimatedCopyIcon copied={copiedLink} size={13} />
            </span>
          </button>


          {/* 2. QR Code */}
          <button type="button" onClick={() => setShowQR(true)} className="action-text-btn" title="Scan to vote QR code">
            <span>QR code</span>
            <span className="action-tile">
              <QrCode size={13} />
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
                  <Code2 size={13} />
                </span>
              </button>

              {/* 4. CSV & JSON Export */}
              <button
                type="button"
                onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
                className="action-text-btn"
                title="Download raw CSV results"
              >
                <span>CSV</span>
                <span className="action-tile">
                  <Download size={13} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => exportToJSON(poll)}
                className="action-text-btn"
                title="Download complete JSON data"
              >
                <span>JSON</span>
                <span className="action-tile">
                  <Download size={13} />
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
                  <Settings size={13} />
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
                  <Check size={14} color="var(--accent)" strokeWidth={2.5} />
                  <span>Ranked Choice</span>
                </div>
                <div className="poll-marketing-feature-desc">Instant runoff consensus voting</div>
              </div>

              <div className="poll-marketing-feature">
                <div className="poll-marketing-feature-title">
                  <Check size={14} color="var(--accent)" strokeWidth={2.5} />
                  <span>Anti-Fraud Engine</span>
                </div>
                <div className="poll-marketing-feature-desc">Robust fingerprinting protection</div>
              </div>

              <div className="poll-marketing-feature">
                <div className="poll-marketing-feature-title">
                  <Check size={14} color="var(--accent)" strokeWidth={2.5} />
                  <span>Live SSE Sync</span>
                </div>
                <div className="poll-marketing-feature-desc">Watch incoming votes update live</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <Link href="/new" className="btn-primary" style={{ padding: "10px 22px", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
                Create a Free Poll →
              </Link>
              <Link href="/explore" className="btn-ghost" style={{ padding: "10px 22px", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
                Explore Community Polls
              </Link>
            </div>
          </div>
        </section>


        <Footer />
      </main>
    </AdSidebarContainer>




      {/* Redesigned Poll Management Modal */}
      {showAdminModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={18} color="var(--accent)" />
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Poll Management</h2>
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
              <button type="button" className="btn-link" onClick={() => setShowAdminModal(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
            </div>

            {/* Pre-vote vs Post-vote Status Notice Banner */}
            {hasZeroVotes ? (
              <div style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <Edit3 size={13} color="var(--accent)" />
                <span>Full Edit Mode · 0 votes cast so far. You can freely edit the question, options, and settings.</span>
              </div>
            ) : (
              <div style={{ background: "var(--paper)", color: "var(--muted)", border: "1px solid var(--line)", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={13} color="var(--muted)" />
                <span>Question & options are locked permanently to protect voter integrity ({poll.totalVotes} votes received).</span>
              </div>
            )}

            {/* Secret Creator Management Link & Guest Security Callout */}
            {adminKey && (
              <div style={{
                background: "var(--paper)",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Key size={13} color="var(--accent)" />
                    <span>Secret Admin Management Link</span>
                  </div>
                  {!poll.creator && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "1px 6px", borderRadius: 4 }}>
                      Guest Mode
                    </span>
                  )}
                </div>

                {!poll.creator && (
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <AlertTriangle size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>This link is a temporary session key. Sign in or create a free account to permanently secure this poll to your creator profile:</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/p/${slug}?key=${adminKey}` : `/p/${slug}?key=${adminKey}`}
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: 11,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        navigator.clipboard.writeText(`${window.location.origin}/p/${slug}?key=${adminKey}`);
                        setAdminLinkCopied(true);
                        setTimeout(() => setAdminLinkCopied(false), 2000);
                      }
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: "6px 12px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {adminLinkCopied ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                    <span>{adminLinkCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                {!poll.creator && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setShowAuthModal(true);
                    }}
                    className="btn-primary"
                    style={{ fontSize: 11, padding: "6px 12px", marginTop: 2, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Lock size={12} />
                    <span>Sign In to Secure & Claim Poll</span>
                  </button>
                )}
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
                            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <X size={14} />
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
                    style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={12} />
                    <span>{poll.status === "live" ? "Pause Poll" : "Reactivate Poll"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRepoll}
                    disabled={adminLoading}
                    className="btn-ghost"
                    style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={12} />
                    <span>Repoll (Next Round)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportToCSV(poll.question, poll.options.map(o => ({ label: o.label, votes: o.votes || 0 })), poll.totalVotes || 0)}
                    className="btn-ghost"
                    style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={12} />
                    <span>Download CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportToJSON(poll)}
                    className="btn-ghost"
                    style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={12} />
                    <span>Download JSON</span>
                  </button>

                </div>
              </div>

              {/* Bottom Footer Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                <button
                  type="button"
                  onClick={handleDeletePoll}
                  disabled={adminLoading}
                  style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Trash2 size={13} />
                  <span>Delete Poll</span>
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
              <button type="button" className="btn-link" onClick={() => setShowQR(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
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
              fontFamily: "monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}>
              <ShieldCheck size={13} color="var(--accent)" />
              <span>100% Safe · No App Install · No Signup</span>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
              <button
                type="button"
                onClick={handleShare}
                className="btn-primary"
                style={{ flex: 1, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Share2 size={13} />
                <span>Share to Apps</span>
              </button>
              <button
                type="button"
                onClick={copyPollingLink}
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <AnimatedCopyIcon copied={copiedLink} size={15} />
                <span>{copiedLink ? "Copied!" : "Copy Invite"}</span>
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
              <button type="button" className="btn-link" onClick={() => setShowEmbedModal(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={18} />
              </button>
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

      {/* Reactivation 3-Option Modal */}
      {showReactivateModal && poll && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReactivateModal(false);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "24px 24px 20px",
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              animation: "fadeIn 0.2s ease",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <RotateCcw size={18} color="var(--accent)" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    Reactivate Poll
                  </h3>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    Choose how you want to reopen or reuse this poll:
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReactivateModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3 Interactive Option Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              
              {/* Option 1: Resume Polling */}
              <div
                onClick={() => setReactivateChoice("resume")}
                style={{
                  border: reactivateChoice === "resume" ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: reactivateChoice === "resume" ? "var(--paper)" : "var(--surface)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: reactivateChoice === "resume" ? "0 2px 12px 0 var(--accent-soft)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: reactivateChoice === "resume" ? "6px solid var(--accent)" : "2px solid var(--muted)",
                    background: "var(--paper)",
                    flexShrink: 0,
                    marginTop: 2,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>1. Resume Polling</span>
                      <span style={{ fontSize: 11, background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                        Keep Old Votes + Accept New
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                      Preserve all <strong>{poll.totalVotes || 0}</strong> existing votes and immediately open the ballot for new incoming responses on this link.
                    </div>

                    {/* Nested Deadline Selector when Resume is active */}
                    {reactivateChoice === "resume" && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                          Select New Deadline:
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[
                            { label: "No limit", ms: null },
                            { label: "+1 hour", ms: 60 * 60 * 1000 },
                            { label: "+24 hours", ms: 24 * 60 * 60 * 1000 },
                            { label: "+7 days", ms: 7 * 24 * 60 * 60 * 1000 },
                            { label: "+30 days", ms: 30 * 24 * 60 * 60 * 1000 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setReactivateDeadlineMs(preset.ms)}
                              style={{
                                fontSize: 12,
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: reactivateDeadlineMs === preset.ms ? "1px solid var(--accent)" : "1px solid var(--line)",
                                background: reactivateDeadlineMs === preset.ms ? "var(--accent)" : "var(--surface)",
                                color: reactivateDeadlineMs === preset.ms ? "#FFF" : "var(--ink)",
                                fontWeight: reactivateDeadlineMs === preset.ms ? 700 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 2: Reset & Start Fresh */}
              <div
                onClick={() => setReactivateChoice("reset")}
                style={{
                  border: reactivateChoice === "reset" ? "2px solid #F59E0B" : "1px solid var(--line)",
                  background: reactivateChoice === "reset" ? "var(--paper)" : "var(--surface)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: reactivateChoice === "reset" ? "0 2px 12px 0 rgba(245, 158, 11, 0.2)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: reactivateChoice === "reset" ? "6px solid #F59E0B" : "2px solid var(--muted)",
                    background: "var(--paper)",
                    flexShrink: 0,
                    marginTop: 2,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>2. Reset & Start Fresh</span>
                      <span style={{ fontSize: 11, background: "#FEF3C7", color: "#B45309", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                        Same URL & QR · Wipe Past Votes
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                      Keep your existing share link and QR code, but wipe the <strong>{poll.totalVotes || 0}</strong> previous votes to restart fresh from 0.
                    </div>

                    {/* Nested Deadline Selector when Reset is active */}
                    {reactivateChoice === "reset" && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", marginBottom: 6 }}>
                          ⚠️ Previous {poll.totalVotes || 0} votes will be cleared. Select New Deadline:
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[
                            { label: "No limit", ms: null },
                            { label: "+1 hour", ms: 60 * 60 * 1000 },
                            { label: "+24 hours", ms: 24 * 60 * 60 * 1000 },
                            { label: "+7 days", ms: 7 * 24 * 60 * 60 * 1000 },
                            { label: "+30 days", ms: 30 * 24 * 60 * 60 * 1000 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setReactivateDeadlineMs(preset.ms)}
                              style={{
                                fontSize: 12,
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: reactivateDeadlineMs === preset.ms ? "1px solid #D97706" : "1px solid var(--line)",
                                background: reactivateDeadlineMs === preset.ms ? "#D97706" : "var(--surface)",
                                color: reactivateDeadlineMs === preset.ms ? "#FFF" : "var(--ink)",
                                fontWeight: reactivateDeadlineMs === preset.ms ? 700 : 500,
                                cursor: "pointer",
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 3: Duplicate as New Poll */}
              <div
                onClick={() => setReactivateChoice("clone")}
                style={{
                  border: reactivateChoice === "clone" ? "2px solid #3B82F6" : "1px solid var(--line)",
                  background: reactivateChoice === "clone" ? "var(--paper)" : "var(--surface)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: reactivateChoice === "clone" ? "0 2px 12px 0 rgba(59, 130, 246, 0.2)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: reactivateChoice === "clone" ? "6px solid #3B82F6" : "2px solid var(--muted)",
                    background: "var(--paper)",
                    flexShrink: 0,
                    marginTop: 2,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>3. Duplicate as New Poll</span>
                      <span style={{ fontSize: 11, background: "#DBEAFE", color: "#1E40AF", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                        Brand New URL · Fully Editable
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.4 }}>
                      Keep this poll archived with all results. Opens the poll creation wizard with questions and options pre-filled so you can edit and launch a new poll.
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <button
                type="button"
                onClick={() => setShowReactivateModal(false)}
                className="btn-ghost"
                disabled={reactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReactivate}
                className="btn-primary"
                disabled={reactivating}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {reactivating ? "Processing..." : reactivateChoice === "clone" ? "Open in Creation Wizard →" : "✓ Confirm & Reactivate"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Auth Modal for claiming poll and securing account */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMessage="Sign in or register to secure this poll and its results to your permanent creator profile."
        onSuccess={handleClaimAfterAuth}
      />


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
