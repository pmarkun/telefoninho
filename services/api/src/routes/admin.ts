import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, families, familyMembers, sipAccounts, callLogs } from "../db/index.js";
import { generateSipPassword, hashSipPassword } from "../sip-auth.js";

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

    return { password: newPassword, extension: sipAccount.extension };
  });
}
