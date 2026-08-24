"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";
import { AuthModal } from "@/components/AuthModal";
import { getCachedSessionUser, setCachedSessionUser } from "@/lib/session-cache";
import { fireMotionSafeConfetti } from "@/lib/confetti";
import { compressImage } from "@/lib/image-utils";
import { AdSidebarContainer } from "@/components/AdSlot";
import {
  Zap,
  Trophy,
  Image as ImageIcon,
  UploadCloud,
  ClipboardPaste,
  Camera,
  Plus,
  X,
  Globe,
  Lock,
  Settings,
  Eye,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ArrowRight,
  GripVertical,
  Check,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Info,
} from "lucide-react";


const EXPIRY_PRESETS = [
  { label: "No limit", ms: null },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];


const VISIBILITY_CHOICES = [
  { value: "after_vote", label: "After voting", hint: "Voters see live results immediately after casting their ballot" },
  { value: "after_deadline", label: "After deadline", hint: "Results stay hidden until the poll is closed" },
  { value: "creator_only", label: "Creator only", hint: "Only you (with secret admin key) can see results" },
];

const SECURITY_MODES = [
  {
    value: "unlimited",
    label: "Unlimited",
    short: "Vote Any Number of Times",
    desc: "No duplicate restrictions. Any voter can cast multiple votes freely. Perfect for informal polls, testing, or high-volume activities."
  },
  {
    value: "relaxed",
    label: "Relaxed",
    short: "Shared Wi-Fi Friendly",
    desc: "Cookie-based verification. Best for offices, schools, and conferences sharing a single network IP."
  },
  {
    value: "standard",
    label: "Standard",
    short: "Balanced Protection",
    desc: "Cookie + Network IP digest. Standard protection against casual double-voting."
  },
  {
    value: "strict",
    label: "Strict",
    short: "High Integrity",
    desc: "Browser fingerprinting + Cookie defense. Blocks private window voting."
  },
];


const POLL_TYPES = [
  {
    value: "standard",
    label: "Standard Poll",
    hint: "Single choice or multiple selections",
    icon: Zap,
  },
  {
    value: "ranked_choice",
    label: "Ranked Choice (Points)",
    hint: "Voters rank choices in order of preference (1st gets max points)",
    icon: Trophy,
  },
  {
    value: "image",
    label: "Image Poll",
    hint: "Include image previews with each choice",
    icon: ImageIcon,
  },
];




const PRESET_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "tech", label: "Tech" },
  { value: "gaming", label: "Gaming" },
  { value: "entertainment", label: "Entertainment" },
  { value: "sports", label: "Sports" },
  { value: "food", label: "Food" },
];

type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
};

