import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createMemberSchema,
  allowedCallSchema,
  claimPairingSchema,
  claimContactInviteSchema,
  contactInviteQrPayloadSchema,
  pairingCodeSchema,
  resolveContactRequestSchema,
  createShortMessageSchema,
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

describe("createShortMessageSchema", () => {
  it("accepts a short message and trims it", () => {
    const result = createShortMessageSchema.parse({
      toMemberId: "member_2",
      body: "  Oi!  ",
    });
    expect(result.body).toBe("Oi!");
  });

  it("rejects empty and overlong messages", () => {
    expect(createShortMessageSchema.safeParse({ toMemberId: "member_2", body: "  " }).success).toBe(false);
    expect(createShortMessageSchema.safeParse({ toMemberId: "member_2", body: "x".repeat(161) }).success).toBe(false);
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

  it("should reject external manual members", () => {
    const result = createMemberSchema.safeParse({ kind: "external", displayName: "Contato" });
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

describe("contact invite schemas", () => {
  it("should accept a versioned QR payload", () => {
    const result = contactInviteQrPayloadSchema.safeParse({
      type: "telefoninho-contact",
      version: 1,
      token: "a".repeat(32),
    });
    expect(result.success).toBe(true);
  });

  it("should reject QR payloads with secrets or wrong type", () => {
    const result = contactInviteQrPayloadSchema.safeParse({
      type: "telefoninho-pairing",
      version: 1,
      token: "a".repeat(32),
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  it("should accept contact invite claims", () => {
    const result = claimContactInviteSchema.safeParse({
      token: "b".repeat(32),
      requesterMemberId: "member_1",
    });
    expect(result.success).toBe(true);
  });

  it("should reject short invite tokens", () => {
    const result = claimContactInviteSchema.safeParse({
      token: "short",
      requesterMemberId: "member_1",
    });
    expect(result.success).toBe(false);
  });

  it("should accept an empty resolver body", () => {
    expect(resolveContactRequestSchema.safeParse({}).success).toBe(true);
  });
});
