import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(mkdtempSync(join(tmpdir(), "telefoninho-contact-invites-")), "test.db");
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.JWT_SECRET = "test-secret";

let apiDb: typeof import("../db/index.js");
let registerContactInviteRoutes: typeof import("../routes/contact-invites.js").registerContactInviteRoutes;

function applyMigration(path: string): void {
  const sqlite = new Database(databasePath);
  sqlite.exec(readFileSync(path, "utf8").replaceAll("--> statement-breakpoint", ""));
  sqlite.close();
}

function now(): Date {
  return new Date("2030-06-25T12:00:00.000Z");
}

function sign(payload: Record<string, string>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET!)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function parentHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${sign({ sub: "parent_1", email: "parent@test.com", kind: "parent", role: "responsible" })}` };
}

function childHeaders(memberId = "child_1"): Record<string, string> {
  return { Authorization: `Bearer ${sign({ sub: memberId, kind: "child" })}` };
}

function insertMember(id: string, kind: "child" | "adult", familyId = "family_1"): void {
  apiDb.db.insert(apiDb.familyMembers).values({
    id,
    familyId,
    kind,
    displayName: id,
    avatarKey: "star_pixel_01",
    colorKey: "green",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
}

function createServer(): FastifyInstance {
  const server = fastify();
  registerContactInviteRoutes(server);
  return server;
}

beforeAll(async () => {
  applyMigration("drizzle/0000_nebulous_joystick.sql");
  applyMigration("drizzle/0001_contact_invites.sql");
  applyMigration("drizzle/0002_asterisk_config_state.sql");
  applyMigration("drizzle/0003_multi_family_access.sql");
  apiDb = await import("../db/index.js");
  const routes = await import("../routes/contact-invites.js");
  registerContactInviteRoutes = routes.registerContactInviteRoutes;
});

beforeEach(() => {
  apiDb.db.delete(apiDb.asteriskConfigState).run();
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.contactRequests).run();
  apiDb.db.delete(apiDb.contactInvites).run();
  apiDb.db.delete(apiDb.familyResponsibles).run();
  apiDb.db.delete(apiDb.parentUsers).run();
  apiDb.db.delete(apiDb.familyMembers).run();
  apiDb.db.delete(apiDb.families).run();
  apiDb.db.insert(apiDb.families).values({
    id: "family_1",
    name: "Demo",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.parentUsers).values({
    id: "parent_1",
    email: "parent@test.com",
    passwordHash: "hash",
    displayName: "Parent",
    role: "responsible",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.familyResponsibles).values({
    id: "link_1",
    familyId: "family_1",
    parentUserId: "parent_1",
    createdAt: now(),
    updatedAt: now(),
  }).run();
  insertMember("child_1", "child");
  insertMember("adult_1", "adult");
  insertMember("adult_2", "adult");
});

describe("contact invite routes", () => {
  it("creates contact invites from an empty json payload", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/members/adult_1/contact-invite",
      headers: parentHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().qrPayload.type).toBe("telefoninho-contact");
    await server.close();
  });

  it("rejects invalid tokens", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-invites/claim",
      headers: childHeaders(),
      payload: { token: "x".repeat(32), requesterMemberId: "child_1" },
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  it("rejects expired invites", async () => {
    apiDb.db.insert(apiDb.contactInvites).values({
      id: "invite_1",
      targetMemberId: "adult_1",
      token: "t".repeat(32),
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      createdAt: now(),
    }).run();

    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-invites/claim",
      headers: childHeaders(),
      payload: { token: "t".repeat(32), requesterMemberId: "child_1" },
    });

    expect(response.statusCode).toBe(400);
    await server.close();
  });

  it("creates one pending request for repeated child scans", async () => {
    apiDb.db.insert(apiDb.contactInvites).values({
      id: "invite_1",
      targetMemberId: "adult_1",
      token: "p".repeat(32),
      expiresAt: new Date("2030-06-25T13:00:00.000Z"),
      createdAt: now(),
    }).run();

    const server = createServer();
    const payload = { token: "p".repeat(32), requesterMemberId: "child_1" };
    const first = await server.inject({ method: "POST", url: "/contact-invites/claim", headers: childHeaders(), payload });
    const second = await server.inject({ method: "POST", url: "/contact-invites/claim", headers: childHeaders(), payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(apiDb.db.select().from(apiDb.contactRequests).all()).toHaveLength(1);
    expect(first.json().status).toBe("pending");
    await server.close();
  });

  it("approves a pending request and creates allowed call", async () => {
    apiDb.db.insert(apiDb.contactInvites).values({
      id: "invite_1",
      targetMemberId: "adult_1",
      token: "a".repeat(32),
      expiresAt: new Date("2030-06-25T13:00:00.000Z"),
      createdAt: now(),
    }).run();
    apiDb.db.insert(apiDb.contactRequests).values({
      id: "request_1",
      inviteId: "invite_1",
      familyId: "family_1",
      requesterMemberId: "child_1",
      targetMemberId: "adult_1",
      status: "pending",
      createdAt: now(),
      updatedAt: now(),
    }).run();

    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-requests/request_1/approve",
      headers: parentHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("approved");
    expect(apiDb.db.select().from(apiDb.allowedCalls).all()).toHaveLength(1);
    expect(apiDb.db.select().from(apiDb.asteriskConfigState).get()?.pending).toBe(true);
    await server.close();
  });

  it("auto-approves adult to adult scans", async () => {
    apiDb.db.insert(apiDb.contactInvites).values({
      id: "invite_1",
      targetMemberId: "adult_1",
      token: "d".repeat(32),
      expiresAt: new Date("2030-06-25T13:00:00.000Z"),
      createdAt: now(),
    }).run();

    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-invites/claim",
      headers: childHeaders("adult_2"),
      payload: { token: "d".repeat(32), requesterMemberId: "adult_2" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("auto_approved");
    expect(apiDb.db.select().from(apiDb.allowedCalls).all()).toHaveLength(1);
    expect(apiDb.db.select().from(apiDb.asteriskConfigState).get()?.pending).toBe(true);
    await server.close();
  });
});
