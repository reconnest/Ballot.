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
  },
  {
    value: "ranked_choice",
    label: "Ranked Choice (Points)",
    hint: "Voters rank choices in order of preference (1st gets max points)",
  },
  {
    value: "image",
    label: "Image Poll",
    hint: "Include image previews with each choice",
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
      } catch {}
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
  function handleImageUpload(i: number, file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP, GIF).");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          updateOptImage(i, compressed);
        } else {
          updateOptImage(i, result);
        }
      };
      img.onerror = () => {
        updateOptImage(i, result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
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

    const processFile = (file: File): Promise<{ label: string; imageUrl: string }> => {
      return new Promise((resolve) => {
        const label = formatFileNameToLabel(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (!result) {
            resolve({ label, imageUrl: "" });
            return;
          }
          const img = new Image();
          img.onload = () => {
            const maxDim = 800;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL("image/jpeg", 0.85);
              resolve({ label, imageUrl: compressed });
            } else {
              resolve({ label, imageUrl: result });
            }
          };
          img.onerror = () => {
            resolve({ label, imageUrl: result });
          };
          img.src = result;
        };
        reader.readAsDataURL(file);
      });
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
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          allowVoteEdit,
          expiresInMs: computeExpiresInMs(),
          requireName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresAuth) {
          setShowAuthModal(true);
        } else {
          setError(data.error ?? "Could not create poll.");
        }
        setSubmitting(false);
        return;
      }

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

      router.push(`/p/${data.slug}?created=1`);
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

      <main>
        <div className="section-label">Create new poll</div>

        {/* Poll Format (3-Column Row) */}
        <div className="block" style={{ marginBottom: 32 }}>
          <label className="field-label">Poll Format</label>
          <div className="format-grid-3">
            {POLL_TYPES.map((pt) => (
              <button
                type="button"
                key={pt.value}
                className={`visibility-card ${pollType === pt.value ? "active" : ""}`}
                onClick={() => setPollType(pt.value)}
              >
                <div className="vis-title">{pt.label}</div>
                <div className="vis-hint">{pt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Split-Screen Desktop Creator Grid */}
        <div className="creator-grid">
          {/* Left Column: Question, Description & Options */}
          <div>
            {/* Question */}
            <div className="block">
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
              <div className="block">
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

            {/* Options */}
            <div className="block">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>
                  Options <span style={{ color: "var(--accent)" }}>*</span>
                </label>
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
                    <span>📁 Bulk Upload Images</span>
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
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "3px 8px" }}
                    onClick={() => setShowBulkModal(true)}
                  >
                    ⚡ Bulk paste
                  </button>
                )}
              </div>

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
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(i, "prev")}
                              disabled={i === 0}
                              title="Move left"
                              style={{
                                width: 18,
                                height: 18,
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
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOption(i, "next")}
                              disabled={i === opts.length - 1}
                              title="Move right"
                              style={{
                                width: 18,
                                height: 18,
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
                              ▶
                            </button>
                            {opts.length > 2 && (
                              <button
                                type="button"
                                className="remove-opt-btn"
                                onClick={() => removeOpt(i)}
                                title="Remove option"
                                style={{ fontSize: 11, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}
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
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                                }}
                              >
                                ✕
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
                              gap: 4,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              textAlign: "center",
                              padding: 4
                            }}
                          >
                            <span style={{ fontSize: 20 }}>📷</span>
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
                      <span style={{ fontSize: 20 }}>➕</span>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "grab" }} title="Drag to reorder">
                          <span style={{ color: "var(--muted)", fontSize: 13 }}>⠿</span>
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
                            style={{
                              width: 22,
                              height: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              border: "1px solid var(--line)",
                              background: i === 0 ? "transparent" : "var(--paper)",
                              color: i === 0 ? "var(--faint)" : "var(--ink)",
                              borderRadius: 3,
                              cursor: i === 0 ? "not-allowed" : "pointer",
                              padding: 0
                            }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOption(i, "down")}
                            disabled={i === opts.length - 1}
                            title="Move down"
                            style={{
                              width: 22,
                              height: 14,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 8,
                              border: "1px solid var(--line)",
                              background: i === opts.length - 1 ? "transparent" : "var(--paper)",
                              color: i === opts.length - 1 ? "var(--faint)" : "var(--ink)",
                              borderRadius: 3,
                              cursor: i === opts.length - 1 ? "not-allowed" : "pointer",
                              padding: 0
                            }}
                          >
                            ▼
                          </button>
                        </div>

                        {opts.length > 2 && (
                          <button
                            type="button"
                            className="remove-opt-btn"
                            onClick={() => removeOpt(i)}
                            title="Remove option"
                          >
                            ✕
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
          </div>



          {/* Right Column: Visibility, Category, Mode & Advanced Settings */}
          <div>
            {/* Top Requirement: Discovery & Directory */}
            <div className="block">
              <label className="field-label">Poll Visibility</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Public Community */}
                <button
                  type="button"
                  className={`visibility-card ${isPublic ? "active" : ""}`}
                  onClick={handleSelectCommunity}
                  style={{ padding: "14px 16px", textAlign: "left" }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
                    🌐 Public Poll
                  </div>
                  <div className="vis-hint" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Discoverable in Explore. Requires sign in.
                  </div>
                </button>

                {/* Private Poll */}
                <button
                  type="button"
                  className={`visibility-card ${!isPublic ? "active" : ""}`}
                  onClick={() => setIsPublic(false)}
                  style={{ padding: "14px 16px", textAlign: "left" }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
                    🔒 Private Poll
                  </div>
                  <div className="vis-hint" style={{ fontSize: 12, lineHeight: 1.4 }}>
                    Direct link only. No sign in required.
                  </div>
                </button>
              </div>
            </div>

            {/* Category: Only for Public Community Polls */}
            {isPublic && (
              <div className="block">
                <label className="field-label">Community Category</label>
                <div className="expiry-row" style={{ marginBottom: 10 }}>
                  {PRESET_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      className={`expiry-chip ${!isAddingCustom && category === c.value ? "active" : ""}`}
                      onClick={() => { setCategory(c.value); setIsAddingCustom(false); }}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`expiry-chip ${isAddingCustom ? "active" : ""}`}
                    onClick={() => setIsAddingCustom(true)}
                  >
                    + Custom
                  </button>
                </div>

                {isAddingCustom && (
                  <div>
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Enter custom category (e.g. Design, BookClub)"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      autoFocus
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Voting Mode: Single vs Multi (Only for Standard Polls) */}
            {pollType === "standard" && (
              <div className="block">
                <label className="field-label">Voting Mode</label>
                <div className="expiry-row">
                  <button
                    type="button"
                    className={`expiry-chip ${!allowMultiple ? "active" : ""}`}
                    onClick={() => setAllowMultiple(false)}
                  >
                    Single choice
                  </button>
                  <button
                    type="button"
                    className={`expiry-chip ${allowMultiple ? "active" : ""}`}
                    onClick={() => setAllowMultiple(true)}
                  >
                    Multiple selections
                  </button>
                </div>

                {allowMultiple && (
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Min Choices
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={opts.length}
                        value={minChoices}
                        onChange={(e) => handleMinChoicesChange(parseInt(e.target.value) || 1)}
                        className="input-text"
                        style={{ padding: "8px 10px", fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                        Max Choices (Uniform: {minChoices})
                      </label>
                      <input
                        type="number"
                        min={minChoices}
                        max={opts.length}
                        value={maxChoices}
                        onChange={(e) => handleMaxChoicesChange(parseInt(e.target.value) || minChoices)}
                        className="input-text"
                        style={{ padding: "8px 10px", fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Voter Vote Editing Toggle */}
            <div className="block">
              <label className="field-label">Voter Editing</label>
              <div
                onClick={() => setAllowVoteEdit(!allowVoteEdit)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer"
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    Allow voters to change their vote
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Voters can update their selection while the poll is live.
                  </div>
                </div>
                <div style={{
                  width: 36,
                  height: 20,
                  borderRadius: 12,
                  background: allowVoteEdit ? "var(--accent)" : "var(--line)",
                  position: "relative",
                  transition: "background 0.15s ease"
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    position: "absolute",
                    top: 2,
                    left: allowVoteEdit ? 18 : 2,
                    transition: "left 0.15s ease"
                  }} />
                </div>
              </div>
            </div>

            {/* Advanced Settings Drawer */}
            <div className="block">
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", justifyContent: "space-between", display: "flex", fontSize: 13 }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>⚙️ More Settings (Deadline, Security, Results)</span>
                <span>{showAdvanced ? "▲" : "▼"}</span>
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* 1. Poll Deadline & Custom Duration */}
                  <div>
                    <label className="field-label">Poll Deadline</label>
                    <div className="expiry-row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {EXPIRY_PRESETS.map((choice) => (
                        <button
                          type="button"
                          key={choice.label}
                          className={`expiry-chip ${expiryPreset === choice.ms ? "active" : ""}`}
                          onClick={() => setExpiryPreset(choice.ms)}
                        >
                          {choice.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`expiry-chip ${expiryPreset === "custom" ? "active" : ""}`}
                        onClick={() => setExpiryPreset("custom")}
                      >
                        + Custom
                      </button>
                    </div>

                    {expiryPreset === "custom" && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--paper)", padding: "10px", borderRadius: 8, border: "1px solid var(--line)" }}>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={customExpiryValue}
                          onChange={(e) => setCustomExpiryValue(Math.max(1, parseInt(e.target.value) || 1))}
                          className="input-text"
                          style={{ width: 80, padding: "6px 10px", fontSize: 13 }}
                        />
                        <select
                          value={customExpiryUnit}
                          onChange={(e) => setCustomExpiryUnit(e.target.value as any)}
                          style={{
                            padding: "6px 10px",
                            fontSize: 13,
                            borderRadius: 6,
                            border: "1px solid var(--line)",
                            background: "var(--surface)",
                            color: "var(--ink)",
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>from creation</span>
                      </div>
                    )}
                  </div>

                  {/* 2. Results Visibility (Clean 3 Choices) */}
                  <div>
                    <label className="field-label">Results Visibility</label>
                    <div className="expiry-row" style={{ flexWrap: "wrap", gap: 6 }}>
                      {VISIBILITY_CHOICES.map((vc) => (
                        <button
                          type="button"
                          key={vc.value}
                          className={`expiry-chip ${resultsVisibility === vc.value ? "active" : ""}`}
                          onClick={() => setResultsVisibility(vc.value)}
                        >
                          {vc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Security & Anti-Abuse with Info Tooltip */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <label className="field-label" style={{ marginBottom: 0 }}>Security & Duplicate Protection</label>
                    </div>
                    <div className="expiry-row" style={{ gap: 6, marginBottom: 8 }}>
                      {SECURITY_MODES.map((sc) => (
                        <button
                          type="button"
                          key={sc.value}
                          className={`expiry-chip ${securityMode === sc.value ? "active" : ""}`}
                          onClick={() => setSecurityMode(sc.value)}
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
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      lineHeight: 1.4
                    }}>
                      <span style={{ fontSize: 14 }}>ℹ️</span>
                      <div>
                        <strong style={{ color: "var(--ink)" }}>{selectedSecurityObj.label} Mode:</strong> {selectedSecurityObj.desc}
                      </div>
                    </div>
                  </div>

                  {/* 4. Require Name */}
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={requireName}
                      onChange={(e) => setRequireName(e.target.checked)}
                    />
                    <span>Require voter name before submitting</span>
                  </label>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && <div className="error-box">{error}</div>}

            {/* Action Buttons: Preview Ballot & Publish */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="btn-ghost"
                style={{
                  padding: "12px 18px",
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
                <span>👁️</span>
                <span>Preview Ballot</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary"
                style={{ width: "100%", padding: "12px 20px", fontSize: 15, fontWeight: 700 }}
              >
                {submitting ? "Creating poll..." : isPublic ? "Publish Public Poll →" : "Create Private Poll →"}
              </button>
            </div>
          </div>
        </div>

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
                    <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>👁️ Live Voter Ballot Preview</h2>
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
                  style={{ fontSize: 18, color: "var(--muted)", cursor: "pointer" }}
                >
                  ✕
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
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                      💡 Drag or use ▲ / ▼ to test ranking choices (1st gets max points):
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
                              ▲
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
                              ▼
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
                              <span style={{ fontSize: 24 }}>🖼️</span>
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
                              {isSelected && (allowMultiple ? "✓" : "●")}
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
                            {isSelected && (allowMultiple ? "✓" : "●")}
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
                    marginBottom: 8
                  }}>
                    🎉 Vote Simulation Successful! Ready to publish.
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
                  style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700 }}
                >
                  {submitting ? "Publishing..." : "🚀 Looks Good, Publish Poll →"}
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
                  style={{ fontSize: 18, color: "var(--muted)" }}
                >
                  ✕
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
    </div>
  );
}

