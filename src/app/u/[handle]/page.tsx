"use client";

import { useEffect, useState, useRef } from "react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Search,
  Lock,
  Globe,
  Settings,
  LogOut,
  X,
  Plus,
  Sparkles,
  Check,
  ChevronDown,
  Vote,
  Trophy,
  Film,
} from "lucide-react";
import { AnimatedSearchIcon } from "@/components/icons/AnimatedSearchIcon";

function FilterDropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (val: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="profile-select"
        aria-label={ariaLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {selected.icon}
          <span>{selected.label}</span>
        </span>
        <ChevronDown
          size={12}
          color="var(--muted)"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "4px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            minWidth: 130,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 5,
                  border: "none",
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                  color: isSelected ? "var(--accent-ink)" : "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--paper)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


type CreatorProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: number;
};

type UserPoll = {
  id: string;
  slug: string;
  question: string;
  pollType: string;
  category: string;
  status: string;
  isPublic?: number;
  voteCount: number;
  isExpired: boolean;
  expiresAt?: number | null;
  hasVoted?: boolean;
  createdAt: number;
};

export default function CreatorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const rawHandle = (params.handle as string) || "";
  const handle = rawHandle.replace(/^@/, "").toLowerCase();

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [polls, setPolls] = useState<UserPoll[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "closed">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "unlisted">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "standard" | "ranked_choice" | "image">("all");

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Sign out State
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch(`/api/u/${handle}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCreator(data.creator);
          setPolls(data.polls || []);
          setTotalVotes(data.totalVotes || 0);
          setIsOwner(!!data.isOwner);
          if (data.creator) {
            setEditDisplayName(data.creator.displayName || "");
            setEditBio(data.creator.bio || "");
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    }
    if (handle) loadProfile();
  }, [handle]);

  // Handle Profile Save
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editDisplayName.trim()) return;
    setSavingProfile(true);
    setSaveError("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          bio: editBio.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user && creator) {
          setCreator({
            ...creator,
            displayName: data.user.displayName,
            bio: data.user.bio,
          });
        }
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setShowSettingsModal(false);
        }, 1200);
      } else {
        const err = await res.json();
        setSaveError(err.error || "Failed to update profile.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  // Handle Logout
  async function handleSignOut() {
    if (!confirm("Are you sure you want to sign out?")) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("Sign out failed", e);
      setSigningOut(false);
    }
  }

  // Filter and Sort Polls (Latest to Oldest)
  const filteredPolls = polls.filter((p) => {
    const isLive = p.status === "live" && !p.isExpired && (!p.expiresAt || Date.now() <= p.expiresAt);

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const cleanSlug = p.slug.replace(/^(BPC|BPP)-/, "").toLowerCase();
      const matchQuestion = p.question.toLowerCase().includes(q);
      const matchSlug = p.slug.toLowerCase().includes(q) || cleanSlug.includes(q);
      const matchCategory = (p.category || "").toLowerCase().includes(q);
      if (!matchQuestion && !matchSlug && !matchCategory) return false;
    }

    // Status filter
    if (statusFilter === "live" && !isLive) return false;
    if (statusFilter === "closed" && isLive) return false;

    // Visibility / Type filter
    if (isOwner) {
      if (visibilityFilter === "public" && p.isPublic === 0) return false;
      if (visibilityFilter === "unlisted" && p.isPublic !== 0) return false;
    } else {
      if (typeFilter !== "all" && p.pollType !== typeFilter) return false;
    }

    return true;
  });

  return (
    <div className="wrap">
      <Navbar />

      <main style={{ maxWidth: 920, margin: "0 auto", paddingBottom: 60, width: "100%" }}>
        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            Loading creator dashboard...
          </div>
        ) : notFound || !creator ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <Search size={36} color="var(--muted)" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Creator not found</h1>
            <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
              The handle @{handle} does not exist or has not published any public polls yet.
            </p>
            <Link href="/explore" className="btn-primary">
              Explore Community Polls →
            </Link>
          </div>
        ) : (
          <div>
            {/* 1. CREATOR HERO CARD */}
            <div className="profile-hero-card">
              {/* Left Identity Block */}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flex: "1 1 320px", minWidth: 0 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  color: "var(--accent-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  border: "2px solid var(--accent)",
                  fontFamily: "Space Grotesk, sans-serif",
                  flexShrink: 0
                }}>
                  {creator.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.25, wordBreak: "break-word" }}>
                      {creator.displayName}
                    </h1>
                    <span style={{ fontSize: 11, background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "2px 8px", borderRadius: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Verified Creator
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>
                    @{creator.username}
                  </div>
                  {creator.bio && (
                    <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, maxWidth: 520, lineHeight: 1.45, wordBreak: "break-word" }}>
                      {creator.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Stats & Owner Actions */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flexShrink: 0 }}>
                <div className="profile-stats-strip">
                  <div className="profile-stat-item">
                    <div className="profile-stat-num">{polls.length}</div>
                    <div className="profile-stat-label">polls</div>
                  </div>
                  <div className="profile-stat-divider" aria-hidden="true" />
                  <div className="profile-stat-item">
                    <div className="profile-stat-num">{totalVotes}</div>
                    <div className="profile-stat-label">votes</div>
                  </div>
                </div>

                {/* Owner Quick Actions (Settings & Sign Out) */}
                {isOwner && (
                  <div className="profile-owner-actions">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(true)}
                      className="profile-action-btn"
                      title="Edit Profile and Bio"
                    >
                      <Settings size={13} />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="profile-action-btn danger"
                      title="Sign out of account"
                    >
                      <LogOut size={13} />
                      <span>{signingOut ? "Signing out…" : "Sign out"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. STICKY SEARCH & FILTER CONTROL STRIP (60/40 Split) */}
            <div className="profile-control-bar">
              {/* 60% Search Input */}
              <div className="profile-search-wrap">
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--faint)" }}>
                  <AnimatedSearchIcon size={16} />
                </div>
                <input
                  type="text"
                  placeholder={isOwner ? "Search your polls by question, category, or poll ID…" : `Search @${creator.username}'s polls…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 36px",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--paper)",
                    fontSize: 13,
                    color: "var(--ink)",
                    outline: "none",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* 40% Filter Dropdowns */}
              <div className="profile-filters-wrap">
                {/* Status Dropdown */}
                <FilterDropdown


                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as any)}
                  ariaLabel="Filter by poll status"
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "live", label: "Live", icon: <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} /> },
                    { value: "closed", label: "Closed", icon: <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)", display: "inline-block" }} /> },
                  ]}
                />

                {/* Visibility / Type Dropdown */}
                {isOwner ? (
                  <FilterDropdown
                    value={visibilityFilter}
                    onChange={(val) => setVisibilityFilter(val as any)}
                    ariaLabel="Filter by visibility"
                    options={[
                      { value: "all", label: "All Visibility" },
                      { value: "public", label: "Public", icon: <Globe size={13} color="var(--accent)" /> },
                      { value: "unlisted", label: "Unlisted", icon: <Lock size={13} color="var(--muted)" /> },
                    ]}
                  />
                ) : (
                  <FilterDropdown
                    value={typeFilter}
                    onChange={(val) => setTypeFilter(val as any)}
                    ariaLabel="Filter by poll format"
                    options={[
                      { value: "all", label: "All Types" },
                      { value: "standard", label: "Standard", icon: <Vote size={13} color="var(--accent)" /> },
                      { value: "ranked_choice", label: "Ranked", icon: <Trophy size={13} color="var(--accent)" /> },
                      { value: "image", label: "Image", icon: <Film size={13} color="var(--accent)" /> },
                    ]}
                  />
                )}


                {/* Quick Create New Poll button for Owner */}
                {isOwner && (
                  <Link
                    href="/new"
                    className="btn-primary"
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                      borderRadius: 6,
                    }}
                    title="Create a new poll"
                  >
                    <Plus size={13} />
                    <span>New Poll</span>
                  </Link>
                )}
              </div>
            </div>

            {/* 3. POLLS LIST HEADER */}
            <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color="var(--accent)" />
                <span>
                  {isOwner ? "Your Polls" : `Polls by @${creator.username}`}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                Showing {filteredPolls.length} of {polls.length} poll{polls.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* 4. SCROLLABLE POLLS LEDGER LIST */}
            {filteredPolls.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <Search size={32} color="var(--muted)" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No matching polls found</h3>
                <p style={{ color: "var(--muted)", fontSize: 13, maxWidth: 420, margin: "0 auto 16px" }}>
                  {searchQuery || statusFilter !== "all" || visibilityFilter !== "all" || typeFilter !== "all"
                    ? "Try clearing your search query or reset your status/type filters."
                    : isOwner
                    ? "You haven't published any polls yet. Launch your first question in seconds!"
                    : "This creator hasn't published any matching public polls."}
                </p>
                {(searchQuery || statusFilter !== "all" || visibilityFilter !== "all" || typeFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setVisibilityFilter("all");
                      setTypeFilter("all");
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "6px 14px" }}
                  >
                    Reset all filters
                  </button>
                )}
                {isOwner && !searchQuery && polls.length === 0 && (
                  <Link href="/new" className="btn-primary" style={{ display: "inline-flex", fontSize: 13, textDecoration: "none" }}>
                    + Create Your First Poll
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredPolls.map((p) => {
                  const isLive = p.status === "live" && !p.isExpired && (!p.expiresAt || Date.now() <= p.expiresAt);

                  return (
                    <Link
                      href={`/p/${p.slug}`}
                      key={p.id}
                      className="profile-poll-card"
                      role="listitem"
                    >
                      {/* Left: Poll Details */}
                      <div className="profile-card-main">
                        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="badge-category">{p.category || "general"}</span>
                          {p.pollType === "ranked_choice" && <span className="badge-type">Ranked Choice</span>}
                          {p.pollType === "image" && <span className="badge-type">Image Poll</span>}
                          {isOwner && p.isPublic === 0 && (
                            <span style={{
                              fontSize: 10,
                              fontFamily: "'JetBrains Mono', monospace",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--paper)",
                              border: "1px solid var(--line)",
                              color: "var(--muted)",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}>
                              <Lock size={10} />
                              <span>Unlisted</span>
                            </span>
                          )}
                          <span style={{
                            fontSize: 10,
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: isLive ? "var(--accent-soft)" : "var(--line)",
                            color: isLive ? "var(--accent-ink)" : "var(--muted)",
                            fontWeight: 600,
                            letterSpacing: "0.03em"
                          }}>
                            {isLive ? "LIVE" : "CLOSED"}
                          </span>
                        </div>

                        <div className="explore-card-id" style={{ marginBottom: 4 }}>
                          Poll ID: {p.slug.replace(/^(BPC|BPP)-/, "")}
                        </div>

                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "var(--ink)",
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                            fontFamily: "'Space Grotesk', sans-serif"
                          }}
                          title={p.question}
                        >
                          {p.question}
                        </div>
                      </div>

                      {/* Hairline Divider */}
                      <div className="profile-card-divider" aria-hidden="true" />

                      {/* Right: Votes & Action Button */}
                      <div className="profile-card-side">
                        <div className="profile-card-votes">
                          {p.voteCount} {p.voteCount === 1 ? "vote" : "votes"}
                        </div>
                        <div className={`profile-card-action ${!isLive && !isOwner ? "closed" : ""}`}>
                          {isOwner
                            ? "Manage & Results →"
                            : !isLive
                            ? "Results Finalized →"
                            : p.hasVoted
                            ? "Voted · Results →"
                            : "Vote now →"}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. EDIT PROFILE SETTINGS MODAL */}
        {showSettingsModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 16,
            }}
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "24px",
                width: "100%",
                maxWidth: 460,
                boxShadow: "0 16px 36px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Settings size={18} color="var(--accent)" />
                  <span>Edit Profile</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {saveError && (
                <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div style={{ padding: "8px 12px", background: "var(--accent-soft)", color: "var(--accent-ink)", borderRadius: 6, fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    maxLength={50}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--paper)",
                      color: "var(--ink)",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                    Bio
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Tell your voters about your organization, community, or polling topics…"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "var(--paper)",
                      color: "var(--ink)",
                      fontSize: 13,
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
                    {editBio.length} / 300
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="btn-ghost"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile || saveSuccess}
                    className="btn-primary"
                    style={{ padding: "8px 18px", fontSize: 13 }}
                  >
                    {savingProfile ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Footer />
      </main>
    </div>
  );
}



