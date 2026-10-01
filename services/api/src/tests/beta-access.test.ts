import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import fastify from "fastify";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrateDatabase } from "../../scripts/migrate.js";

const root = mkdtempSync(join(tmpdir(), "telefoninho-beta-"));
const path = join(root, "test.db");
process.env.DATABASE_URL = `file:${path}`;
process.env.JWT_SECRET = "test-beta-secret";
process.env.PARENT_WEB_URL = "http://localhost:3000";
process.env.ASTERISK_RELOAD_MODE = "skip";
process.env.ASTERISK_CONFIG_DIR = join(root, "config");
let database: typeof import("../db/index.js");
let auth: typeof import("../auth-context.js");
let mail: typeof import("../email.js");
let access: typeof import("../routes/access.js");
let registerAuth: typeof import("../routes/auth.js").registerAuthRoutes;
let registerFamilies: typeof import("../routes/families.js").registerFamilyRoutes;
let registerOnboarding: typeof import("../routes/onboarding.js").registerOnboardingRoutes;
let registerPairing: typeof import("../routes/pairing.js").registerPairingRoutes;
let registerChild: typeof import("../routes/child.js").registerChildRoutes;
let registerSecurity: typeof import("../web-security.js").registerWebSecurity;
let reconcile: typeof import("../asterisk-worker.js").reconcileAsterisk;

