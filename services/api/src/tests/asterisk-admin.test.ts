import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testRoot = mkdtempSync(join(tmpdir(), "telefoninho-asterisk-admin-"));
const databasePath = join(testRoot, "test.db");
const configDir = join(testRoot, "asterisk-config");

process.env.DATABASE_URL = `file:${databasePath}`;
process.env.ASTERISK_CONFIG_DIR = configDir;
process.env.ASTERISK_RELOAD_MODE = "skip";
process.env.JWT_SECRET = "test-secret";

let apiDb: typeof import("../db/index.js");
let registerAdminRoutes: typeof import("../routes/admin.js").registerAdminRoutes;
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
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET!)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${sign({ sub: "parent_1", email: "parent@test.com", kind: "parent", role: "admin" })}` };
}

function createServer(): FastifyInstance {
  const server = fastify();
  registerAdminRoutes(server);
  registerAllowedCallRoutes(server);
  return server;
}

function insertMember(id: string, extension: string): void {
  apiDb.db.insert(apiDb.familyMembers).values({
    id,
    familyId: "family_1",
    kind: "child",
    displayName: id,
    avatarKey: "star_pixel_01",
    colorKey: "green",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.sipAccounts).values({
    id: `sip_${id}`,
    familyMemberId: id,
    extension,
    username: extension,
    passwordHashOrEncrypted: "hash",
    plaintextPassword: "secret",
    domain: "sip.example.test",
    enabled: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
}

beforeAll(async () => {
  applyMigration("drizzle/0000_nebulous_joystick.sql");
  applyMigration("drizzle/0001_contact_invites.sql");
  applyMigration("drizzle/0002_asterisk_config_state.sql");
  applyMigration("drizzle/0003_multi_family_access.sql");
  apiDb = await import("../db/index.js");
  const adminRoutes = await import("../routes/admin.js");
  const allowedCallRoutes = await import("../routes/allowed-calls.js");
  registerAdminRoutes = adminRoutes.registerAdminRoutes;
  registerAllowedCallRoutes = allowedCallRoutes.registerAllowedCallRoutes;
});

beforeEach(() => {
  process.env.ASTERISK_RELOAD_MODE = "skip";
  apiDb.db.delete(apiDb.asteriskConfigState).run();
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.sipAccounts).run();
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
    role: "admin",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  insertMember("child_1", "1001");
  insertMember("child_2", "1002");
});

describe("admin asterisk routes", () => {
  it("marks config pending after permission changes", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/allowed-calls",
      headers: authHeader(),
      payload: { fromMemberId: "child_1", toMemberId: "child_2", enabled: true },
    });
    const status = await server.inject({ method: "GET", url: "/admin/asterisk/status", headers: authHeader() });

    expect(response.statusCode).toBe(200);
    expect(status.json().pending).toBe(true);
    await server.close();
  });

  it("regenerates config files and clears pending status", async () => {
    const server = createServer();
    await server.inject({
      method: "POST",
      url: "/allowed-calls",
      headers: authHeader(),
      payload: { fromMemberId: "child_1", toMemberId: "child_2", enabled: true },
    });

    const response = await server.inject({ method: "POST", url: "/admin/asterisk/regenerate", headers: authHeader() });
    const status = await server.inject({ method: "GET", url: "/admin/asterisk/status", headers: authHeader() });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, generatedAccounts: 2 });
    expect(status.json().pending).toBe(false);
    expect(readFileSync(join(configDir, "extensions.generated.conf"), "utf8")).toContain("exten => 1002,1,Dial");
    await server.close();
  });

  it("keeps config pending when reload fails", async () => {
    process.env.ASTERISK_RELOAD_MODE = "fail";
    const server = createServer();
    await server.inject({
      method: "POST",
      url: "/allowed-calls",
      headers: authHeader(),
      payload: { fromMemberId: "child_1", toMemberId: "child_2", enabled: true },
    });

    const response = await server.inject({ method: "POST", url: "/admin/asterisk/regenerate", headers: authHeader() });
    const status = await server.inject({ method: "GET", url: "/admin/asterisk/status", headers: authHeader() });

    expect(response.statusCode).toBe(500);
    expect(status.json().pending).toBe(true);
    expect(status.json().lastError).toContain("Asterisk reload failed");
    await server.close();
  });
});
