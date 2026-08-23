"use client";

import Link from "next/link";
import { BallotLogo } from "@/components/BallotLogo";
import { Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="footer-top">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BallotLogo size={22} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            — Fast, real-time polling engine.
          </span>
        </div>
        <div className="footer-links" style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <Link href="/new" className="footer-link">New Poll</Link>
          <Link href="/explore" className="footer-link">Explore</Link>
          <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <a
            href="https://github.com/reconnest/Ballot.git"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          lineHeight: 1.6,
          fontSize: 11,
          color: "var(--faint)",
          borderTop: "1px solid var(--line)",
          paddingTop: 12,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, verticalAlign: "middle", marginRight: 4 }}>
          <Lock size={12} color="var(--muted)" />
        </span>
        <strong>Privacy disclosure:</strong> Ballot uses private session cookies and one-way salted IP digests to deter duplicate voting. We show ads through Google AdSense, which may use cookies and similar technologies to serve ads based on your visits to this and other sites. You can control ad personalization at{" "}
        <a
          href="https://g.co/adssettings"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--muted)", textDecoration: "underline" }}
        >
          g.co/adssettings
        </a>
        . We do not sell poll data or voting activity to third parties.
      </div>
    </footer>
  );
}