beforeAll(async () => {
  await migrateDatabase(path);
  database = await import("../db/index.js"); auth = await import("../auth-context.js"); mail = await import("../email.js"); access = await import("../routes/access.js");
  registerAuth = (await import("../routes/auth.js")).registerAuthRoutes;
  registerFamilies = (await import("../routes/families.js")).registerFamilyRoutes;
  registerOnboarding = (await import("../routes/onboarding.js")).registerOnboardingRoutes;
  registerPairing = (await import("../routes/pairing.js")).registerPairingRoutes;
  registerChild = (await import("../routes/child.js")).registerChildRoutes;
  registerSecurity = (await import("../web-security.js")).registerWebSecurity;
  reconcile = (await import("../asterisk-worker.js")).reconcileAsterisk;
});
beforeEach(() => {
  const sqlite = new Database(path);
  sqlite.exec("DELETE FROM email_outbox; DELETE FROM access_link; DELETE FROM family_setup; DELETE FROM member_device; DELETE FROM pairing_code; DELETE FROM allowed_call; DELETE FROM sip_account; DELETE FROM family_responsible; DELETE FROM family_member; DELETE FROM family; DELETE FROM parent_user; DELETE FROM asterisk_config_state;"); sqlite.close();
  const now = new Date();
  database.db.insert(database.parentUsers).values({ id: "admin", email: "admin@test.com", displayName: "Admin", role: "admin", passwordHash: auth.hashPassword("test-password"), createdAt: now, updatedAt: now }).run();
});
function server() {
  const instance = fastify(); registerSecurity(instance); registerAuth(instance); access.registerAccessRoutes(instance); registerFamilies(instance); registerOnboarding(instance); registerPairing(instance); registerChild(instance);
  return instance;
}
function header(id = "admin") { return { Authorization: `Bearer ${auth.signToken({ sub: id, kind: "parent" })}` }; }
function invitation(email = "parent@test.com", purpose: "beta" | "responsible" | "reset" = "beta", familyId: string | null = null) {
  const info = access.issueLink(email, purpose, familyId, "admin");
  const row = database.db.select().from(database.emailOutbox).where(eq(database.emailOutbox.linkId, info.id)).get();
  if (!row) throw new Error("Missing mail");
  const token = mail.openMail(row.encryptedPayload).text.match(/#token=([\w-]+)/)?.[1];
  if (!token) throw new Error("Missing token");
  return { ...info, token };
}
async function createFamily(instance = server()) {
  const invite = invitation();
  const response = await instance.inject({ method: "POST", url: "/auth/register", payload: { token: invite.token, displayName: "Parent", password: "parent-password", acceptedPolicy: true, role: "admin" } });
  const result = response.json();
  const cookie = String(response.headers["set-cookie"]).split(";")[0];
  return { instance, invite, response, userId: String(result.parent.id), familyId: String(result.families[0].id), cookie };
}

describe("closed beta access", () => {
  it("does not let exhausted email retries block newer invitations", async () => {
    for (let index = 0; index < 10; index++) invitation(`failed${index}@test.com`);
    database.db.update(database.emailOutbox).set({ attempts: 8, nextAttemptAt: new Date(0) }).run();
    invitation("next@test.com");
    let delivered = 0;
    await mail.deliverOutbox(async () => { delivered++; });
    expect(delivered).toBe(1);
  });
  it("requires admin to issue beta invitations and normalizes email", async () => {
    const instance = server();
    expect((await instance.inject({ method: "POST", url: "/admin/beta-invitations", payload: { email: "user@test.com" } })).statusCode).toBe(401);
    const response = await instance.inject({ method: "POST", url: "/admin/beta-invitations", headers: header(), payload: { email: "User@TEST.com" } });
    expect(response.json().email).toBe("user@test.com"); expect(response.json().token).toBeUndefined();
  });
  it("proves email by invitation, creates only responsible, keeps JWT out of response and consumes once", async () => {
    const { instance, response, invite, cookie } = await createFamily();
    expect(response.statusCode).toBe(200); expect(response.json().parent.role).toBe("responsible"); expect(response.json().token).toBeUndefined();
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect((await instance.inject({ method: "GET", url: "/auth/me", headers: { cookie } })).statusCode).toBe(200);
    expect((await instance.inject({ method: "POST", url: "/auth/register", payload: { token: invite.token, displayName: "Again", password: "parent-password", acceptedPolicy: true } })).statusCode).toBe(400);
    const user = database.db.select().from(database.parentUsers).where(eq(database.parentUsers.email, "parent@test.com")).get();
    expect(user?.emailVerifiedAt).not.toBeNull(); expect(user?.passwordHash).toMatch(/^scrypt:/);
  });
  it("viewing a link does not consume it and revoked/expired links cannot register", async () => {
    const instance = server(); const invite = invitation();
    expect((await instance.inject({ method: "POST", url: "/auth/invitation", payload: { token: invite.token } })).statusCode).toBe(200);
    expect(database.db.select().from(database.accessLinks).get()?.usedAt).toBeNull();
    database.db.update(database.accessLinks).set({ expiresAt: new Date(0) }).run();
    expect((await instance.inject({ method: "POST", url: "/auth/invitation", payload: { token: invite.token } })).statusCode).toBe(400);
    const second = invitation(); database.db.update(database.accessLinks).set({ revokedAt: new Date() }).where(eq(database.accessLinks.id, second.id)).run();
    expect((await instance.inject({ method: "POST", url: "/auth/invitation", payload: { token: second.token } })).statusCode).toBe(400);
  });
  it("rejects short passwords and missing responsibility acceptance", async () => {
    const instance = server(); const invite = invitation();
    for (const values of [{ password: "short", acceptedPolicy: true }, { password: "long-password", acceptedPolicy: false }]) {
      expect((await instance.inject({ method: "POST", url: "/auth/register", payload: { token: invite.token, displayName: "Parent", ...values } })).statusCode).toBe(400);
    }
  });
  it("does not allow the old add-responsible endpoint to overwrite another account", async () => {
    const { instance, userId, familyId } = await createFamily();
    const before = database.db.select().from(database.parentUsers).where(eq(database.parentUsers.id, "admin")).get();
    const response = await instance.inject({ method: "POST", url: `/families/${familyId}/responsibles`, headers: header(userId), payload: { email: "admin@test.com", displayName: "Attacker", password: "attacker-password" } });
    expect(response.statusCode).toBe(410);
    expect(database.db.select().from(database.parentUsers).where(eq(database.parentUsers.id, "admin")).get()).toEqual(before);
    expect((await instance.inject({ method: "PATCH", url: "/responsibles/admin", headers: header(userId), payload: { password: "attacker-password" } })).statusCode).toBe(403);
  });
  it("invites existing users without changing identity and requires matching authenticated recipient", async () => {
    const { instance, userId, familyId } = await createFamily();
    const invite = invitation("admin@test.com", "responsible", familyId);
    expect((await instance.inject({ method: "POST", url: "/auth/accept-invitation", headers: header(userId), payload: { token: invite.token } })).statusCode).toBe(400);
    expect((await instance.inject({ method: "POST", url: "/auth/register", payload: { token: invite.token, displayName: "Bad", password: "new-password", acceptedPolicy: true } })).statusCode).toBe(409);
    expect((await instance.inject({ method: "POST", url: "/auth/accept-invitation", headers: header(), payload: { token: invite.token } })).statusCode).toBe(200);
    expect(database.db.select().from(database.parentUsers).where(eq(database.parentUsers.id, "admin")).get()?.displayName).toBe("Admin");
  });
  it("returns a generic recovery response and reset revokes old sessions and cannot be reused", async () => {
    const { instance, userId, cookie } = await createFamily();
    const before = await instance.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "missing@test.com" } });
    const existing = await instance.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "parent@test.com" } });
    expect(before.json()).toEqual(existing.json());
    const invite = invitation("parent@test.com", "reset");
    expect((await instance.inject({ method: "POST", url: "/auth/reset-password", payload: { token: invite.token, password: "replacement-password" } })).statusCode).toBe(200);
    expect((await instance.inject({ method: "GET", url: "/auth/me", headers: { cookie } })).statusCode).toBe(401);
    expect((await instance.inject({ method: "POST", url: "/auth/reset-password", payload: { token: invite.token, password: "replacement-password" } })).statusCode).toBe(400);
    expect(database.db.select().from(database.parentUsers).where(eq(database.parentUsers.id, userId)).get()?.authVersion).toBe(1);
  });
  it("migrates legacy password hashes on successful login", async () => {
    database.db.update(database.parentUsers).set({ passwordHash: crypto.createHash("sha256").update("old-password").digest("hex") }).run();
    const response = await server().inject({ method: "POST", url: "/auth/login", payload: { email: "ADMIN@test.com", password: "old-password" } });
    expect(response.statusCode).toBe(200); expect(database.db.select().from(database.parentUsers).get()?.passwordHash).toMatch(/^scrypt:/);
  });
  it("rejects CSRF and throttles guesses", async () => {
    const { instance, cookie } = await createFamily();
    expect((await instance.inject({ method: "POST", url: "/auth/logout", headers: { cookie, origin: "https://evil.test" }, payload: {} })).statusCode).toBe(403);
    for (let index = 0; index < 10; index++) await instance.inject({ method: "POST", url: "/auth/login", payload: { email: "missing@test.com", password: "wrong" } });
    expect((await instance.inject({ method: "POST", url: "/auth/login", payload: { email: "missing@test.com", password: "wrong" } })).statusCode).toBe(429);
  });
  it("retries failed mail without plaintext tokens in the outbox and cancels revoked mail", async () => {
    const invite = invitation();
    expect(database.db.select().from(database.emailOutbox).get()?.encryptedPayload).not.toContain(invite.token);
    await mail.deliverOutbox(async () => { throw new Error("provider failed"); });
    expect(database.db.select().from(database.emailOutbox).get()?.attempts).toBe(1);
    database.db.update(database.emailOutbox).set({ nextAttemptAt: new Date(0) }).run();
    let delivered = 0; await mail.deliverOutbox(async () => { delivered++; }); expect(delivered).toBe(1);
    expect(database.db.select().from(database.emailOutbox).get()?.encryptedPayload).toBe("");
    const second = invitation("other@test.com"); database.db.update(database.accessLinks).set({ revokedAt: new Date() }).where(eq(database.accessLinks.id, second.id)).run();
    await mail.deliverOutbox(async () => { delivered++; }); expect(delivered).toBe(1);
  });
  it("resumes idempotent family setup, pairs two devices and invalidates a removed device", async () => {
    const { instance, familyId, userId } = await createFamily();
    const input = { familyName: "Família Teste", childName: "Criança", adultName: "Adulto", allowCalls: true };
    for (let index = 0; index < 2; index++) expect((await instance.inject({ method: "POST", url: `/families/${familyId}/onboarding`, headers: header(userId), payload: input })).statusCode).toBe(200);
    expect(database.db.select().from(database.familyMembers).all()).toHaveLength(2); expect(database.db.select().from(database.allowedCalls).all()).toHaveLength(2);
    const members = database.db.select().from(database.familyMembers).all(); let deviceToken = "";
    for (const member of members) {
      const code = (await instance.inject({ method: "POST", url: `/members/${member.id}/pairing-code`, headers: header(userId), payload: {} })).json().code;
      const response = await instance.inject({ method: "POST", url: "/pairing/claim", payload: { code, deviceName: "Android Teste", deviceId: member.id } });
      expect(response.statusCode).toBe(200); if (member.kind === "child") deviceToken = response.json().token;
    }
    await reconcile();
    expect((await instance.inject({ method: "POST", url: `/families/${familyId}/onboarding/confirm-call`, headers: header(userId), payload: { audioBothWays: true } })).statusCode).toBe(200);
    expect((await instance.inject({ method: "GET", url: `/families/${familyId}/onboarding`, headers: header(userId) })).json().firstCallConfirmedAt).not.toBeNull();
    const child = members.find((member) => member.kind === "child"); if (!child) throw new Error("Missing child");
    const pendingCode = (await instance.inject({ method: "POST", url: `/members/${child.id}/pairing-code`, headers: header(userId), payload: {} })).json().code;
    const oldPassword = database.db.select().from(database.sipAccounts).where(eq(database.sipAccounts.familyMemberId, child.id)).get()?.plaintextPassword;
    await instance.inject({ method: "POST", url: `/members/${child.id}/unpair`, headers: header(userId), payload: {} });
    expect(database.db.select().from(database.sipAccounts).where(eq(database.sipAccounts.familyMemberId, child.id)).get()?.plaintextPassword).not.toBe(oldPassword);
    expect((await instance.inject({ method: "POST", url: "/pairing/claim", payload: { code: pendingCode, deviceName: "Old device", deviceId: "old" } })).statusCode).toBe(400);
    expect((await instance.inject({ method: "GET", url: "/child/config", headers: { Authorization: `Bearer ${deviceToken}` } })).statusCode).toBe(401);
  });
});
