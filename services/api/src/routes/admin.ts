import { reconcileAsterisk } from "../asterisk-worker.js";
import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, families, familyMembers, sipAccounts, callLogs } from "../db/index.js";
import { generateSipPassword, hashSipPassword } from "../sip-auth.js";
import {
  getAsteriskConfigStatus,
  markAsteriskConfigPending,
} from "../asterisk-config-state.js";
import { hasFamilyAccess, requireAdmin, requireMemberAccess, requireParent } from "../auth-context.js";

export function registerAdminRoutes(server: FastifyInstance): void {
  server.get("/admin/stats", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const familyId = (req.query as { familyId?: string }).familyId;
    if (parent.role !== "admin" && !familyId) return reply.status(400).send({ error: "familyId is required" });
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
    if (!requireAdmin(req, reply)) return reply;
    return getAsteriskConfigStatus();
  });

  server.post("/admin/asterisk/regenerate", async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
    try {
      return await reconcileAsterisk(true);
    } catch {
      return reply.status(500).send({ error: "Não foi possível preparar a telefonia. Nova tentativa automática em breve." });
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
