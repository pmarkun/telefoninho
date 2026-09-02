import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { createMemberSchema, updateMemberSchema } from "@telefoninho/shared/validation";
import {
  allowedCalls,
  contactInvites,
  contactRequests,
  db,
  families,
  familyMembers,
  pairingCodes,
  sipAccounts,
} from "../db/index.js";
import { markAsteriskConfigPending } from "../asterisk-config-state.js";
import { requireFamilyAccess, requireMemberAccess } from "../auth-context.js";
import { generateSipExtension, generateSipPassword, hashSipPassword } from "../sip-auth.js";

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerMemberRoutes(server: FastifyInstance): void {
  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId/members",
    async (req, reply) => {
      if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
      const family = db.select().from(families).where(eq(families.id, req.params.familyId)).get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }

      const rows = db.select({
        id: familyMembers.id,
        familyId: familyMembers.familyId,
        kind: familyMembers.kind,
        displayName: familyMembers.displayName,
        avatarKey: familyMembers.avatarKey,
        colorKey: familyMembers.colorKey,
        active: familyMembers.active,
        sipExtension: sipAccounts.extension,
      })
        .from(familyMembers)
        .leftJoin(sipAccounts, eq(sipAccounts.familyMemberId, familyMembers.id))
        .where(eq(familyMembers.familyId, req.params.familyId))
        .orderBy(familyMembers.createdAt)
        .all();

      return rows;
    },
  );

  server.post<{ Params: { familyId: string } }>(
    "/families/:familyId/members",
    async (req, reply) => {
      if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
      const input = createMemberSchema.parse(req.body);

      const family = db.select().from(families).where(eq(families.id, req.params.familyId)).get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }

      const extension = generateSipExtension();
      const sipPassword = generateSipPassword();
      const passwordHash = hashSipPassword(sipPassword);
      const now = new Date();
      const memberId = cuid();
      const sipId = cuid();

      db.insert(familyMembers).values({
        id: memberId,
        familyId: req.params.familyId,
        kind: input.kind,
        displayName: input.displayName,
        avatarKey: input.avatarKey,
        colorKey: input.colorKey,
        active: true,
        createdAt: now,
        updatedAt: now,
      }).run();

      db.insert(sipAccounts).values({
        id: sipId,
        familyMemberId: memberId,
        extension,
        username: extension,
        passwordHashOrEncrypted: passwordHash,
        plaintextPassword: sipPassword,
        domain: process.env.ASTERISK_HOST || "127.0.0.1",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }).run();

      markAsteriskConfigPending();

      return {
        id: memberId,
        displayName: input.displayName,
        kind: input.kind,
        sip: { extension, password: sipPassword },
      };
    },
  );

  server.patch<{ Params: { memberId: string } }>(
    "/members/:memberId",
    async (req, reply) => {
      const input = updateMemberSchema.parse(req.body);

      const access = requireMemberAccess(req, reply, req.params.memberId);
      if (!access) return reply;

      db.update(familyMembers)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(familyMembers.id, req.params.memberId))
        .run();

      markAsteriskConfigPending();

      return db.select().from(familyMembers).where(eq(familyMembers.id, req.params.memberId)).get();
    },
  );

  server.delete<{ Params: { memberId: string } }>(
    "/members/:memberId",
    async (req, reply) => {
      const access = requireMemberAccess(req, reply, req.params.memberId);
      if (!access) return reply;

      db.delete(sipAccounts).where(eq(sipAccounts.familyMemberId, req.params.memberId)).run();
      db.delete(allowedCalls).where(eq(allowedCalls.fromMemberId, req.params.memberId)).run();
      db.delete(allowedCalls).where(eq(allowedCalls.toMemberId, req.params.memberId)).run();
      db.delete(pairingCodes).where(eq(pairingCodes.familyMemberId, req.params.memberId)).run();
      db.delete(contactRequests).where(eq(contactRequests.requesterMemberId, req.params.memberId)).run();
      db.delete(contactRequests).where(eq(contactRequests.targetMemberId, req.params.memberId)).run();
      db.delete(contactInvites).where(eq(contactInvites.targetMemberId, req.params.memberId)).run();
      db.delete(familyMembers).where(eq(familyMembers.id, req.params.memberId)).run();

      markAsteriskConfigPending();

      return { success: true };
    },
  );
}
