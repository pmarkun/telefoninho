import { describe, it, expect } from "vitest";

describe("health route", () => {
  it("should return status ok", async () => {
    const response = await fetch("http://localhost:3001/health");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});

describe("login validation", () => {
  it("should reject missing email", async () => {
    const response = await fetch("http://localhost:3001/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test" }),
    });
    expect(response.status).toBe(400);
  });

  it("should reject missing password", async () => {
    const response = await fetch("http://localhost:3001/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com" }),
    });
    expect(response.status).toBe(400);
  });
});
