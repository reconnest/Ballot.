"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BallotLogo } from "@/components/BallotLogo";


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

export default function NewPollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [pollType, setPollType] = useState("standard");
  const [category, setCategory] = useState("general");
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [opts, setOpts] = useState<{ label: string; imageUrl: string }[]>([
    { label: "", imageUrl: "" },
    { label: "", imageUrl: "" },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [minChoices, setMinChoices] = useState(1);
  const [maxChoices, setMaxChoices] = useState<number | "">("");
  const [resultsVisibility, setResultsVisibility] = useState("always_public");
  const [securityMode, setSecurityMode] = useState("standard");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [requireName, setRequireName] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setOpts((prev) => prev.filter((_, idx) => idx !== i));
  }
  function moveOpt(i: number, dir: "up" | "down") {
    const target = dir === "up" ? i - 1 : i + 1;
    if (target < 0 || target >= opts.length) return;
    setOpts((prev) => {
      const copy = [...prev];
      const temp = copy[i];
      copy[i] = copy[target];
      copy[target] = temp;
      return copy;
    });
  }

  async function handleCreate() {
    const q = question.trim();
    const cleanOpts = opts
      .map((o) => ({ label: o.label.trim(), imageUrl: o.imageUrl.trim() || undefined }))
      .filter((o) => o.label.length > 0);

    if (!q) {
      setError("Please add a question.");
      return;
    }
    if (cleanOpts.length < 2) {
      setError("Please add at least two options.");
      return;
    }
    if (pollType === "standard" && allowMultiple) {
      const parsedMin = Math.max(1, minChoices);
      const parsedMax = typeof maxChoices === "number" ? maxChoices : null;
      if (parsedMax && parsedMax < parsedMin) {
        setError("Maximum choices cannot be less than minimum choices.");
        return;
      }
      if (parsedMax && parsedMax > cleanOpts.length) {
        setError(`Maximum choices cannot exceed total options (${cleanOpts.length}).`);
        return;
      }
    }

    // Determine final category tag
    const finalCategory = isPublic
      ? (isAddingCustom && customCategory.trim() ? customCategory.trim().toLowerCase().slice(0, 30) : category)
      : "general";

    setError("");
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
          expiresInMs: expiryMs,
          requireName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create poll.");
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
        </div>
      </header>


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
                placeholder={
                  pollType === "ranked_choice"
                    ? "Rank your favorite choices in order…"
                    : "What should we get for lunch?"
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                autoFocus
              />
            </div>

            <div className="block">
              {!showDesc ? (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowDesc(true)}
                  style={{ fontSize: 13 }}
                >
                  + Add description / context (optional)
                </button>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="field-label" htmlFor="desc">Description (optional)</label>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => { setShowDesc(false); setDescription(""); }}
                      style={{ fontSize: 12, color: "var(--muted)" }}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    id="desc"
                    className="input-textarea"
                    rows={3}
                    maxLength={1000}
                    placeholder="Add rules, links, or context for voters..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Options List */}
            <div className="block">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>
                  Options <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setShowBulkModal(true)}
                  style={{ fontSize: 12 }}
                >
                  📋 Paste multiple lines
                </button>
              </div>

              <div role="list" aria-label="Poll options">
                {opts.map((o, i) => (
                  <div className="option-row-wrap" key={i} role="listitem" style={{ marginBottom: 12, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                    <div className="option-row" style={{ borderBottom: "none" }}>
                      <span className="option-num" aria-hidden="true">{i + 1}</span>
                      <input
                        type="text"
                        maxLength={100}
                        placeholder={`Option ${i + 1}`}
                        value={o.label}
                        aria-label={`Option ${i + 1}`}
                        onChange={(e) => updateOptLabel(i, e.target.value)}
                      />
                      <div className="option-row-actions">
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={i === 0}
                          aria-label={`Move option ${i + 1} up`}
                          onClick={() => moveOpt(i, "up")}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="reorder-btn"
                          disabled={i === opts.length - 1}
                          aria-label={`Move option ${i + 1} down`}
                          onClick={() => moveOpt(i, "down")}
                        >
                          ▼
                        </button>
                        {opts.length > 2 && (
                          <button
                            type="button"
                            className="remove-opt"
                            aria-label={`Remove option ${i + 1}`}
                            onClick={() => removeOpt(i)}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Image URL for Image Polls */}
                    {pollType === "image" && (
                      <div style={{ paddingLeft: 30, marginTop: 4 }}>
                        <input
                          type="url"
                          placeholder="Image URL (https://…)"
                          value={o.imageUrl}
                          onChange={(e) => updateOptImage(i, e.target.value)}
                          style={{ fontSize: 12, color: "var(--muted)", width: "100%" }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
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
            {/* Top Requirement: Discovery & Directory (Public vs Unlisted) */}
            <div className="block">
              <label className="field-label">Discovery & Directory</label>
              <div className="expiry-row">
                <button
                  type="button"
                  className={`expiry-chip ${isPublic ? "active" : ""}`}
                  onClick={() => setIsPublic(true)}
                >
                  Public (Listed in Explore)
                </button>
                <button
                  type="button"
                  className={`expiry-chip ${!isPublic ? "active" : ""}`}
                  onClick={() => setIsPublic(false)}
                >
                  Private (Link only)
                </button>
              </div>

            </div>

            {/* Requirement: Category only visible when Public, plus Custom Category */}
            {isPublic && (
              <div className="block">
                <label className="field-label">Category</label>
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
                    Multiple choices
                  </button>
                </div>
                {allowMultiple && (
                  <div className="multi-choice-config">
                    <div className="config-item">
                      <label htmlFor="minChoices" className="sub-field-label">Min choices</label>
                      <input
                        id="minChoices"
                        type="number"
                        min={1}
                        max={opts.length}
                        value={minChoices}
                        onChange={(e) => setMinChoices(parseInt(e.target.value) || 1)}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div className="config-item">
                      <label htmlFor="maxChoices" className="sub-field-label">Max choices (optional)</label>
                      <input
                        id="maxChoices"
                        type="number"
                        min={minChoices}
                        max={opts.length}
                        placeholder="No max"
                        value={maxChoices}
                        onChange={(e) => setMaxChoices(e.target.value === "" ? "" : parseInt(e.target.value) || "")}
                        style={{ width: 100 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Advanced Settings Accordion */}
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>⚙️ Advanced Settings (Privacy & Fraud)</span>
                <span style={{ fontSize: 11, fontFamily: "monospace" }}>{showAdvanced ? "▲ Hide" : "▼ Expand"}</span>
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 14, borderLeft: "2px solid var(--line)", paddingLeft: 12 }}>
                  {/* Results Visibility */}
                  <div className="block">
                    <label className="field-label">Results Visibility</label>
                    <div className="visibility-grid">
                      {VISIBILITY_CHOICES.map((vc) => (
                        <button
                          type="button"
                          key={vc.value}
                          className={`visibility-card ${resultsVisibility === vc.value ? "active" : ""}`}
                          onClick={() => setResultsVisibility(vc.value)}
                        >
                          <div className="vis-title">{vc.label}</div>
                          <div className="vis-hint">{vc.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate & Fraud Protection */}
                  <div className="block">
                    <label className="field-label">Duplicate Vote Protection</label>
                    <div className="visibility-grid">
                      {SECURITY_CHOICES.map((sc) => (
                        <button
                          type="button"
                          key={sc.value}
                          className={`visibility-card ${securityMode === sc.value ? "active" : ""}`}
                          onClick={() => setSecurityMode(sc.value)}
                        >
                          <div className="vis-title">{sc.label}</div>
                          <div className="vis-hint">{sc.hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voter Identity */}
                  <div className="block">
                    <label className="field-label">Voter Identity</label>
                    <div className="expiry-row">
                      <button
                        type="button"
                        className={`expiry-chip ${!requireName ? "active" : ""}`}
                        onClick={() => setRequireName(false)}
                      >
                        Anonymous
                      </button>
                      <button
                        type="button"
                        className={`expiry-chip ${requireName ? "active" : ""}`}
                        onClick={() => setRequireName(true)}
                      >
                        Ask for name
                      </button>
                    </div>
                  </div>

                  {/* Poll Expiry */}
                  <div className="block">
                    <label className="field-label">Poll Deadline</label>
                    <div className="expiry-row">
                      {EXPIRY_CHOICES.map((c) => (
                        <button
                          type="button"
                          key={c.label}
                          className={`expiry-chip ${expiryMs === c.ms ? "active" : ""}`}
                          onClick={() => setExpiryMs(c.ms)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="err" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

            <div className="poll-actions" style={{ justifyContent: "flex-start", gap: 14, marginTop: 16 }}>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting}
                onClick={handleCreate}
                style={{ padding: "12px 24px", fontSize: 15 }}
              >
                {submitting ? "Creating poll…" : "Create poll →"}
              </button>
              <Link href="/" className="btn-ghost">Cancel</Link>
            </div>
          </div>
        </div>

        <div className="privacy-disclosure" style={{ marginTop: 40, fontSize: 11, color: "var(--faint)", lineHeight: 1.5, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          🔒 <strong>Privacy & Fraud Notice:</strong> Ballot uses private session cookies and one-way salted IP digests solely to deter duplicate votes. No personal browsing activity is tracked, profiled, or sold.
        </div>
      </main>

      {/* Bulk Paste Modal */}
      {showBulkModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Paste Multiple Options</h3>
              <button type="button" className="close-btn" onClick={() => setShowBulkModal(false)}>&times;</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Paste a list of options from Slack, ChatGPT, or your notes. Each line will become a separate option:
            </p>
            <textarea
              className="input-textarea"
              rows={6}
              placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              autoFocus
              style={{ width: "100%", marginBottom: 16 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowBulkModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleApplyBulkPaste}>Apply Options</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
