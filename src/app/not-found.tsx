"use client";

import Link from "next/link";
import { BallotLogo } from "@/components/BallotLogo";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 40 }}>
        <BallotLogo />
      </Link>

      {/* 404 Number */}
      <div
        style={{
          fontSize: 100,
          fontWeight: 900,
          lineHeight: 1,
          color: "var(--accent)",
          letterSpacing: "-4px",
          marginBottom: 12,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        404
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 12px",
        }}
      >
        This poll doesn&apos;t exist
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize: 15,
          color: "var(--muted)",
          maxWidth: 360,
          lineHeight: 1.6,
          marginBottom: 36,
        }}
      >
        It may have been removed, the link might be incorrect, or this poll
        never existed.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "11px 22px",
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Create a Poll ?
        </Link>
        <Link
          href="/explore"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "11px 22px",
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Explore Polls
        </Link>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 48, fontSize: 12, color: "var(--faint)" }}>
        ballot-poll.vercel.app
      </p>
    </div>
  );
}
