"use client";

import { useEffect, useState, useRef } from "react";

interface RollingCounterProps {
  value: number;
  suffix?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  color?: string;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function SingleDigitColumn({ digit }: { digit: number }) {
  return (
    <span
      className="rolling-digit-window"
      style={{
        display: "inline-block",
        height: "1em",
        overflow: "hidden",
        verticalAlign: "baseline",
        position: "relative",
        width: "0.62em",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          transform: `translateY(-${digit * 10}%)`,
          transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            style={{
              height: "1em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export function RollingCounter({
  value,
  suffix = "",
  fontSize = "inherit",
  fontWeight = 700,
  color = "inherit",
}: RollingCounterProps) {
  const [isMounted, setIsMounted] = useState(false);
  const prevValueRef = useRef(value);
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 800);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const formattedStr = isMounted ? value.toLocaleString("en-US") : value.toString();

  return (
    <span
      className={`rolling-counter-wrapper ${isHighlighted ? "highlighted" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize,
        fontWeight,
        color,
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        transition: "color 0.3s ease",
      }}
    >
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
        {formattedStr.split("").map((char, idx) => {
          const num = parseInt(char, 10);
          if (isNaN(num)) {
            return (
              <span
                key={`sep-${idx}`}
                style={{
                  display: "inline-block",
                  width: "0.3em",
                  textAlign: "center",
                  lineHeight: 1,
                }}
              >
                {char}
              </span>
            );
          }
          return <SingleDigitColumn key={`digit-${idx}`} digit={num} />;
        })}
        {suffix && <span style={{ marginLeft: 2, fontSize: "0.85em", color: "var(--accent)" }}>{suffix}</span>}
      </span>
      <span className="sr-only">
        {formattedStr}{suffix}
      </span>
    </span>
  );
}

