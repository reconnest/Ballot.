"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EXPIRY_CHOICES = [
  { label: "No limit", ms: null },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

export default function NewPollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [expiryMs, setExpiryMs] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateOpt(i: number, value: string) {
    setOpts((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOpt() {
    setOpts((prev) => [...prev, ""]);
  }
  function removeOpt(i: number) {
    setOpts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    const q = question.trim();
    const cleanOpts = opts.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!q) {
      setError("Add a question.");
      return;
    }
    if (cleanOpts.length < 2) {
      setError("Add at least two options.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, options: cleanOpts, expiresInMs: expiryMs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create poll.");
        setSubmitting(false);
        return;
      }
      const stored = JSON.parse(localStorage.getItem("ballot:myPolls") ?? "[]");
      stored.push({ slug: data.slug, question: q, createdAt: Date.now() });
      localStorage.setItem("ballot:myPolls", JSON.stringify(stored));
      router.push(`/p/${data.slug}`);
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
        <div className="block">
          <label className="field-label" htmlFor="q">Question</label>
          <input
            id="q"
            type="text"
            maxLength={140}
            placeholder="What should we get for lunch?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <div className="block">
          <label className="field-label">Options</label>
          <div>
            {opts.map((o, i) => (
              <div className="option-row" key={i}>
                <span className="option-num">{i + 1}</span>
                <input
                  type="text"
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                  value={o}
                  onChange={(e) => updateOpt(i, e.target.value)}
                />
                {opts.length > 2 && (
                  <button className="remove-opt" aria-label="Remove option" onClick={() => removeOpt(i)}>
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {opts.length < 10 && (
            <button className="add-opt" onClick={addOpt}>+ Add option</button>
          )}
        </div>
        <div className="block">
          <label className="field-label">Closes</label>
          <div className="expiry-row">
            {EXPIRY_CHOICES.map((c) => (
              <button
                key={c.label}
                className={`expiry-chip ${expiryMs === c.ms ? "active" : ""}`}
                onClick={() => setExpiryMs(c.ms)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="err">{error}</div>}
        <div className="poll-actions" style={{ justifyContent: "flex-start", gap: 16 }}>
          <button className="btn-primary" disabled={submitting} onClick={handleCreate}>
            {submitting ? "Creating…" : "Create poll"}
          </button>
          <Link href="/" className="btn-ghost">Cancel</Link>
        </div>
      </main>
    </div>
  );
}
