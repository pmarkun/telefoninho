import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createMemberSchema,
  allowedCallSchema,
  claimPairingSchema,
  pairingCodeSchema,
} from "./validation";

describe("loginSchema", () => {
  it("should accept valid login", () => {
    const result = loginSchema.safeParse({ email: "parent@demo.com", password: "pass" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "pass" });
    expect(result.success).toBe(false);
  });
});

describe("createMemberSchema", () => {
  it("should accept valid child member", () => {
    const result = createMemberSchema.safeParse({ kind: "child", displayName: "Tereza" });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = createMemberSchema.safeParse({ kind: "child", displayName: "" });
    expect(result.success).toBe(false);
  });
});

describe("allowedCallSchema", () => {
  it("should accept valid rule", () => {
    const result = allowedCallSchema.safeParse({
      fromMemberId: "abc", toMemberId: "def", enabled: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("claimPairingSchema", () => {
  it("should accept valid claim", () => {
    const result = claimPairingSchema.safeParse({
      code: "123456", deviceName: "Phone", deviceId: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject short code", () => {
    const result = claimPairingSchema.safeParse({
      code: "123", deviceName: "Phone", deviceId: "abc123",
    });
    expect(result.success).toBe(false);
  });
});

describe("pairingCodeSchema", () => {
  it("should accept 6-digit code", () => {
    expect(pairingCodeSchema.safeParse("123456").success).toBe(true);
  });

  it("should reject non-digit code", () => {
    expect(pairingCodeSchema.safeParse("abcdef").success).toBe(false);
  });
});