export default function NewPollPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => getCachedSessionUser());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMsg, setAuthModalMsg] = useState("");

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [guestCreatorName, setGuestCreatorName] = useState("");
  const [pollType, setPollType] = useState("standard");

  const [category, setCategory] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isPublic, setIsPublic] = useState(() => !!getCachedSessionUser()); // Default to Public if logged in
  const [opts, setOpts] = useState<{ label: string; imageUrl: string }[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
  ]);

  // Multiple Choice Min / Max (Synced for uniformity)
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [minChoices, setMinChoices] = useState(2);
  const [maxChoices, setMaxChoices] = useState(2);

  // Settings
  const [resultsVisibility, setResultsVisibility] = useState("after_vote"); // Locked spec: Default after_vote
  const [securityMode, setSecurityMode] = useState("relaxed");
  const [allowVoteEdit, setAllowVoteEdit] = useState(true);

  // Deadline & Custom Time Limit
  const [expiryPreset, setExpiryPreset] = useState<number | null | "custom">(null);
  const [customExpiryValue, setCustomExpiryValue] = useState<number>(3);
  const [customExpiryUnit, setCustomExpiryUnit] = useState<"hours" | "days" | "minutes">("days");

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requireName, setRequireName] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSelectedIndices, setPreviewSelectedIndices] = useState<number[]>([]);
  const [previewRankedOrder, setPreviewRankedOrder] = useState<number[]>([]);
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  // Option Drag & Drop Reordering State
  const [draggedOptIdx, setDraggedOptIdx] = useState<number | null>(null);
  const [dragOverOptIdx, setDragOverOptIdx] = useState<number | null>(null);



  useEffect(() => {
    try {
      const cloneRaw = sessionStorage.getItem("ballot_clone_poll");
      if (cloneRaw) {
        sessionStorage.removeItem("ballot_clone_poll");
        const data = JSON.parse(cloneRaw);
        if (data.question) setQuestion(data.question);
        if (data.description) {
          setDescription(data.description);
          setShowDesc(true);
        }
        if (data.pollType) setPollType(data.pollType);
        if (data.category) setCategory(data.category);
        if (Array.isArray(data.options) && data.options.length >= 2) {
          setOpts(data.options.map((o: any) => ({ label: o.label || "", imageUrl: o.imageUrl || "" })));
        }
        if (typeof data.allowMultiple === "boolean") setAllowMultiple(data.allowMultiple);
        if (typeof data.minChoices === "number") setMinChoices(data.minChoices);
        if (typeof data.maxChoices === "number") setMaxChoices(data.maxChoices);
        if (data.resultsVisibility) setResultsVisibility(data.resultsVisibility);
        if (data.securityMode) setSecurityMode(data.securityMode);
        if (typeof data.requireName === "boolean") setRequireName(data.requireName);
        if (typeof data.allowVoteEdit === "boolean") setAllowVoteEdit(data.allowVoteEdit);
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function checkAuth() {

      try {
        const res = await fetch(`/api/auth/me?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setSessionUser(data.user);
            setCachedSessionUser(data.user);
            setIsPublic(true);
          } else {
            setSessionUser(null);
            setCachedSessionUser(null);
            setIsPublic(false);
          }
        }
      } catch (err) {
        console.warn("[checkAuth] Auth verification failed or offline:", err);
      }
    }

    checkAuth();
  }, []);

  function handleSelectCommunity() {
    if (!sessionUser) {
      setAuthModalMsg("A creator account is required to publish public community polls.");
      setShowAuthModal(true);
    } else {
      setIsPublic(true);
    }
  }

  function handleMinChoicesChange(newMin: number) {
    const clampedMin = Math.max(1, Math.min(newMin, opts.length));
    setMinChoices(clampedMin);
    // Uniform sync: Default max to whatever min selects, but don't let max be less than min
    if (maxChoices < clampedMin || maxChoices === minChoices) {
      setMaxChoices(clampedMin);
    }
  }

  function handleMaxChoicesChange(newMax: number) {
    const clampedMax = Math.max(minChoices, Math.min(newMax, opts.length));
    setMaxChoices(clampedMax);
  }

  function handleApplyBulkPaste() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim().replace(/^[-*•\d+.]+\s*/, ""))
      .filter((l) => l.length > 0)
      .slice(0, 30);

    if (lines.length >= 2) {
      setOpts(lines.map((l) => ({ label: l, imageUrl: "" })));
    } else if (lines.length === 1) {
      setOpts([{ label: lines[0], imageUrl: "" }, { label: "", imageUrl: "" }]);
    }
    setShowBulkModal(false);
    setBulkText("");
  }

  function updateOptLabel(i: number, val: string) {
    setOpts((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: val } : o)));
  }
  function updateOptImage(i: number, val: string) {
    setOpts((prev) => prev.map((o, idx) => (idx === i ? { ...o, imageUrl: val } : o)));
  }
  async function handleImageUpload(i: number, file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP, GIF).");
      return;
    }
    setError("");
    try {
      const compressed = await compressImage(file, 800, 0.85);
      updateOptImage(i, compressed);
    } catch (err) {
      console.error("[handleImageUpload] Compression error:", err);
      // Fallback to reading file directly as base64
      const reader = new FileReader();
      reader.onload = (e) => updateOptImage(i, e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  function formatFileNameToLabel(fileName: string): string {
    const withoutExt = fileName.replace(/\.[^/.]+$/, "");
    const withSpaces = withoutExt.replace(/[_-]+/g, " ").trim();
    return withSpaces
      .split(/\s+/)
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ");
  }

  async function handleBulkImageUpload(files: FileList | File[]) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArr.length === 0) {
      setError("Please select valid image files (PNG, JPG, WEBP, GIF).");
      return;
    }
    setError("");

    const processFile = async (file: File): Promise<{ label: string; imageUrl: string }> => {
      const label = formatFileNameToLabel(file.name);
      try {
        const compressed = await compressImage(file, 800, 0.85);
        return { label, imageUrl: compressed };
      } catch (err) {
        console.error(`[handleBulkImageUpload] Failed to compress ${file.name}:`, err);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ label, imageUrl: (e.target?.result as string) || "" });
          reader.onerror = () => resolve({ label, imageUrl: "" });
          reader.readAsDataURL(file);
        });
      }
    };

    const processed = await Promise.all(fileArr.map(processFile));

    setOpts((prev) => {
      const hasOnlyEmptyOpts = prev.every((o) => !o.label.trim() && !o.imageUrl);
      const combined = hasOnlyEmptyOpts ? processed : [...prev, ...processed];
      return combined.slice(0, 30);
    });
  }

  function addOpt() {
    if (opts.length < 30) {
      setOpts((prev) => [...prev, { label: "", imageUrl: "" }]);
    }
  }


  function removeOpt(i: number) {
    if (opts.length > 2) {
      setOpts((prev) => prev.filter((_, idx) => idx !== i));
    }
  }

  // Option Drag & Drop / Reordering Handlers
  function handleReorderOptions(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= opts.length || toIdx >= opts.length) return;
    setOpts((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
  }

  function handleMoveOption(fromIdx: number, direction: "prev" | "next" | "up" | "down") {
    const toIdx = (direction === "prev" || direction === "up") ? fromIdx - 1 : fromIdx + 1;
    handleReorderOptions(fromIdx, toIdx);
  }


  // Live Ballot Preview Handlers
  function handleOpenPreview() {
    const validOpts = opts.filter(
      (o, idx) => o.label.trim().length > 0 || (!!o.imageUrl && o.imageUrl.trim().length > 0)
    );
    if (validOpts.length < 2) {
      setError(
        pollType === "image"
          ? "Please add at least 2 images or options to preview."
          : "Please provide at least 2 options with labels to preview."
      );
      return;
    }
    setError("");
    setPreviewSelectedIndices([]);
    setPreviewRankedOrder(opts.map((_, idx) => idx));
    setPreviewSubmitted(false);
    setShowPreviewModal(true);
  }

  function handlePreviewToggleOption(idx: number) {
    if (previewSubmitted) return;
    if (allowMultiple) {
      setPreviewSelectedIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      setPreviewSelectedIndices([idx]);
    }
  }

  function handlePreviewRankMove(fromIdx: number, direction: "up" | "down") {
    if (previewSubmitted) return;
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= previewRankedOrder.length) return;
    setPreviewRankedOrder((prev) => {
      const next = [...prev];
      const temp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = temp;
      return next;
    });
  }

  function handlePreviewSubmitVote() {
    setPreviewSubmitted(true);
    try { fireMotionSafeConfetti(); } catch {}
  }


  // Calculate final expiration in MS
  function computeExpiresInMs(): number | null {
    if (expiryPreset === null) return null;
    if (typeof expiryPreset === "number") return expiryPreset;
    if (expiryPreset === "custom") {
      const multipliers = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
      };
      return Math.max(1, customExpiryValue) * multipliers[customExpiryUnit];
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isPublic && !sessionUser) {
      setAuthModalMsg("Please sign in to publish this public poll.");
      setShowAuthModal(true);
      return;
    }

    const q = question.trim();
    if (!q) {
      setError("Please enter a question.");
      return;
    }

    const cleanOpts = opts
      .map((o, idx) => {
        const trimmedLabel = o.label.trim();
        const hasImage = !!o.imageUrl && o.imageUrl.trim().length > 0;
        // For Image Polls, if label is omitted, default to Option 1, Option 2, etc.
        const finalLabel = trimmedLabel || (hasImage ? `Option ${idx + 1}` : "");
        return {
          label: finalLabel,
          imageUrl: o.imageUrl.trim() || undefined,
        };
      })
      .filter((o) => o.label.length > 0 || !!o.imageUrl);

    if (cleanOpts.length < 2) {
      setError(
        pollType === "image"
          ? "Please add at least 2 images or options."
          : "Please provide at least 2 non-empty options."
      );
      return;
    }


    const finalCategory = isPublic
      ? (isAddingCustom ? customCategory.trim() : category) || "general"
      : "general";

    setSubmitting(true);

    try {
      // ── Fix 1.3: Client-side payload guard — prevents silent 413 error on Vercel ──
      const payload = JSON.stringify({
        question: q,
        description: description.trim() || undefined,
        pollType,
        category: finalCategory,
        isPublic,
        options: cleanOpts,
        allowMultiple: pollType === "standard" ? allowMultiple : false,
        minChoices: allowMultiple ? minChoices : 1,
        maxChoices: allowMultiple ? maxChoices : null,
        resultsVisibility,
        securityMode,
        allowVoteEdit: securityMode === "unlimited" ? false : allowVoteEdit,
        expiresInMs: computeExpiresInMs(),
        requireName,
        creatorName: !sessionUser ? guestCreatorName.trim() || undefined : undefined,
      });

      if (new Blob([payload]).size > 3_800_000) {
        setError("Your images are too large to submit (total exceeds ~3.8 MB). Please remove some images or reduce their size.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });


      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.requiresAuth) {
          setShowAuthModal(true);
        } else {
          setError(d.error ?? "Failed to create poll.");
        }
        setSubmitting(false);
        return;
      }

      const data = await res.json();


      // Store in localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("ballot:myPolls") ?? "[]");
        stored.push({
          slug: data.slug,
          question: q,
          createdAt: Date.now(),
          adminKey: data.adminKey,
        });
        localStorage.setItem("ballot:myPolls", JSON.stringify(stored));

        const adminKeys = JSON.parse(localStorage.getItem("ballot:adminKeys") ?? "{}");
        if (data.adminKey) {
          adminKeys[data.slug] = data.adminKey;
          localStorage.setItem("ballot:adminKeys", JSON.stringify(adminKeys));
        }
      } catch (e) {
        console.error("Failed to save to localStorage", e);
      }

      router.push(data.adminKey ? `/p/${data.slug}?key=${data.adminKey}&created=1` : `/p/${data.slug}?created=1`);
    } catch {
      setError("Could not create poll — check your connection.");
      setSubmitting(false);
    }
  }

  const selectedSecurityObj = SECURITY_MODES.find((s) => s.value === securityMode) || SECURITY_MODES[0];

  return (
    <div className="wrap">
      {/* Top Header */}
      <Navbar onUserChange={(u) => { setSessionUser(u); if (u) setIsPublic(true); }} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        initialMessage={authModalMsg}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(user) => {
          setSessionUser(user);
          setIsPublic(true);
        }}
      />

      <AdSidebarContainer>
        <main style={{ maxWidth: 680, margin: "0 auto", width: "100%", paddingBottom: 60 }}>
          {/* Header Row: Title on Left, Poll Settings Trigger on Right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Create new poll</div>
            <button
              type="button"
              onClick={() => setShowAdvanced(true)}
              className="btn-ghost"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.15s ease",
              }}
              title="Configure security, voter requirements, editing, deadline, and results visibility"
            >
              <Settings size={14} color="var(--accent)" />
              <span>Poll Settings</span>
            </button>
          </div>


          {/* 1. Poll Visibility & Category */}
          <div className="block" style={{ marginBottom: 18 }}>
            <label className="field-label" style={{ marginBottom: 6 }}>Poll Visibility</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className={`expiry-chip ${isPublic ? "active" : ""}`}
                onClick={handleSelectCommunity}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 13 }}
              >
                <Globe size={14} color={isPublic ? "var(--accent)" : "currentColor"} />
                <span>Public</span>
              </button>

              <button
                type="button"
                className={`expiry-chip ${!isPublic ? "active" : ""}`}
                onClick={() => setIsPublic(false)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 13 }}
              >
                <Lock size={14} color={!isPublic ? "var(--accent)" : "currentColor"} />
                <span>Private</span>
              </button>
            </div>

            {/* Dynamic Visibility Explanation */}
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Info size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span>
                {isPublic
                  ? "Public: Discoverable in Explore & community search. Requires sign-in to create."
                  : "Private: Unlisted direct link. Accessible only to people with the URL."}
              </span>
            </div>

            {/* Category Chips when Public */}
            {isPublic && (
              <div style={{ marginTop: 10 }}>
                <div className="expiry-row" style={{ flexWrap: "wrap", gap: 6 }}>
                  {PRESET_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      className={`expiry-chip ${!isAddingCustom && category === c.value ? "active" : ""}`}
                      onClick={() => { setCategory(c.value); setIsAddingCustom(false); }}
                      style={{ fontSize: 12, padding: "4px 10px" }}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`expiry-chip ${isAddingCustom ? "active" : ""}`}
                    onClick={() => setIsAddingCustom(true)}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    + Custom
                  </button>
                </div>

                {isAddingCustom && (
                  <div style={{ marginTop: 6 }}>
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Enter custom category (e.g. Design, BookClub)"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      autoFocus
                      style={{ fontSize: 12, padding: "5px 8px" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Poll Format */}
          <div className="block" style={{ marginBottom: 18 }}>
            <label className="field-label" style={{ marginBottom: 6 }}>Poll Format</label>
            <div className="expiry-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {POLL_TYPES.map((pt) => {
                const IconComp = pt.icon;
                const active = pollType === pt.value;
                return (
                  <button
                    type="button"
                    key={pt.value}
                    className={`expiry-chip ${active ? "active" : ""}`}
                    onClick={() => setPollType(pt.value)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 13 }}
                  >
                    <IconComp size={14} color={active ? "var(--accent)" : "currentColor"} />
                    <span>{pt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Format Explanation */}
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Info size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
              <span>
                {pollType === "standard" && "Standard: Single choice or multiple selections with standard vote counts."}
                {pollType === "ranked" && "Ranked Choice: Voters rank choices in order of preference (1st gets max points)."}
                {pollType === "image" && "Image Poll: Visual choices with image previews for each option."}
              </span>
            </div>
          </div>


          {/* 3. Question & Description */}
          <div className="block" style={{ marginBottom: 18 }}>
            <label className="field-label" htmlFor="q">
              Question <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <input
              id="q"
              type="text"
              maxLength={140}
              placeholder="What would you like to decide?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
              className="input-text"
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {!showDesc && (
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: 12 }}
                  onClick={() => setShowDesc(true)}
                >
                  + Add description / context notes
                </button>
              )}
              <span className="char-count" style={{ marginLeft: "auto" }}>{question.length}/140</span>
            </div>
          </div>

          {/* Optional Description */}
          {showDesc && (
            <div className="block" style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label className="field-label" htmlFor="desc" style={{ marginBottom: 0 }}>
                  Description / Context (Optional)
                </label>
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: 11, color: "var(--muted)" }}
                  onClick={() => { setShowDesc(false); setDescription(""); }}
                >
                  Remove
                </button>
              </div>
              <textarea
                id="desc"
                rows={2}
                maxLength={1000}
                placeholder="Provide additional context, guidelines, or decision background..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="char-count">{description.length}/1000</span>
            </div>
          )}

          {/* Guest Creator Attribution Name (Optional) */}
          {!sessionUser && (
            <div className="block" style={{ marginBottom: 18 }}>
              <label className="field-label" htmlFor="guestName">
                Your Name / Organization <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>(Optional)</span>
              </label>
              <input
                id="guestName"
                type="text"
                maxLength={80}
                placeholder="e.g. Alex, Team Design (or leave blank for Guest)"
                value={guestCreatorName}
                onChange={(e) => setGuestCreatorName(e.target.value)}
                className="input-text"
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Displayed below your question as &ldquo;Created by {guestCreatorName.trim() || "Guest"}&rdquo;.
              </div>
            </div>
          )}

          {/* 4. Options List & 3-Way Header */}
          <div className="block" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              {/* Left: Options Label */}
              <label className="field-label" style={{ marginBottom: 0 }}>
                Options <span style={{ color: "var(--accent)" }}>*</span>
              </label>

              {/* Middle: Single/Multiple Selection Toggle (Only for Standard Polls) */}
              {pollType === "standard" && (
                <div style={{ display: "inline-flex", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 6, padding: 2, gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => setAllowMultiple(false)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: !allowMultiple ? 700 : 500,
                      borderRadius: 4,
                      border: "none",
                      background: !allowMultiple ? "var(--surface)" : "transparent",
                      color: !allowMultiple ? "var(--accent-ink)" : "var(--muted)",
                      cursor: "pointer",
                      boxShadow: !allowMultiple ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowMultiple(true)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: allowMultiple ? 700 : 500,
                      borderRadius: 4,
                      border: "none",
                      background: allowMultiple ? "var(--surface)" : "transparent",
                      color: allowMultiple ? "var(--accent-ink)" : "var(--muted)",
                      cursor: "pointer",
                      boxShadow: allowMultiple ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Multiple
                  </button>
                </div>
              )}

              {/* Right: Bulk Action */}
              {pollType === "image" ? (
                <label
                  className="btn-ghost"
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    color: "var(--accent-ink)",
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    borderRadius: "var(--radius)",
                    fontWeight: 600,
                  }}
                  title="Select multiple images at once to auto-create options & labels"
                >
                  <UploadCloud size={14} />
                  <span>Bulk Upload</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleBulkImageUpload(e.target.files);
                      }
                    }}
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={() => setShowBulkModal(true)}
                >
                  <ClipboardPaste size={13} /> Bulk paste
                </button>
              )}
            </div>

            {/* If Multiple Choices is active, show Min/Max Pickers */}
            {pollType === "standard" && allowMultiple && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Min choices:</label>
                  <input
                    type="number"
                    min={1}
                    max={opts.length}
                    value={minChoices}
                    onChange={(e) => handleMinChoicesChange(parseInt(e.target.value) || 1)}
                    className="input-text"
                    style={{ width: 48, padding: "3px 6px", fontSize: 12 }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Max choices:</label>
                  <input
                    type="number"
                    min={minChoices}
                    max={opts.length}
                    value={maxChoices}
                    onChange={(e) => handleMaxChoicesChange(parseInt(e.target.value) || minChoices)}
                    className="input-text"
                    style={{ width: 48, padding: "3px 6px", fontSize: 12 }}
                  />
                </div>
              </div>
            )}

            {pollType === "image" ? (
              /* 🖼️ 3-COLUMN IMAGE POLL CREATION GRID (DRAGGABLE & REORDERABLE) */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {opts.map((opt, i) => {
                  const isBeingDragged = draggedOptIdx === i;
                  const isDragOver = dragOverOptIdx === i;

                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `${i}`);
                        setDraggedOptIdx(i);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverOptIdx !== i) setDragOverOptIdx(i);
                      }}
                      onDragLeave={() => {
                        if (dragOverOptIdx === i) setDragOverOptIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedOptIdx !== null && draggedOptIdx !== i) {
                          handleReorderOptions(draggedOptIdx, i);
                        }
                        setDraggedOptIdx(null);
                        setDragOverOptIdx(null);
                      }}
                      style={{
                        background: "var(--surface)",
                        border: isDragOver
                          ? "2px dashed var(--accent)"
                          : "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        position: "relative",
                        boxShadow: isDragOver ? "0 4px 12px rgba(15, 118, 110, 0.2)" : "var(--shadow-sm)",
                        opacity: isBeingDragged ? 0.4 : 1,
                        transition: "border 0.15s ease, box-shadow 0.15s ease",
                      }}
                    >
                      {/* Card Header: Reorder Grips, Index Badge, Shift Arrows + Delete */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "grab" }} title="Drag to reorder">
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>⠿</span>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: "var(--accent)" }}>
                            #{i + 1}
                          </span>
                        </div>

                        {/* Quick Shift Arrows & Remove */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleMoveOption(i, "prev")}
                            disabled={i === 0}
                            title="Move left"
                            aria-label={`Move option ${i + 1} left`}
                            style={{
                              width: 24,
                              height: 24,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              border: "1px solid var(--line)",
                              background: i === 0 ? "transparent" : "var(--paper)",
                              color: i === 0 ? "var(--faint)" : "var(--ink)",
                              borderRadius: 4,
                              cursor: i === 0 ? "not-allowed" : "pointer",
                              padding: 0
                            }}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOption(i, "next")}
                            disabled={i === opts.length - 1}
                            title="Move right"
                            aria-label={`Move option ${i + 1} right`}
                            style={{
                              width: 24,
                              height: 24,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              border: "1px solid var(--line)",
                              background: i === opts.length - 1 ? "transparent" : "var(--paper)",
                              color: i === opts.length - 1 ? "var(--faint)" : "var(--ink)",
                              borderRadius: 4,
                              cursor: i === opts.length - 1 ? "not-allowed" : "pointer",
                              padding: 0
                            }}
                          >
                            ▶
                          </button>
                          {opts.length > 2 && (
                            <button
                              type="button"
                              className="remove-opt-btn"
                              onClick={() => removeOpt(i)}
                              title="Remove option"
                              aria-label={`Remove option ${i + 1}`}
                              style={{ fontSize: 13, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                      </div>

                      {/* Image Dropzone / Preview */}
                      {opt.imageUrl ? (
                        <div style={{
                          position: "relative",
                          width: "100%",
                          height: 110,
                          borderRadius: 6,
                          overflow: "hidden",
                          border: "1px solid var(--line)",
                          background: "var(--paper)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <img
                            src={opt.imageUrl}
                            alt={`Option ${i + 1}`}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                          {/* Bottom Control Bar */}
                          <div style={{
                            position: "absolute",
                            bottom: 4,
                            left: 4,
                            right: 4,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 4
                          }}>
                            <label
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "var(--ink)",
                                background: "var(--surface)",
                                border: "1px solid var(--line)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                cursor: "pointer",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                              }}
                            >
                              Change
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleImageUpload(i, f);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => updateOptImage(i, "")}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: "#EF4444",
                                background: "var(--surface)",
                                border: "1px solid var(--line)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                cursor: "pointer",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label
                          style={{
                            width: "100%",
                            height: 110,
                            borderRadius: 6,
                            border: "2px dashed var(--line)",
                            background: "var(--paper)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            textAlign: "center",
                            padding: 4
                          }}
                        >
                          <Camera size={20} color="var(--muted)" />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-ink)" }}>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(i, f);
                            }}
                          />
                        </label>
                      )}

                      {/* Optional Text Label */}
                      <input
                        type="text"
                        maxLength={100}
                        placeholder={`Option ${i + 1}`}
                        value={opt.label}
                        onChange={(e) => updateOptLabel(i, e.target.value)}
                        className="input-text"
                        style={{ fontSize: 12, padding: "5px 8px" }}
                      />
                    </div>
                  );
                })}

                {/* Add Option Card in Grid */}
                {opts.length < 30 && (
                  <button
                    type="button"
                    onClick={addOpt}
                    style={{
                      minHeight: 160,
                      background: "var(--paper)",
                      border: "2px dashed var(--line)",
                      borderRadius: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      color: "var(--muted)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      padding: 8
                    }}
                  >
                    <Plus size={20} color="var(--accent)" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-ink)" }}>
                      + Add Image
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>
                      ({opts.length}/30)
                    </span>
                  </button>
                )}
              </div>
            ) : (
              /* 📋 STANDARD & RANKED CHOICE VERTICAL LIST STACK (DRAGGABLE & REORDERABLE) */
              <div className="options-stack">
                {opts.map((opt, i) => {
                  const isBeingDragged = draggedOptIdx === i;
                  const isDragOver = dragOverOptIdx === i;

                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `${i}`);
                        setDraggedOptIdx(i);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverOptIdx !== i) setDragOverOptIdx(i);
                      }}
                      onDragLeave={() => {
                        if (dragOverOptIdx === i) setDragOverOptIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedOptIdx !== null && draggedOptIdx !== i) {
                          handleReorderOptions(draggedOptIdx, i);
                        }
                        setDraggedOptIdx(null);
                        setDragOverOptIdx(null);
                      }}
                      className="option-row"
                      style={{
                        opacity: isBeingDragged ? 0.4 : 1,
                        border: isDragOver ? "2px dashed var(--accent)" : undefined,
                        transition: "border 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "grab" }} title="Drag to reorder">
                        <GripVertical size={14} color="var(--muted)" />
                        <span className="drag-handle">{i + 1}</span>
                      </div>

                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          type="text"
                          maxLength={100}
                          placeholder={`Option ${i + 1}`}
                          value={opt.label}
                          onChange={(e) => updateOptLabel(i, e.target.value)}
                          className="input-text"
                        />
                      </div>

                      {/* Shift Up/Down buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => handleMoveOption(i, "up")}
                          disabled={i === 0}
                          title="Move up"
                          aria-label={`Move option ${i + 1} up`}
                          style={{
                            width: 24,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            border: "1px solid var(--line)",
                            background: i === 0 ? "transparent" : "var(--paper)",
                            color: i === 0 ? "var(--faint)" : "var(--ink)",
                            borderRadius: 3,
                            cursor: i === 0 ? "not-allowed" : "pointer",
                            padding: 0
                          }}
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOption(i, "down")}
                          disabled={i === opts.length - 1}
                          title="Move down"
                          aria-label={`Move option ${i + 1} down`}
                          style={{
                            width: 24,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            border: "1px solid var(--line)",
                            background: i === opts.length - 1 ? "transparent" : "var(--paper)",
                            color: i === opts.length - 1 ? "var(--faint)" : "var(--ink)",
                            borderRadius: 3,
                            cursor: i === opts.length - 1 ? "not-allowed" : "pointer",
                            padding: 0
                          }}
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {opts.length > 2 && (
                        <button
                          type="button"
                          className="remove-opt-btn"
                          onClick={() => removeOpt(i)}
                          title="Remove option"
                          aria-label={`Remove option ${i + 1}`}
                          style={{ fontSize: 13, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {opts.length < 30 && (
                  <button type="button" className="add-opt" onClick={addOpt}>
                    + Add option ({opts.length}/30)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Action Buttons: Preview Ballot & Publish */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12, marginTop: 28, marginBottom: 40 }}>
            <button
              type="button"
              onClick={handleOpenPreview}
              className="btn-ghost"
              style={{
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
              title="Test and preview the live ballot before creating"
            >
              <Eye size={16} color="var(--accent)" />
              <span>Preview Ballot</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
              style={{ padding: "12px 20px", fontSize: 15, fontWeight: 700 }}
            >
              {submitting ? "Creating poll..." : isPublic ? "Publish Public Poll →" : "Create Private Poll →"}
            </button>

          </div>

          {/* ⚙️ Advanced Poll Settings Modal Popup (Zero-Scroll Compact Layout) */}
          {showAdvanced && (

            <div className="modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setShowAdvanced(false)}>
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                  maxWidth: 560,
                  width: "100%",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {/* Modal Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Settings size={16} color="var(--accent)" />
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>Poll Settings</h2>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Configure security, voter requirements, deadline, and results visibility.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setShowAdvanced(false)}
                    style={{ fontSize: 18, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Close settings modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 1. Security & Anti-Abuse */}
                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Security & Duplicate Protection</label>
                  <div className="expiry-row" style={{ gap: 6, marginBottom: 6 }}>
                    {SECURITY_MODES.map((sc) => (
                      <button
                        type="button"
                        key={sc.value}
                        className={`expiry-chip ${securityMode === sc.value ? "active" : ""}`}
                        onClick={() => {
                          setSecurityMode(sc.value);
                          if (sc.value === "unlimited") {
                            setAllowVoteEdit(false);
                          }
                        }}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                  {/* User-friendly info box */}
                  <div style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 11,
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    lineHeight: 1.35
                  }}>
                    <Info size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong style={{ color: "var(--ink)" }}>{selectedSecurityObj.label} Mode:</strong> {selectedSecurityObj.desc}
                    </div>
                  </div>
                </div>

                {/* 2. Voter Controls (2-Column Side-by-Side Toggles) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Require Voter Name Toggle */}
                  <div
                    onClick={() => setRequireName(!requireName)}
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                        Require Voter Name
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.2 }}>
                        {requireName ? "Voters must provide name" : "Voting is anonymous"}
                      </div>
                    </div>
                    <div style={{
                      width: 32,
                      height: 18,
                      borderRadius: 10,
                      background: requireName ? "var(--accent)" : "var(--line)",
                      position: "relative",
                      transition: "background 0.15s ease",
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: 2,
                        left: requireName ? 16 : 2,
                        transition: "left 0.15s ease"
                      }} />
                    </div>
                  </div>

                  {/* Allow Vote Editing Toggle */}
                  <div
                    onClick={() => {
                      if (securityMode !== "unlimited") {
                        setAllowVoteEdit(!allowVoteEdit);
                      }
                    }}
                    style={{
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: securityMode === "unlimited" ? "not-allowed" : "pointer",
                      opacity: securityMode === "unlimited" ? 0.6 : 1,
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                        Allow Voter Editing
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.2 }}>
                        {allowVoteEdit && securityMode !== "unlimited" ? "Voters can change vote" : "Locked once submitted"}
                      </div>
                    </div>
                    <div style={{
                      width: 32,
                      height: 18,
                      borderRadius: 10,
                      background: (allowVoteEdit && securityMode !== "unlimited") ? "var(--accent)" : "var(--line)",
                      position: "relative",
                      transition: "background 0.15s ease",
                      flexShrink: 0
                    }}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#FFFFFF",
                        position: "absolute",
                        top: 2,
                        left: (allowVoteEdit && securityMode !== "unlimited") ? 16 : 2,
                        transition: "left 0.15s ease"
                      }} />
                    </div>
                  </div>
                </div>

                {/* 3. Deadline & Results Visibility Dropdowns (2-Column Grid) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Poll Deadline Dropdown */}
                  <div>
                    <label className="field-label" style={{ marginBottom: 6 }}>Poll Deadline</label>
                    <select
                      value={expiryPreset === "custom" ? "custom" : expiryPreset === null ? "none" : `${expiryPreset}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "none") setExpiryPreset(null);
                        else if (val === "custom") setExpiryPreset("custom");
                        else setExpiryPreset(parseInt(val, 10));
                      }}
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: "var(--paper)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="none">No limit (Never expires)</option>
                      <option value="3600000">1 hour</option>
                      <option value="86400000">24 hours</option>
                      <option value="604800000">7 days</option>
                      <option value="2592000000">30 days</option>
                      <option value="custom">Custom duration...</option>
                    </select>

                    {expiryPreset === "custom" && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--paper)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", marginTop: 6 }}>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={customExpiryValue}
                          onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                          className="input-text"
                          style={{ width: 60, padding: "4px 8px", fontSize: 12 }}
                        />
                        <select
                          value={customExpiryUnit}
                          onChange={(e) => setCustomExpiryUnit(e.target.value as any)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            borderRadius: 4,
                            border: "1px solid var(--line)",
                            background: "var(--surface)",
                            color: "var(--ink)",
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Results Visibility Dropdown */}
                  <div>
                    <label className="field-label" style={{ marginBottom: 6 }}>Results Visibility</label>
                    <select
                      value={resultsVisibility}
                      onChange={(e) => setResultsVisibility(e.target.value)}
                      style={{
                        width: "100%",
                        height: 38,
                        padding: "0 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        background: "var(--paper)",
                        color: "var(--ink)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="after_vote">After voting (Instant results)</option>
                      <option value="after_deadline">After deadline (Hidden)</option>
                      <option value="creator_only">Creator only (Admin only)</option>
                    </select>
                  </div>
                </div>

                {/* Modal Footer: Done Button */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowAdvanced(false)}
                    style={{ padding: "7px 20px", fontSize: 13, fontWeight: 700 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}




        {/* 👁️ Interactive Live Ballot Preview Modal */}
        {showPreviewModal && (
          <div className="modal-backdrop" style={{ zIndex: 1000 }}>
            <div className="modal-box" style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}>
              {/* Modal Top Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Eye size={17} color="var(--accent)" />
                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Live Voter Ballot Preview</h2>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent-soft)", border: "1px solid var(--accent)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                      PREVIEW MODE
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    This is an interactive simulation of what voters will experience.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowPreviewModal(false)}
                  style={{ fontSize: 18, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Ballot Card Content */}
              <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
                {/* Meta Pills */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                  <span className="badge-category">
                    {isPublic ? (isAddingCustom ? customCategory || "custom" : category) : "private"}
                  </span>
                  {pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
                  {pollType === "image" && <span className="badge-type">Image Poll</span>}
                  {pollType === "standard" && (
                    <span className="badge-type">
                      {allowMultiple ? `Multiple (${minChoices}-${maxChoices})` : "Single choice"}
                    </span>
                  )}
                </div>

                {/* Question */}
                <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "var(--ink)", marginBottom: 6 }}>
                  {question.trim() || "What would you like to decide?"}
                </h1>

                {/* Description */}
                {description.trim() && (
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
                    {description.trim()}
                  </p>
                )}

                {/* Creator Attribution */}
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                  Created by @{sessionUser?.username || "creator"}
                </div>

                {/* Interactive Voter Options */}
                {pollType === "ranked_choice" ? (
                  /* 1. Ranked Choice Interactive Order */
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={13} color="var(--accent)" />
                      <span>Drag or use arrows to test ranking choices (1st gets max points):</span>
                    </div>
                    {previewRankedOrder.map((optIdx, i) => {
                      const opt = opts[optIdx];
                      const labelText = opt?.label.trim() || `Option ${optIdx + 1}`;
                      if (!opt || (!opt.label.trim() && !opt.imageUrl)) return null;
                      const pointsForThisRank = Math.max(1, previewRankedOrder.length - i);

                      return (
                        <div
                          key={`ranked-prev-${optIdx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--line)",
                            background: "var(--paper)",
                            fontSize: 14,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
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
                              <img src={opt.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                            )}
                            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                              {labelText}
                            </span>
                          </div>

                          {/* Side-by-Side Up & Down Arrows */}
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handlePreviewRankMove(i, "up")}
                              disabled={i === 0 || previewSubmitted}
                              style={{
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 4,
                                border: "1px solid var(--line)",
                                background: i === 0 ? "transparent" : "var(--surface)",
                                color: i === 0 ? "var(--faint)" : "#10B981",
                                cursor: i === 0 ? "not-allowed" : "pointer",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePreviewRankMove(i, "down")}
                              disabled={i === previewRankedOrder.length - 1 || previewSubmitted}
                              style={{
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 4,
                                border: "1px solid var(--line)",
                                background: i === previewRankedOrder.length - 1 ? "transparent" : "var(--surface)",
                                color: i === previewRankedOrder.length - 1 ? "var(--faint)" : "#EF4444",
                                cursor: i === previewRankedOrder.length - 1 ? "not-allowed" : "pointer",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : pollType === "image" ? (
                  /* 2. Image Poll Interactive 3-Column Gallery Grid */
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {opts.map((opt, idx) => {
                      const labelText = opt.label.trim() || `Option ${idx + 1}`;
                      if (!opt.label.trim() && !opt.imageUrl) return null;
                      const isSelected = previewSelectedIndices.includes(idx);

                      return (
                        <div
                          key={`img-prev-${idx}`}
                          onClick={() => handlePreviewToggleOption(idx)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                            cursor: previewSubmitted ? "default" : "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: isSelected ? "0 4px 12px rgba(15, 118, 110, 0.15)" : "none",
                          }}
                        >
                          {/* Image Box */}
                          <div style={{ width: "100%", height: 110, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--line)", overflow: "hidden" }}>
                            {opt.imageUrl ? (
                              <img src={opt.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            ) : (
                              <ImageIcon size={24} color="var(--muted)" />
                            )}
                          </div>

                          {/* Bottom Caption & Selection Indicator */}
                          <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {labelText}
                            </span>
                            <div style={{
                              width: 16,
                              height: 16,
                              minWidth: 16,
                              borderRadius: allowMultiple ? 4 : "50%",
                              border: isSelected ? "2px solid var(--accent)" : "2px solid var(--muted)",
                              background: isSelected ? "var(--accent)" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#FFFFFF",
                              fontSize: 9,
                              fontWeight: 700,
                            }}>
                              {isSelected && (allowMultiple ? <Check size={10} strokeWidth={3} /> : "●")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                ) : (
                  /* 3. Standard Choice List */
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {opts.map((opt, idx) => {
                      if (!opt.label.trim()) return null;
                      const isSelected = previewSelectedIndices.includes(idx);

                      return (
                        <div
                          key={`opt-prev-${idx}`}
                          onClick={() => handlePreviewToggleOption(idx)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "var(--radius)",
                            border: isSelected ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                            cursor: previewSubmitted ? "default" : "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? "var(--accent-ink)" : "var(--ink)", fontSize: 14 }}>
                              {opt.label}
                            </span>
                          </div>

                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: allowMultiple ? 4 : "50%",
                            border: isSelected ? "2px solid var(--accent)" : "2px solid var(--muted)",
                            background: isSelected ? "var(--accent)" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#FFFFFF",
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            {isSelected && (allowMultiple ? <Check size={12} strokeWidth={3} /> : "●")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}


                {/* Preview Mock Submit Button */}
                {previewSubmitted ? (
                  <div style={{
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent)",
                    padding: "12px",
                    borderRadius: 8,
                    textAlign: "center",
                    color: "var(--accent-ink)",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}>
                    <CheckCircle2 size={16} color="var(--accent)" />
                    <span>Vote Simulation Successful! Ready to publish.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePreviewSubmitVote}
                    className="btn-primary"
                    style={{ width: "100%", padding: "12px", fontSize: 14, marginBottom: 8 }}
                  >
                    {pollType === "ranked_choice" ? "Submit Ranked Order →" : "Submit Vote →"}
                  </button>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowPreviewModal(false)}
                  style={{ fontSize: 13 }}
                >
                  ← Back to Editing
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    setShowPreviewModal(false);
                    handleSubmit(e);
                  }}
                  disabled={submitting}
                  className="btn-primary"
                  style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span>{submitting ? "Publishing..." : "Looks Good, Publish Poll"}</span>
                  {!submitting && <ArrowRight size={14} />}
                </button>

              </div>
            </div>
          </div>
        )}

        {/* Bulk Paste Modal */}
        {showBulkModal && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Paste Multiple Options</h2>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowBulkModal(false)}
                  style={{ fontSize: 18, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={18} />
                </button>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Paste one option per line. Leading numbers, dashes, and bullet points will be stripped automatically:
              </p>
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Option 1\nOption 2\nOption 3\nOption 4"}
                style={{
                  width: "100%",
                  fontFamily: "monospace",
                  fontSize: 13,
                  marginBottom: 16,
                  padding: "10px 12px",
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  color: "var(--ink)"
                }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApplyBulkPaste}
                >
                  Apply Options
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      </AdSidebarContainer>
    </div>
  );
}


