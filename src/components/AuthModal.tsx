"use client";

import { useState, useEffect } from "react";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; username: string; displayName: string; email: string }) => void;
  initialMessage?: string;
};

export function AuthModal({ isOpen, onClose, onSuccess, initialMessage }: AuthModalProps) {
  const [step, setStep] = useState<"email" | "otp" | "handle">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [testCodeHint, setTestCodeHint] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code.");
      } else {
        if (data.previewCode) {
          setTestCodeHint(data.previewCode);
        }
        setStep("otp");
        setCooldown(60);
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }


  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: otp,
          username: step === "handle" ? username : undefined,
          displayName: step === "handle" ? displayName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
      } else if (data.needsRegistration) {
        setStep("handle");
      } else if (data.user) {
        onSuccess(data.user);
        onClose();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.65)",
      backdropFilter: "blur(4px)",
      zIndex: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 28,
        maxWidth: 420,
        width: "100%",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
        position: "relative"
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            color: "var(--muted)"
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            {step === "email" && "Creator Sign In"}
            {step === "otp" && "Enter Verification Code"}
            {step === "handle" && "Claim Your Creator Handle"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {step === "email" && (initialMessage || "Public community polls require a creator profile to prevent spam.")}
            {step === "otp" && `We sent a 6-digit code to ${email}`}
            {step === "handle" && "Choose a unique @handle to attribute to your public polls."}
          </p>
        </div>

        {error && (
          <div style={{
            background: "#FEF2F2",
            color: "#991B1B",
            border: "1px solid #F87171",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 16,
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleSendCode}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-text"
                style={{ width: "100%", padding: "10px 12px", fontSize: 14 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: 14 }}
            >
              {loading ? "Sending Code..." : "Continue with Email →"}
            </button>
          </form>
        )}

        {(step === "otp" || step === "handle") && (
          <form onSubmit={handleVerifyCode}>
            {step === "otp" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  className="input-text"
                  style={{ width: "100%", padding: "10px 12px", fontSize: 20, textAlign: "center", letterSpacing: "0.2em", fontFamily: "monospace" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
                  >
                    ← Change Email
                  </button>
                  <button
                    type="button"
                    disabled={cooldown > 0}
                    onClick={handleSendCode}
                    style={{ background: "none", border: "none", color: cooldown > 0 ? "var(--muted)" : "var(--accent)", fontSize: 12, cursor: cooldown > 0 ? "default" : "pointer" }}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            )}


            {step === "handle" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Unique Public Handle (@)
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: 12, color: "var(--muted)", fontWeight: 700 }}>@</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      required
                      autoFocus
                      className="input-text"
                      style={{ width: "100%", padding: "10px 12px 10px 28px", fontSize: 14, fontFamily: "monospace" }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    3-20 letters, numbers, hyphens or underscores.
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your Name or Team"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="input-text"
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14 }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: 14 }}
            >
              {loading ? "Verifying..." : step === "handle" ? "Complete Registration & Sign In →" : "Verify & Sign In →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
