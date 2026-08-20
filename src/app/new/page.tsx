"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";
import { AuthModal } from "@/components/AuthModal";

const EXPIRY_CHOICES = [
  { label: "No limit", ms: null },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

const VISIBILITY_CHOICES = [
  { value: "always_public", label: "Always public", hint: "Anyone can view live results anytime" },
  { value: "after_vote", label: "After voting", hint: "Voters see results only after casting their vote" },
  { value: "after_deadline", label: "After deadline", hint: "Results stay hidden until the poll closes" },
  { value: "creator_only", label: "Creator only", hint: "Only you (with your secret key) can see results" },
];

const SECURITY_CHOICES = [
  { value: "standard", label: "Standard (Cookie + IP)", hint: "Balances anti-stuffing protection with shared network flexibility" },
  { value: "relaxed", label: "Relaxed (Cookie only)", hint: "Ideal for campuses, offices & events sharing one Wi-Fi IP" },
  { value: "strict", label: "Strict (Bot Defense)", hint: "Enforces verification challenge to block automated bots" },
];

const POLL_TYPES = [
  { value: "standard", label: "Standard Poll", hint: "Single choice or multiple selections" },
  { value: "ranked_choice", label: "Ranked Choice (IRV)", hint: "Voters rank choices in order of preference" },
  { value: "image", label: "Image Poll", hint: "Include image previews with each choice" },
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
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMsg, setAuthModalMsg] = useState("");

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [pollType, setPollType] = useState("standard");
  const [category, setCategory] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isPublic, setIsPublic] = useState(false); // Default to Private (BPP) for zero friction
  const [opts, setOpts] = useState<{ label: string; imageUrl: string }[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [minChoices, setMinChoices] = useState(1);
  const [maxChoices, setMaxChoices] = useState<number | "">("");
  const [resultsVisibility, setResultsVisibility] = useState("always_public");
  const [securityMode, setSecurityMode] = useState("relaxed");
  const [allowVoteEdit, setAllowVoteEdit] = useState(true); // Locked spec: Default ON
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [requireName, setRequireName] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setSessionUser(data.user);
            setIsPublic(true); // If already logged in, default to Community
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Verification check for Public Community Polls
    if (isPublic && !sessionUser) {
      setAuthModalMsg("Please log in to publish this community poll.");
      setShowAuthModal(true);
      return;
    }

    const q = question.trim();
    if (!q) {
      setError("Please enter a question.");
      return;
    }

    const cleanOpts = opts
      .map((o) => ({
        label: o.label.trim(),
        imageUrl: o.imageUrl.trim() || undefined,
      }))
      .filter((o) => o.label.length > 0);

    if (cleanOpts.length < 2) {
      setError("Please provide at least 2 non-empty options.");
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
          minChoices: allowMultiple ? Math.max(1, minChoices) : 1,
          maxChoices: allowMultiple && typeof maxChoices === "number" ? maxChoices : null,
          resultsVisibility,
          securityMode,
          allowVoteEdit,
          expiresInMs: expiryMs,
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

        // Store admin keys dictionary
        const adminKeys = JSON.parse(localStorage.getItem("ballot:adminKeys") ?? "{}");
        if (data.adminKey) {
          adminKeys[data.slug] = data.adminKey;
          localStorage.setItem("ballot:adminKeys", JSON.stringify(adminKeys));
        }
      } catch (e) {
        console.error("Failed to save to localStorage", e);
      }

      // Navigate to poll
      router.push(`/p/${data.slug}?created=1`);
    } catch {
      setError("Could not create poll — check your connection.");
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap">
      {/* Top Header */}
      <header className="top">
        <Link href="/" style={{ textDecoration: "none" }}>
          <BallotLogo size={32} />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>Explore</Link>
          <ThemeToggle />
          {sessionUser ? (
            <Link
              href={`/u/${sessionUser.username}`}
              className="btn-ghost"
              style={{ fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>👤</span> @{sessionUser.username}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { setAuthModalMsg("Sign in to manage your creator profile."); setShowAuthModal(true); }}
              className="btn-ghost"
              style={{ fontSize: 13 }}
            >
              Sign in
            </button>
          )}
        </div>
      </header>

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

        {/* Poll Format (Single Horizontal 3-Column Row) */}
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
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "3px 8px" }}
                  onClick={() => setShowBulkModal(true)}
                >
                  ⚡ Bulk paste
                </button>
              </div>

              <div className="options-stack">
                {opts.map((opt, i) => (
                  <div key={i} className="option-row">
                    <span className="drag-handle">{i + 1}</span>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <input
                        type="text"
                        maxLength={100}
                        placeholder={`Option ${i + 1}`}
                        value={opt.label}
                        onChange={(e) => updateOptLabel(i, e.target.value)}
                        className="input-text"
                      />
                      {pollType === "image" && (
                        <input
                          type="url"
                          placeholder="Image URL (https://...)"
                          value={opt.imageUrl}
                          onChange={(e) => updateOptImage(i, e.target.value)}
                          style={{ fontSize: 12, padding: "6px 10px" }}
                        />
                      )}
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
                ))}

                {opts.length < 30 && (
                  <button type="button" className="add-opt" onClick={addOpt}>
                    + Add option ({opts.length}/30)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Visibility, Category, Mode & Advanced Settings */}
          <div>
            {/* Top Requirement: Discovery & Directory (BPC Community vs BPP Private) */}
            <div className="block">
              <label className="field-label">Poll Type & Visibility</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Community BPC */}
                <button
                  type="button"
                  className={`visibility-card ${isPublic ? "active" : ""}`}
                  onClick={handleSelectCommunity}
                  style={{ padding: "14px 16px", textAlign: "left" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🌐 Community (BPC)</span>
                    <span style={{ fontSize: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                      EXPLORE
                    </span>
                  </div>
                  <div className="vis-hint" style={{ fontSize: 12 }}>
                    Public & listed in Explore feed. Requires creator account.
                  </div>
                </button>

                {/* Private BPP */}
                <button
                  type="button"
                  className={`visibility-card ${!isPublic ? "active" : ""}`}
                  onClick={() => setIsPublic(false)}
                  style={{ padding: "14px 16px", textAlign: "left" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🔒 Private (BPP)</span>
                    <span style={{ fontSize: 10, background: "var(--line)", color: "var(--muted)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                      UNLISTED
                    </span>
                  </div>
                  <div className="vis-hint" style={{ fontSize: 12 }}>
                    Secret link only. No account required.
                  </div>
                </button>
              </div>
            </div>

            {/* Category: Only for Community Polls */}
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
                  <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Min Choices</label>
                      <input
                        type="number"
                        min={1}
                        max={opts.length}
                        value={minChoices}
                        onChange={(e) => setMinChoices(parseInt(e.target.value) || 1)}
                        style={{ padding: "6px 8px", fontSize: 13 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 3 }}>Max Choices (Optional)</label>
                      <input
                        type="number"
                        min={minChoices}
                        max={opts.length}
                        placeholder="No limit"
                        value={maxChoices}
                        onChange={(e) => setMaxChoices(e.target.value ? parseInt(e.target.value) : "")}
                        style={{ padding: "6px 8px", fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Voter Vote Editing Toggle (Locked Spec) */}
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
                <span>⚙️ More Settings (Deadline, Results Visibility)</span>
                <span>{showAdvanced ? "▲" : "▼"}</span>
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Expiration */}
                  <div>
                    <label className="field-label">Poll Deadline</label>
                    <div className="expiry-row">
                      {EXPIRY_CHOICES.map((choice) => (
                        <button
                          type="button"
                          key={choice.label}
                          className={`expiry-chip ${expiryMs === choice.ms ? "active" : ""}`}
                          onClick={() => setExpiryMs(choice.ms)}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Results Visibility */}
                  <div>
                    <label className="field-label">Results Visibility</label>
                    <div className="expiry-row">
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

                  {/* Security Mode */}
                  <div>
                    <label className="field-label">Security & Anti-Abuse</label>
                    <div className="expiry-row">
                      {SECURITY_CHOICES.map((sc) => (
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
                  </div>

                  {/* Require Name */}
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

            {/* Create Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
              style={{ width: "100%", padding: "14px 24px", fontSize: 16, marginTop: 8 }}
            >
              {submitting ? "Creating poll..." : isPublic ? "Publish Community Poll (BPC) →" : "Create Private Poll (BPP) →"}
            </button>
          </div>
        </div>

        {/* Bulk Paste Modal */}
        {showBulkModal && (
          <div className="modal-backdrop">
            <div className="modal-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Paste Multiple Options</h2>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowBulkModal(false)}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Paste one option per line. Leading numbers and bullet points will be removed automatically:
              </p>
              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Option 1\nOption 2\nOption 3\nOption 4"}
                style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 16 }}
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
