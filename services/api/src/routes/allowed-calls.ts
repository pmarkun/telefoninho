import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { allowedCallSchema, updateAllowedCallSchema } from "@telefoninho/shared/validation";
import { db, families, familyMembers, allowedCalls, sipAccounts } from "../db/index.js";

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerAllowedCallRoutes(server: FastifyInstance): void {
  server.get<{ Params: { fromMemberId: string } }>(
    "/members/:fromMemberId/contacts",
    async (req, reply) => {
      const member = db.select().from(familyMembers).where(eq(familyMembers.id, req.params.fromMemberId)).get();
      if (!member) {
        return reply.status(404).send({ error: "Member not found" });
      }

      const rules = db.select({
        id: allowedCalls.id,
        enabled: allowedCalls.enabled,
        toMemberId: allowedCalls.toMemberId,
        displayName: familyMembers.displayName,
        avatarKey: familyMembers.avatarKey,
        colorKey: familyMembers.colorKey,
        sipExtension: sipAccounts.extension,
      })
        .from(allowedCalls)
        .innerJoin(familyMembers, eq(familyMembers.id, allowedCalls.toMemberId))
        .leftJoin(sipAccounts, eq(sipAccounts.familyMemberId, allowedCalls.toMemberId))
        .where(eq(allowedCalls.fromMemberId, req.params.fromMemberId))
        .all();

      const contacts = rules.map((r) => ({
        memberId: r.toMemberId,
        displayName: r.displayName,
        avatarKey: r.avatarKey,
        colorKey: r.colorKey,
        sipExtension: r.sipExtension || "",
        enabled: r.enabled,
      }));

      return { memberId: req.params.fromMemberId, contacts };
    },
  );

  server.post("/allowed-calls", async (req, reply) => {
    const input = allowedCallSchema.parse(req.body);

    const existing = db.select()
      .from(allowedCalls)
      .where(and(
        eq(allowedCalls.fromMemberId, input.fromMemberId),
        eq(allowedCalls.toMemberId, input.toMemberId),
      ))
      .get();

    if (existing) {
      db.update(allowedCalls)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(allowedCalls.id, existing.id))
        .run();
      return db.select().from(allowedCalls).where(eq(allowedCalls.id, existing.id)).get();
    }

    const fromMember = db.select().from(familyMembers).where(eq(familyMembers.id, input.fromMemberId)).get();
    if (!fromMember) {
      return reply.status(404).send({ error: "fromMember not found" });
    }
    const toMember = db.select().from(familyMembers).where(eq(familyMembers.id, input.toMemberId)).get();
    if (!toMember) {
      return reply.status(404).send({ error: "toMember not found" });
    }

    const now = new Date();
    const id = cuid();
    db.insert(allowedCalls).values({
      id,
      familyId: fromMember.familyId,
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    }).run();

    return db.select().from(allowedCalls).where(eq(allowedCalls.id, id)).get();
  });

  server.patch<{ Params: { ruleId: string } }>(
    "/allowed-calls/:ruleId",
    async (req, reply) => {
      const input = updateAllowedCallSchema.parse(req.body);

      const rule = db.select().from(allowedCalls).where(eq(allowedCalls.id, req.params.ruleId)).get();
      if (!rule) {
        return reply.status(404).send({ error: "Rule not found" });
      }

      db.update(allowedCalls)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(allowedCalls.id, req.params.ruleId))
        .run();

      return db.select().from(allowedCalls).where(eq(allowedCalls.id, req.params.ruleId)).get();
    },
  );

  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId/permissions",
    async (req, reply) => {
      const family = db.select().from(families).where(eq(families.id, req.params.familyId)).get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }

      const memberList = db.select()
        .from(familyMembers)
        .where(eq(familyMembers.familyId, req.params.familyId))
        .orderBy(familyMembers.createdAt)
        .all();

      const rules = db.select()
        .from(allowedCalls)
        .where(eq(allowedCalls.familyId, req.params.familyId))
        .all();

      return { members: memberList, rules };
    },
  );
}
