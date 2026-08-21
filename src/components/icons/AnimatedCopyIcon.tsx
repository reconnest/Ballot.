"use client";

import React from "react";

interface AnimatedCopyIconProps {
  copied: boolean;
  size?: number;
  color?: string;
}

export function AnimatedCopyIcon({ copied, size = 16, color = "currentColor" }: AnimatedCopyIconProps) {
  return (
    <span
      className="copy-icon-wrap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {copied ? (
        // Animated Checkmark on Copy
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="icon-check-animated"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Clipboard Icon (top flap tilts on hover)
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="icon-clipboard"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path
            className="clipboard-flap"
            d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
          />
        </svg>
      )}
    </span>
  );
}
