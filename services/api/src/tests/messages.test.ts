import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const databasePath = join(mkdtempSync(join(tmpdir(), "telefoninho-messages-")), "test.db");
process.env.DATABASE_URL = `file:${databasePath}`;
process.env.JWT_SECRET = "test-secret";

let apiDb: typeof import("../db/index.js");
let registerMessageRoutes: typeof import("../routes/messages.js").registerMessageRoutes;
let signToken: typeof import("../auth-context.js").signToken;

function applyMigration(path: string): void {
  const sqlite = new Database(databasePath);
  sqlite.exec(readFileSync(path, "utf8").replaceAll("--> statement-breakpoint", ""));
  sqlite.close();
}

function now(): Date {
  return new Date("2030-06-25T12:00:00.000Z");
}

function createServer(): FastifyInstance {
  const server = fastify();
  registerMessageRoutes(server);
  return server;
}

function childToken(memberId: string): string {
  return signToken({ sub: memberId, kind: "child" });
}

beforeAll(async () => {
  for (const migration of [
    "0000_nebulous_joystick.sql",
    "0001_contact_invites.sql",
    "0002_asterisk_config_state.sql",
    "0003_multi_family_access.sql",
    "0004_short_messages.sql",
    "0005_beta_access.sql",
  ]) applyMigration(`drizzle/${migration}`);
  apiDb = await import("../db/index.js");
  registerMessageRoutes = (await import("../routes/messages.js")).registerMessageRoutes;
  signToken = (await import("../auth-context.js")).signToken;
});

beforeEach(() => {
  apiDb.db.delete(apiDb.shortMessages).run();
  apiDb.db.delete(apiDb.allowedCalls).run();
  apiDb.db.delete(apiDb.familySetups).run();
  apiDb.db.delete(apiDb.memberDevices).run();
  apiDb.db.delete(apiDb.familyMembers).run();
  apiDb.db.delete(apiDb.families).run();

  apiDb.db.insert(apiDb.families).values({
    id: "family_1", name: "Demo", active: true, createdAt: now(), updatedAt: now(),
  }).run();
  for (const member of [
    { id: "child_1", displayName: "Tereza" },
    { id: "child_2", displayName: "Pedro" },
    { id: "child_3", displayName: "Maria" },
  ]) {
    apiDb.db.insert(apiDb.familyMembers).values({
      ...member,
      familyId: "family_1",
      kind: "child",
      avatarKey: "star_pixel_01",
      colorKey: "green",
      active: true,
      createdAt: now(),
      updatedAt: now(),
    }).run();
  }
  apiDb.db.insert(apiDb.allowedCalls).values({
    id: "rule_1",
    familyId: "family_1",
    fromMemberId: "child_1",
    toMemberId: "child_2",
    enabled: true,
    createdAt: now(),
    updatedAt: now(),
  }).run();
});

describe("short message routes", () => {
  it("sends and lists a message for an allowed contact", async () => {
    const server = createServer();
    const sent = await server.inject({
      method: "POST",
      url: "/child/messages",
      headers: { authorization: `Bearer ${childToken("child_1")}` },
      payload: { toMemberId: "child_2", body: "  Cheguei!  " },
    });
    expect(sent.statusCode).toBe(201);
    expect(sent.json()).toMatchObject({
      fromDisplayName: "Tereza",
      toDisplayName: "Pedro",
      body: "Cheguei!",
    });

    const listed = await server.inject({
      method: "GET",
      url: "/child/messages",
      headers: { authorization: `Bearer ${childToken("child_2")}` },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0].body).toBe("Cheguei!");
    await server.close();
  });

  it("rejects sending to a contact without permission", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "POST",
      url: "/child/messages",
      headers: { authorization: `Bearer ${childToken("child_1")}` },
      payload: { toMemberId: "child_3", body: "Oi" },
    });
    expect(response.statusCode).toBe(403);
    expect(apiDb.db.select().from(apiDb.shortMessages).all()).toHaveLength(0);
    await server.close();
  });

  it("lets either participant delete a message", async () => {
    apiDb.db.insert(apiDb.shortMessages).values({
      id: "message_1",
      familyId: "family_1",
      fromMemberId: "child_1",
      toMemberId: "child_2",
      body: "Apagar",
      createdAt: now(),
    }).run();
    const server = createServer();
    const response = await server.inject({
      method: "DELETE",
      url: "/child/messages/message_1",
      headers: { authorization: `Bearer ${childToken("child_2")}` },
    });
    expect(response.statusCode).toBe(204);
    expect(apiDb.db.select().from(apiDb.shortMessages).all()).toHaveLength(0);
    await server.close();
  });
});
