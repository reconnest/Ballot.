"use client";

import React from "react";

interface ThemeIconProps {
  theme: "light" | "dark";
  size?: number;
}

export function ThemeIcon({ theme, size = 18 }: ThemeIconProps) {
  return (
    <span
      className="theme-icon-wrap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {theme === "light" ? (
        // Moon Icon (for switching to dark mode)
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="icon-moon"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          <path
            className="moon-sparkle"
            d="M19 3v4M21 5h-4"
            strokeWidth="1.5"
            opacity="0.8"
          />
        </svg>
      ) : (
        // Sun Icon (for switching to light mode)
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="icon-sun"
        >
          <circle cx="12" cy="12" r="4" />
          <path className="sun-ray" d="M12 2v2" />
          <path className="sun-ray" d="M12 20v2" />
          <path className="sun-ray" d="m4.93 4.93 1.41 1.41" />
          <path className="sun-ray" d="m17.66 17.66 1.41 1.41" />
          <path className="sun-ray" d="M2 12h2" />
          <path className="sun-ray" d="M20 12h2" />
          <path className="sun-ray" d="m6.34 17.66-1.41 1.41" />
          <path className="sun-ray" d="m19.07 4.93-1.41 1.41" />
        </svg>
      )}
    </span>
  );
}
