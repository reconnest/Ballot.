import { describe, it, expect } from "vitest";
import { validateHandle, isReservedHandle, hashOtpCode } from "../lib/auth";

describe("Creator Auth & Handle Validation", () => {
  it("accepts clean, valid usernames", () => {
    expect(validateHandle("sandeep").valid).toBe(true);
    expect(validateHandle("alex_99").valid).toBe(true);
    expect(validateHandle("dev-lead").valid).toBe(true);
  });

  it("rejects handles outside length bounds (3-20 chars)", () => {
    expect(validateHandle("a").valid).toBe(false);
    expect(validateHandle("ab").valid).toBe(false);
    expect(validateHandle("a_very_excessively_long_username_that_exceeds_limits").valid).toBe(false);
  });

  it("rejects invalid characters (spaces, special punctuation)", () => {
    expect(validateHandle("user name").valid).toBe(false);
    expect(validateHandle("user@name").valid).toBe(false);
    expect(validateHandle("user!").valid).toBe(false);
  });

  it("rejects reserved system handles case-insensitively", () => {
    expect(isReservedHandle("admin")).toBe(true);
    expect(isReservedHandle("ADMIN")).toBe(true);
    expect(isReservedHandle("explore")).toBe(true);
    expect(isReservedHandle("settings")).toBe(true);
    expect(validateHandle("Admin").valid).toBe(false);
    expect(validateHandle("dashboard").valid).toBe(false);
  });

  it("generates deterministic sha256 hashes for OTP verification", () => {
    const code = "482910";
    const hash1 = hashOtpCode(code);
    const hash2 = hashOtpCode("  482910  "); // trims whitespace
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // standard sha256 hex length
  });
});
