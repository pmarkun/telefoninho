import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { familySetupSchema as setupSchema } from "@telefoninho/shared/beta";
import { allowedCalls, db, families, familyMembers, familySetups, memberDevices, pairingCodes, sipAccounts } from "../db/index.js";
import { cuid, requireFamilyAccess, requireMemberAccess } from "../auth-context.js";
import { getAsteriskConfigStatus, markAsteriskConfigPending } from "../asterisk-config-state.js";
import { generateSipPassword, hashSipPassword } from "../sip-auth.js";


export function registerOnboardingRoutes(server: FastifyInstance): void {
  server.get<{ Params: { familyId: string } }>("/families/:familyId/onboarding", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    const setup = db.select().from(familySetups).where(eq(familySetups.familyId, req.params.familyId)).get();
    const members = db.select({ id: familyMembers.id, displayName: familyMembers.displayName, kind: familyMembers.kind, deviceName: memberDevices.deviceName, pairedAt: memberDevices.pairedAt })
      .from(familyMembers).leftJoin(memberDevices, eq(memberDevices.memberId, familyMembers.id))
      .where(and(eq(familyMembers.familyId, req.params.familyId), eq(familyMembers.active, true))).all();
    const status = getAsteriskConfigStatus();
    return { configured: Boolean(setup), members, firstCallConfirmedAt: setup?.firstCallConfirmedAt || null, telephony: status.pending ? "preparing" : status.lastAppliedAt ? "ready" : "preparing", downloadUrl: process.env.ANDROID_BETA_DOWNLOAD_URL || null };
  });
  server.post<{ Params: { familyId: string } }>("/families/:familyId/onboarding", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    const input = setupSchema.parse(req.body);
    const family = db.select().from(families).where(and(eq(families.id, req.params.familyId), eq(families.active, true))).get();
    if (!family) return reply.status(404).send({ error: "Família indisponível." });
    if (db.select().from(familySetups).where(eq(familySetups.familyId, family.id)).get()) return { ok: true };
    if (db.select().from(familyMembers).where(eq(familyMembers.familyId, family.id)).get()) return reply.status(409).send({ error: "Esta família já tem contatos. Continue pelo painel de membros." });
    db.transaction((tx) => {
      const now = new Date();
      const childId = cuid();
      const adultId = cuid();
      for (const member of [{ id: childId, kind: "child", displayName: input.childName }, { id: adultId, kind: "adult", displayName: input.adultName }]) {
        let extension = String(crypto.randomInt(1001, 10000));
        while (tx.select().from(sipAccounts).where(eq(sipAccounts.extension, extension)).get()) extension = String(crypto.randomInt(1001, 10000));
        const password = generateSipPassword();
        tx.insert(familyMembers).values({ ...member, familyId: family.id, createdAt: now, updatedAt: now }).run();
        tx.insert(sipAccounts).values({ id: cuid(), familyMemberId: member.id, extension, username: extension, domain: process.env.ASTERISK_HOST || "127.0.0.1", plaintextPassword: password, passwordHashOrEncrypted: hashSipPassword(password), createdAt: now, updatedAt: now }).run();
      }
      for (const [fromMemberId, toMemberId] of [[childId, adultId], [adultId, childId]]) {
        tx.insert(allowedCalls).values({ id: cuid(), familyId: family.id, fromMemberId, toMemberId, enabled: true, createdAt: now, updatedAt: now }).run();
      }
      tx.update(families).set({ name: input.familyName, updatedAt: now }).where(eq(families.id, family.id)).run();
      tx.insert(familySetups).values({ familyId: family.id, childId, adultId }).run();
      markAsteriskConfigPending();
    });
    return { ok: true };
  });
  server.post<{ Params: { familyId: string } }>("/families/:familyId/onboarding/confirm-call", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    z.object({ audioBothWays: z.literal(true) }).parse(req.body);
    const setup = db.select().from(familySetups).where(eq(familySetups.familyId, req.params.familyId)).get();
    if (!setup) return reply.status(400).send({ error: "Configure a família primeiro." });
    const devices = db.select().from(memberDevices).where(or(eq(memberDevices.memberId, setup.childId), eq(memberDevices.memberId, setup.adultId))).all();
    const telephony = getAsteriskConfigStatus();
    if (devices.length !== 2 || telephony.pending || !telephony.lastAppliedAt) return reply.status(400).send({ error: "Aguarde a preparação e pareie os dois aparelhos antes de confirmar a chamada." });
    db.update(familySetups).set({ firstCallConfirmedAt: new Date() }).where(eq(familySetups.familyId, setup.familyId)).run();
    return { ok: true };
  });
  server.post<{ Params: { memberId: string } }>("/members/:memberId/unpair", async (req, reply) => {
    const access = requireMemberAccess(req, reply, req.params.memberId);
    if (!access) return reply;
    db.transaction((tx) => {
      tx.update(familyMembers).set({ tokenVersion: access.member.tokenVersion + 1 }).where(eq(familyMembers.id, access.member.id)).run();
      const password = generateSipPassword();
      tx.update(sipAccounts).set({ plaintextPassword: password, passwordHashOrEncrypted: hashSipPassword(password) }).where(eq(sipAccounts.familyMemberId, access.member.id)).run();
      tx.delete(memberDevices).where(eq(memberDevices.memberId, access.member.id)).run();
      tx.update(pairingCodes).set({ revokedAt: new Date() }).where(and(eq(pairingCodes.familyMemberId, access.member.id), isNull(pairingCodes.claimedAt))).run();
      tx.update(familySetups).set({ firstCallConfirmedAt: null }).where(eq(familySetups.familyId, access.member.familyId)).run();
      markAsteriskConfigPending();
    });
    return { ok: true };
  });
}
