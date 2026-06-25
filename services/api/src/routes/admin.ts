import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
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

export function registerAdminRoutes(server: FastifyInstance): void {
  server.get("/admin/stats", async () => {
    const familyCount = db.select().from(families).all().length;
    const memberCount = db.select().from(familyMembers).all().length;
    const callCount = db.select().from(callLogs).all().length;
    return { families: familyCount, members: memberCount, totalCalls: callCount };
  });

  server.get("/admin/call-logs", async () => {
    return db.select().from(callLogs).orderBy(callLogs.startedAt).all().reverse();
  });

  server.get("/admin/asterisk/status", async () => {
    return getAsteriskConfigStatus();
  });

  server.post("/admin/asterisk/regenerate", async (_req, reply) => {
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
