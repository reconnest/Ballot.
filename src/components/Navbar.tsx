"use client";

import { useEffect, useState } from "react";
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

export function Navbar({ onUserChange, showLandingLinks = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | undefined>();

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch(`/api/auth/me?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
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
      if (onUserChange) onUserChange(null);
      router.push("/explore");
      router.refresh();
    } catch {}
  }

  function handleOpenSignIn(msg?: string) {
    setAuthMessage(msg || "Sign in with your email to access your creator dashboard.");
    setShowAuthModal(true);
  }

  // If creator is logged in, clicking the Ballot logo goes to /explore. If guest, goes to /
  const logoHref = user ? "/explore" : "/";

  return (
    <>
      <header className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", marginBottom: 24 }}>
        {/* Left: Brand Logo */}
        <Link href={logoHref} style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <BallotLogo size={32} />
        </Link>

        {/* Right: Navigation Items & Auth */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {showLandingLinks && !user && (
            <>
              <a href="#how-it-works" className="btn-ghost" style={{ fontSize: 13 }}>How It Works</a>
              <a href="#why-ballot" className="btn-ghost" style={{ fontSize: 13 }}>Why Ballot</a>
            </>
          )}

          {pathname !== "/explore" && (
            <Link href="/explore" className="btn-ghost" style={{ fontSize: 13 }}>
              Explore
            </Link>
          )}

          <ThemeToggle />

          {loading ? (
            <div style={{ width: 60, height: 32 }} />
          ) : user ? (
            /* Logged-in Creator Navigation */
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Link
                href={`/u/${user.username}`}
                className="btn-ghost"
                title={`Creator ID: @${user.username}`}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "monospace",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--accent-ink)",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent)",
                  borderRadius: 6,
                  padding: "6px 10px"
                }}
              >
                <span>👤</span> @{user.username}
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="btn-ghost"
                style={{ fontSize: 12, color: "var(--muted)", padding: "6px 10px" }}
                title="Sign out of your creator account"
              >
                Logout
              </button>

              {pathname !== "/new" && (
                <Link href="/new" className="btn-primary" style={{ fontSize: 13 }}>
                  + Create poll
                </Link>
              )}
            </div>
          ) : (
            /* Logged-out / Guest Navigation */
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal for Sign In */}
      <AuthModal
        isOpen={showAuthModal}
        initialMessage={authMessage}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          if (onUserChange) onUserChange(newUser);
          router.refresh();
        }}
      />
    </>
  );
}
