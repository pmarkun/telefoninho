import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(mkdtempSync(join(tmpdir(), "telefoninho-families-access-")), "test.db");
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.JWT_SECRET = "test-secret";

let apiDb: typeof import("../db/index.js");
let registerFamilyRoutes: typeof import("../routes/families.js").registerFamilyRoutes;
let registerMemberRoutes: typeof import("../routes/members.js").registerMemberRoutes;
let registerAllowedCallRoutes: typeof import("../routes/allowed-calls.js").registerAllowedCallRoutes;

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
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600, v: 0 })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET!)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function headers(userId: string, role: "admin" | "responsible"): Record<string, string> {
  return { Authorization: `Bearer ${sign({ sub: userId, email: `${userId}@test.com`, kind: "parent", role })}` };
}

function createServer(): FastifyInstance {
  const server = fastify();
  registerFamilyRoutes(server);
  registerMemberRoutes(server);
  registerAllowedCallRoutes(server);
  return server;
}

beforeAll(async () => {
  applyMigration("drizzle/0000_nebulous_joystick.sql");
  applyMigration("drizzle/0001_contact_invites.sql");
  applyMigration("drizzle/0002_asterisk_config_state.sql");
  applyMigration("drizzle/0003_multi_family_access.sql");
  applyMigration("drizzle/0005_beta_access.sql");
  apiDb = await import("../db/index.js");
  const familyRoutes = await import("../routes/families.js");
  const memberRoutes = await import("../routes/members.js");
  const allowedCallRoutes = await import("../routes/allowed-calls.js");
  registerFamilyRoutes = familyRoutes.registerFamilyRoutes;
  registerMemberRoutes = memberRoutes.registerMemberRoutes;
  registerAllowedCallRoutes = allowedCallRoutes.registerAllowedCallRoutes;
});

beforeEach(() => {
  apiDb.db.delete(apiDb.asteriskConfigState).run();
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.sipAccounts).run();
  apiDb.db.delete(apiDb.familyResponsibles).run();
  apiDb.db.delete(apiDb.parentUsers).run();
  apiDb.db.delete(apiDb.familySetups).run();
  apiDb.db.delete(apiDb.memberDevices).run();
  apiDb.db.delete(apiDb.familyMembers).run();
  apiDb.db.delete(apiDb.families).run();

  for (const family of [
    { id: "family_1", name: "Família 1" },
    { id: "family_2", name: "Família 2" },
  ]) {
    apiDb.db.insert(apiDb.families).values({
      ...family,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();
  }

  for (const user of [
    { id: "admin_1", email: "admin_1@test.com", role: "admin" },
    { id: "parent_1", email: "parent_1@test.com", role: "responsible" },
  ]) {
    apiDb.db.insert(apiDb.parentUsers).values({
      id: user.id,
      email: user.email,
      passwordHash: "hash",
      displayName: user.id,
      role: user.role,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();
  }

  apiDb.db.insert(apiDb.familyResponsibles).values({
    id: "link_1",
    familyId: "family_1",
    parentUserId: "parent_1",
    createdAt: now(),
    updatedAt: now(),
  }).run();

  for (const member of [
    { id: "member_1", familyId: "family_1" },
    { id: "member_2", familyId: "family_2" },
  ]) {
    apiDb.db.insert(apiDb.familyMembers).values({
      id: member.id,
      familyId: member.familyId,
      kind: "child",
      displayName: member.id,
      avatarKey: "star_pixel_01",
      colorKey: "green",
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();

    apiDb.db.insert(apiDb.sipAccounts).values({
      id: `sip_${member.id}`,
      familyMemberId: member.id,
      extension: member.id === "member_1" ? "1001" : "2001",
      username: member.id === "member_1" ? "1001" : "2001",
      passwordHashOrEncrypted: "hash",
      plaintextPassword: "secret",
      domain: "sip.test",
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();
  }
});

describe("family access control", () => {
  it("limits responsible users to linked families", async () => {
    const server = createServer();
    const families = await server.inject({ method: "GET", url: "/families", headers: headers("parent_1", "responsible") });
    const ownMembers = await server.inject({ method: "GET", url: "/families/family_1/members", headers: headers("parent_1", "responsible") });
    const otherMembers = await server.inject({ method: "GET", url: "/families/family_2/members", headers: headers("parent_1", "responsible") });

    expect(families.statusCode).toBe(200);
    expect(families.json().map((family: { id: string }) => family.id)).toEqual(["family_1"]);
    expect(ownMembers.statusCode).toBe(200);
    expect(otherMembers.statusCode).toBe(403);
    await server.close();
  });

  it("lets admins see every active family", async () => {
    const server = createServer();
    const response = await server.inject({ method: "GET", url: "/families", headers: headers("admin_1", "admin") });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((family: { id: string }) => family.id).sort()).toEqual(["family_1", "family_2"]);
    await server.close();
  });

  it("links newly-created families to responsible creators", async () => {
    const server = createServer();
    const create = await server.inject({
      method: "POST",
      url: "/families",
      headers: headers("parent_1", "responsible"),
      payload: { name: "Nova família" },
    });
    const families = await server.inject({ method: "GET", url: "/families", headers: headers("parent_1", "responsible") });

    expect(create.statusCode).toBe(200);
    expect(families.json().map((family: { name: string }) => family.name)).toContain("Nova família");
    await server.close();
  });

  it("soft deletes families and marks VoIP config pending", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "DELETE",
      url: "/families/family_1",
      headers: headers("parent_1", "responsible"),
    });
    const families = await server.inject({ method: "GET", url: "/families", headers: headers("parent_1", "responsible") });

    expect(response.statusCode).toBe(200);
    expect(families.json()).toHaveLength(0);
    expect(apiDb.db.select().from(apiDb.asteriskConfigState).get()?.pending).toBe(true);
    await server.close();
  });

  it("returns cross-family allowed calls as external contacts", async () => {
    apiDb.db.insert(apiDb.allowedCalls).values({
      id: "rule_external",
      familyId: "family_1",
      fromMemberId: "member_1",
      toMemberId: "member_2",
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();

    const server = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/families/family_1/permissions",
      headers: headers("parent_1", "responsible"),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().members.map((member: { id: string }) => member.id)).toEqual(["member_1"]);
    expect(response.json().externalContacts).toEqual([
      expect.objectContaining({
        ruleId: "rule_external",
        fromMemberId: "member_1",
        toMemberId: "member_2",
        displayName: "member_2",
        kind: "external",
        sipExtension: "2001",
        enabled: true,
      }),
    ]);
    await server.close();
  });
});
