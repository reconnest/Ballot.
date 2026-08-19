"use client";

import React from "react";

interface BallotLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function BallotLogo({ size = 28, showText = true, className = "" }: BallotLogoProps) {
  return (
    <div className={`brand-logo-wrap ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, display: "block" }}
        aria-hidden="true"
      >
        <rect
          x="10"
          y="18"
          width="80"
          height="74"
          rx="22"
          stroke="var(--accent, #14B8A6)"
          strokeWidth="9"
          fill="none"
        />
        <path
          d="M 33 18 C 33 11, 39 10, 50 10 C 61 10, 67 11, 67 18"
          stroke="var(--accent, #14B8A6)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <rect
          x="26"
          y="56"
          width="11"
          height="20"
          rx="5.5"
          fill="var(--accent, #14B8A6)"
          opacity="0.65"
        />
        <rect
          x="44"
          y="42"
          width="12"
          height="34"
          rx="6"
          fill="var(--accent, #14B8A6)"
        />
        <rect
          x="62"
          y="28"
          width="12"
          height="48"
          rx="6"
          fill="var(--accent, #14B8A6)"
        />
        <circle
          cx="68"
          cy="26"
          r="10"
          fill="var(--accent, #14B8A6)"
        />
        <path
          d="M 64 26 L 67 29 L 72.5 23"
          stroke="var(--paper, #0B0E11)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: size * 0.82,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          Ballot
        </span>
      )}
    </div>
  );
}
