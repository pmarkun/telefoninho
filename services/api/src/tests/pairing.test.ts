import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(mkdtempSync(join(tmpdir(), "telefoninho-pairing-")), "test.db");
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.JWT_SECRET = "test-secret";

let apiDb: typeof import("../db/index.js");
let registerPairingRoutes: typeof import("../routes/pairing.js").registerPairingRoutes;

function applyMigration(path: string): void {
  const sqlite = new Database(databasePath);
  sqlite.exec(readFileSync(path, "utf8").replaceAll("--> statement-breakpoint", ""));
  sqlite.close();
}

function now(): Date {
  return new Date("2026-06-25T12:00:00.000Z");
}

function createServer(): FastifyInstance {
  const server = fastify();
  registerPairingRoutes(server);
  return server;
}

beforeAll(async () => {
  applyMigration("drizzle/0000_nebulous_joystick.sql");
  applyMigration("drizzle/0001_contact_invites.sql");
  applyMigration("drizzle/0002_asterisk_config_state.sql");
  apiDb = await import("../db/index.js");
  const routes = await import("../routes/pairing.js");
  registerPairingRoutes = routes.registerPairingRoutes;
});

beforeEach(() => {
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.pairingCodes).run();
  apiDb.db.delete(apiDb.sipAccounts).run();
  apiDb.db.delete(apiDb.familyMembers).run();
  apiDb.db.delete(apiDb.families).run();

  apiDb.db.insert(apiDb.families).values({
    id: "family_1",
    name: "Demo",
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.familyMembers).values({
    id: "child_1",
    familyId: "family_1",
    kind: "child",
    displayName: "Pedro",
    avatarKey: "star_pixel_01",
    colorKey: "green",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.sipAccounts).values({
    id: "sip_1",
    familyMemberId: "child_1",
    extension: "1001",
    username: "1001",
    passwordHashOrEncrypted: "hash",
    plaintextPassword: "secret",
    domain: "sip.example.test",
    enabled: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
  apiDb.db.insert(apiDb.pairingCodes).values({
    id: "pair_1",
    familyMemberId: "child_1",
    code: "123456",
    expiresAt: new Date("2026-06-25T13:00:00.000Z"),
    createdAt: now(),
  }).run();
});

describe("pairing routes", () => {
  it("returns a child token when claiming a pairing code", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/pairing/claim",
      payload: { code: "123456", deviceName: "Pixel", deviceId: "device" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token.split(".")).toHaveLength(3);

    const payload = JSON.parse(Buffer.from(body.token.split(".")[1], "base64url").toString());
    expect(payload.sub).toBe("child_1");
    expect(payload.kind).toBe("child");
    await server.close();
  });
});
