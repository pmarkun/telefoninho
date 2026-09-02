import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, families, familyMembers, sipAccounts, callLogs } from "../db/index.js";
import { generateSipPassword, hashSipPassword } from "../sip-auth.js";
import { generateAsteriskConfig } from "../asterisk-config.js";
import { reloadAsterisk } from "../asterisk-ami.js";
import {
  getAsteriskConfigStatus,
  markAsteriskConfigApplied,
  markAsteriskConfigError,
  markAsteriskConfigPending,
} from "../asterisk-config-state.js";
import { hasFamilyAccess, requireMemberAccess, requireParent } from "../auth-context.js";

export function registerAdminRoutes(server: FastifyInstance): void {
  server.get("/admin/stats", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const familyId = (req.query as { familyId?: string }).familyId;
    if (familyId && !hasFamilyAccess(parent, familyId)) {
      return reply.status(403).send({ error: "Family access denied" });
    }
    const familyCount = familyId ? 1 : db.select().from(families).where(eq(families.active, true)).all().length;
    const memberCount = familyId
      ? db.select().from(familyMembers).where(eq(familyMembers.familyId, familyId)).all().length
      : db.select().from(familyMembers).all().length;
    const callCount = familyId
      ? db.select().from(callLogs).where(eq(callLogs.familyId, familyId)).all().length
      : db.select().from(callLogs).all().length;
    return { families: familyCount, members: memberCount, totalCalls: callCount };
  });

  server.get("/admin/call-logs", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const familyId = (req.query as { familyId?: string }).familyId;
    if (parent.role !== "admin" && !familyId) {
      return reply.status(400).send({ error: "familyId is required" });
    }
    if (familyId && !hasFamilyAccess(parent, familyId)) {
      return reply.status(403).send({ error: "Family access denied" });
    }
    if (familyId) {
      return db.select().from(callLogs).where(eq(callLogs.familyId, familyId)).orderBy(callLogs.startedAt).all().reverse();
    }
    return db.select().from(callLogs).orderBy(callLogs.startedAt).all().reverse();
  });

  server.get("/admin/asterisk/status", async (req, reply) => {
    if (!requireParent(req, reply)) return reply;
    return getAsteriskConfigStatus();
  });

  server.post("/admin/asterisk/regenerate", async (req, reply) => {
    if (!requireParent(req, reply)) return reply;
    let generatedAt: Date | null = null;
    try {
      const generation = generateAsteriskConfig();
      generatedAt = generation.generatedAt;
      await reloadAsterisk();

      const appliedAt = new Date();
      markAsteriskConfigApplied(generation.generatedAt, appliedAt);
      return {
        ok: true,
        generatedAccounts: generation.generatedAccounts,
        appliedAt: appliedAt.toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao regenerar config VoIP";
      markAsteriskConfigError(message, generatedAt);
      return reply.status(500).send({ error: message });
    }
  });

  server.post("/admin/reset-sip-password/:memberId", async (req, reply) => {
    const { memberId } = req.params as { memberId: string };
    if (!requireMemberAccess(req, reply, memberId)) return reply;

    const sipAccount = db.select()
      .from(sipAccounts)
      .where(eq(sipAccounts.familyMemberId, memberId))
      .get();
    if (!sipAccount) {
      return reply.status(404).send({ error: "SIP account not found" });
    }

    const newPassword = generateSipPassword();
    const passwordHash = hashSipPassword(newPassword);

    db.update(sipAccounts)
      .set({ passwordHashOrEncrypted: passwordHash, plaintextPassword: newPassword, updatedAt: new Date() })
      .where(eq(sipAccounts.id, sipAccount.id))
      .run();

    markAsteriskConfigPending();

    return { password: newPassword, extension: sipAccount.extension };
  });
}
