import { describe, it, expect } from "vitest";
import { generateSipPassword, hashSipPassword } from "../sip-auth";

describe("sip-auth", () => {
  it("should generate a password of 24 hex chars", () => {
    const pwd = generateSipPassword();
    expect(pwd).toHaveLength(24);
    expect(pwd).toMatch(/^[0-9a-f]+$/);
  });

  it("should hash consistently", () => {
    const hash1 = hashSipPassword("test123");
    const hash2 = hashSipPassword("test123");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different passwords", () => {
    const hash1 = hashSipPassword("password1");
    const hash2 = hashSipPassword("password2");
    expect(hash1).not.toBe(hash2);
  });
});
