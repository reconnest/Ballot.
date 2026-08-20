"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BallotLogo } from "./BallotLogo";
import { ThemeToggle } from "./ThemeToggle";
import { AuthModal } from "./AuthModal";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

interface NavbarProps {
  onUserChange?: (user: SessionUser | null) => void;
  showLandingLinks?: boolean;
}

export function Navbar({ onUserChange }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals & Dropdown State
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | undefined>();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Settings Form State
  const [editDisplayName, setEditDisplayName] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch(`/api/auth/me?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
          if (data.user) {
            setEditDisplayName(data.user.displayName || "");
          }
          if (onUserChange) onUserChange(data.user || null);
        }
      } catch {}
      setLoading(false);
    }
    loadUser();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setShowDropdown(false);
      if (onUserChange) onUserChange(null);
      router.push("/explore");
      router.refresh();
    } catch {}
  }

  function handleOpenSignIn(msg?: string) {
    setAuthMessage(msg || "Sign in with your email to access your creator dashboard.");
    setShowAuthModal(true);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editDisplayName.trim()) {
      setSettingsError("Display name cannot be empty.");
      return;
    }
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editDisplayName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setSettingsSuccess(true);
        setTimeout(() => {
          setSettingsSuccess(false);
          setShowSettingsModal(false);
        }, 1200);
      } else {
        setSettingsError(data.error || "Failed to update profile.");
      }
    } catch {
      setSettingsError("Network error. Please try again.");
    }
    setSavingSettings(false);
  }

  // Scoping: How It Works & Why Ballot only show on Landing Page ('/'), for both logged-in and logged-out users
  const isLandingPage = pathname === "/";
  const logoHref = "/";

  return (
    <>
      <header className="navbar-container">
        {/* 1. Left Section: Brand Logo */}
        <Link href={logoHref} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <BallotLogo size={32} />
        </Link>


        {/* 2. Middle Section: Scoped Anchor Links (Desktop Only) */}
        <nav className="navbar-middle-links" aria-label="Main Navigation">
          {isLandingPage ? (
            <>
              <a href="#how-it-works" className="navbar-nav-link">How It Works</a>
              <a href="#why-ballot" className="navbar-nav-link">Why Ballot</a>
              <Link href="/explore" className="navbar-nav-link">Explore</Link>
            </>
          ) : (
            pathname !== "/explore" && (
              <Link href="/explore" className="navbar-nav-link">Explore</Link>
            )
          )}
        </nav>


        {/* 3. Right Section: Theme Toggle, Create Poll & Auth State */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          <ThemeToggle />

          {loading ? (
            <div style={{ width: 60, height: 32 }} />
          ) : user ? (
            /* Logged-In Creator Navigation */
            <>
              {pathname !== "/new" && (
                <Link href="/new" className="btn-primary" style={{ fontSize: 13 }}>
                  + Create poll
                </Link>
              )}

              {/* Profile User ID Dropdown Trigger */}
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowDropdown((prev) => !prev)}
                  className="creator-dropdown-trigger"
                  aria-expanded={showDropdown}
                  title={`Creator ID: @${user.username}`}
                >
                  <span>👤</span>
                  <span>@{user.username}</span>
                  <span style={{ fontSize: 10, marginLeft: 2 }}>▼</span>
                </button>

                {/* Dropdown Menu (Dashboard, Settings, Sign out) */}
                {showDropdown && (
                  <div className="creator-dropdown-menu" role="menu">
                    <Link
                      href={`/u/${user.username}`}
                      className="creator-dropdown-item"
                      onClick={() => setShowDropdown(false)}
                      role="menuitem"
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </Link>

                    <button
                      type="button"
                      className="creator-dropdown-item"
                      onClick={() => {
                        setShowDropdown(false);
                        setEditDisplayName(user.displayName || user.username);
                        setShowSettingsModal(true);
                      }}
                      role="menuitem"
                    >
                      <span>⚙️</span>
                      <span>Settings</span>
                    </button>

                    <div className="creator-dropdown-divider" />

                    <button
                      type="button"
                      className="creator-dropdown-item"
                      onClick={handleLogout}
                      style={{ color: "#EF4444" }}
                      role="menuitem"
                    >
                      <span>🚪</span>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Logged-Out Guest Navigation */
            <>
              <button
                type="button"
                onClick={() => handleOpenSignIn()}
                className="btn-ghost"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Sign in
              </button>

              {pathname !== "/new" && (
                <Link href="/new" className="btn-primary" style={{ fontSize: 13 }}>
                  + Create poll
                </Link>
              )}
            </>
          )}
        </div>
      </header>

      {/* Auth Modal with Automatic Redirect to Profile */}
      <AuthModal
        isOpen={showAuthModal}
        initialMessage={authMessage}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          if (onUserChange) onUserChange(newUser);
          // Redirect creator directly to their profile page upon successful sign in
          router.push(`/u/${newUser.username}`);
        }}
      />

      {/* Creator Settings Modal (Update Display Name) */}
      {showSettingsModal && user && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Creator Settings</h2>
              <button type="button" className="btn-link" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSettings}>
              {settingsError && (
                <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                  {settingsError}
                </div>
              )}

              {settingsSuccess && (
                <div style={{ background: "#D1FAE5", color: "#065F46", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                  ✓ Settings updated successfully!
                </div>
              )}

              {/* Creator ID (Read-only) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Creator ID / Handle (Permanent)
                </label>
                <div style={{ padding: "8px 12px", background: "var(--paper)", borderRadius: 6, border: "1px solid var(--line)", fontFamily: "monospace", fontSize: 13, color: "var(--ink)" }}>
                  @{user.username}
                </div>
              </div>

              {/* Email (Read-only) */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                  Email Address
                </label>
                <div style={{ padding: "8px 12px", background: "var(--paper)", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13, color: "var(--muted)" }}>
                  {user.email}
                </div>
              </div>

              {/* Display Name Input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                  Display Name <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Your public display name"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="input-text"
                  required
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn-primary"
                >
                  {savingSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
