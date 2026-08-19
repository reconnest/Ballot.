"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const CATEGORY_CHOICES = [
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
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [requireName, setRequireName] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          category,
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
      <header className="top">
        <Link href="/" className="brand">
          Ballot<span>.</span>
          <div className="brand-sub">quick polls</div>
        </Link>
      </header>
      <main>
        <div className="section-label">New poll</div>

        {/* Poll Format */}
        <div className="block">
          <label className="field-label">Poll Format</label>
          <div className="visibility-grid">
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

        {/* Category */}
        <div className="block">
          <label className="field-label">Category</label>
          <div className="expiry-row">
            {CATEGORY_CHOICES.map((c) => (
              <button
                type="button"
                key={c.value}
                className={`expiry-chip ${category === c.value ? "active" : ""}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

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
                ? "Rank your favorite candidates / options…"
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
                placeholder="Add extra context, rules, or links for your voters..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Options */}
        <div className="block">
          <label className="field-label">
            Options <span style={{ color: "var(--accent)" }}>*</span>
          </label>
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
          {opts.length < 30 && (
            <button type="button" className="add-opt" onClick={addOpt}>
              + Add option ({opts.length}/30)
            </button>
          )}
        </div>

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

        {/* Public Explore Discovery */}
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
              Unlisted (Link only)
            </button>
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
          {requireName && (
            <div className="poll-meta" style={{ marginTop: 8 }}>
              Voters will be prompted for their name, visible in the results ledger.
            </div>
          )}
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

        {error && <div className="err" role="alert">{error}</div>}

        <div className="poll-actions" style={{ justifyContent: "flex-start", gap: 16, marginTop: 24 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={submitting}
            onClick={handleCreate}
          >
            {submitting ? "Creating poll…" : "Create poll →"}
          </button>
          <Link href="/" className="btn-ghost">Cancel</Link>
        </div>

        <div className="privacy-disclosure" style={{ marginTop: 32, fontSize: 11, color: "var(--faint)", lineHeight: 1.5, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          🔒 <strong>Privacy & Fraud Notice:</strong> Ballot uses private session cookies and one-way salted IP digests solely to deter duplicate votes. No personal browsing activity is tracked or sold.
        </div>
      </main>
    </div>
  );
}



