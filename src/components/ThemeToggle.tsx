"use client";

import { useEffect, useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ballot:theme") as "light" | "dark" | null;
      if (saved) {
        setTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        setTheme(initial);
        document.documentElement.setAttribute("data-theme", initial);
      }
    } catch {}
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("ballot:theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggle}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      aria-label="Toggle dark mode"
    >
      <ThemeIcon theme={theme} size={18} />
    </button>
  );
}

