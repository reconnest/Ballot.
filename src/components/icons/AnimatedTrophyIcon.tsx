"use client";

import React from "react";

interface AnimatedTrophyIconProps {
  size?: number;
  color?: string;
}

export function AnimatedTrophyIcon({ size = 16, color = "var(--accent)" }: AnimatedTrophyIconProps) {
  return (
    <span
      className="trophy-icon-wrap"
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
        className="icon-trophy"
      >
        <path className="trophy-cup" d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path className="trophy-cup" d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path className="trophy-cup" d="M4 22h16" />
        <path className="trophy-cup" d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
        <path className="trophy-body" d="M18 4H6v7a6 6 0 0 0 12 0V4Z" />
        <path className="trophy-star" d="m12 7 .6 1.2 1.4.2-1 1 .2 1.4-1.2-.6-1.2.6.2-1.4-1-1 1.4-.2z" fill={color} strokeWidth="0" />
      </svg>
    </span>
  );
}
