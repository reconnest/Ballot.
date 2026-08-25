"use client";

import { BallotLogo } from "@/components/BallotLogo";
import Link from "next/link";

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
          marginBottom: 0,
        }}
      >
        It may have been removed, the link might be incorrect, or this poll
        never existed.
      </p>

      {/* Clickable URL at bottom */}
      <a
        href="https://ballot-poll.vercel.app"
        style={{
          marginTop: 48,
          fontSize: 12,
          color: "var(--accent)",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        ballot-poll.vercel.app
      </a>
    </div>
  );
}
