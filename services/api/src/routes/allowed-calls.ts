import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { allowedCallSchema, updateAllowedCallSchema } from "@telefoninho/shared/validation";
import { db, families, familyMembers, allowedCalls, sipAccounts } from "../db/index.js";
import { markAsteriskConfigPending } from "../asterisk-config-state.js";
import {
  requireAllowedCallAccess,
  requireFamilyAccess,
  requireMemberOrChildAccess,
  requireParent,
} from "../auth-context.js";

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerAllowedCallRoutes(server: FastifyInstance): void {
  server.get<{ Params: { fromMemberId: string } }>(
    "/members/:fromMemberId/contacts",
    async (req, reply) => {
      const member = requireMemberOrChildAccess(req, reply, req.params.fromMemberId);
      if (!member) {
        return reply;
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
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const input = allowedCallSchema.parse(req.body);

    const fromMember = db.select().from(familyMembers).where(eq(familyMembers.id, input.fromMemberId)).get();
    if (!fromMember) {
      return reply.status(404).send({ error: "fromMember not found" });
    }
    const toMember = db.select().from(familyMembers).where(eq(familyMembers.id, input.toMemberId)).get();
    if (!toMember) {
      return reply.status(404).send({ error: "toMember not found" });
    }
    if (!requireFamilyAccess(req, reply, fromMember.familyId)) return reply;
    if (fromMember.familyId !== toMember.familyId) {
      return reply.status(400).send({ error: "Members must belong to the same family" });
    }

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
      markAsteriskConfigPending();
      return db.select().from(allowedCalls).where(eq(allowedCalls.id, existing.id)).get();
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

    markAsteriskConfigPending();

    return db.select().from(allowedCalls).where(eq(allowedCalls.id, id)).get();
  });

  server.patch<{ Params: { ruleId: string } }>(
    "/allowed-calls/:ruleId",
    async (req, reply) => {
      const input = updateAllowedCallSchema.parse(req.body);

      const rule = requireAllowedCallAccess(req, reply, req.params.ruleId);
      if (!rule) {
        return reply;
      }

      db.update(allowedCalls)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(allowedCalls.id, req.params.ruleId))
        .run();

      markAsteriskConfigPending();

      return db.select().from(allowedCalls).where(eq(allowedCalls.id, req.params.ruleId)).get();
    },
  );

  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId/permissions",
    async (req, reply) => {
      if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
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
