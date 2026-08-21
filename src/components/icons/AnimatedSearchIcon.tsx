"use client";

import React from "react";

interface AnimatedSearchIconProps {
  size?: number;
  color?: string;
}

export function AnimatedSearchIcon({ size = 18, color = "currentColor" }: AnimatedSearchIconProps) {
  return (
    <span
      className="search-icon-wrap"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="icon-magnifier"
      >
        <circle className="magnifier-glass" cx="11" cy="11" r="8" />
        <line className="magnifier-handle" x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </span>
  );
}
