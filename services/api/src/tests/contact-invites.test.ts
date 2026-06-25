import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(mkdtempSync(join(tmpdir(), "telefoninho-contact-invites-")), "test.db");
process.env.DATABASE_URL = `file:${databasePath}`;

let apiDb: typeof import("../db/index.js");
let registerContactInviteRoutes: typeof import("../routes/contact-invites.js").registerContactInviteRoutes;

function applyMigration(path: string): void {
  const sqlite = new Database(databasePath);
  sqlite.exec(readFileSync(path, "utf8").replaceAll("--> statement-breakpoint", ""));
  sqlite.close();
}

function now(): Date {
  return new Date("2026-06-25T12:00:00.000Z");
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
  apiDb = await import("../db/index.js");
  const routes = await import("../routes/contact-invites.js");
  registerContactInviteRoutes = routes.registerContactInviteRoutes;
});

beforeEach(() => {
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.contactRequests).run();
  apiDb.db.delete(apiDb.contactInvites).run();
  apiDb.db.delete(apiDb.familyMembers).run();
  apiDb.db.delete(apiDb.families).run();
  apiDb.db.insert(apiDb.families).values({
    id: "family_1",
    name: "Demo",
    createdAt: now(),
    updatedAt: now(),
  }).run();
  insertMember("child_1", "child");
  insertMember("adult_1", "adult");
  insertMember("adult_2", "adult");
});

describe("contact invite routes", () => {
  it("rejects invalid tokens", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-invites/claim",
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
      expiresAt: new Date("2026-06-25T13:00:00.000Z"),
      createdAt: now(),
    }).run();

    const server = createServer();
    const payload = { token: "p".repeat(32), requesterMemberId: "child_1" };
    const first = await server.inject({ method: "POST", url: "/contact-invites/claim", payload });
    const second = await server.inject({ method: "POST", url: "/contact-invites/claim", payload });

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
      expiresAt: new Date("2026-06-25T13:00:00.000Z"),
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
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("approved");
    expect(apiDb.db.select().from(apiDb.allowedCalls).all()).toHaveLength(1);
    await server.close();
  });

  it("auto-approves adult to adult scans", async () => {
    apiDb.db.insert(apiDb.contactInvites).values({
      id: "invite_1",
      targetMemberId: "adult_1",
      token: "d".repeat(32),
      expiresAt: new Date("2026-06-25T13:00:00.000Z"),
      createdAt: now(),
    }).run();

    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/contact-invites/claim",
      payload: { token: "d".repeat(32), requesterMemberId: "adult_2" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("auto_approved");
    expect(apiDb.db.select().from(apiDb.allowedCalls).all()).toHaveLength(1);
    await server.close();
  });
});
