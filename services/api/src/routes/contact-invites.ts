import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { claimContactInviteSchema, resolveContactRequestSchema } from "@telefoninho/shared/validation";
import {
  allowedCalls,
  contactInvites,
  contactRequests,
  db,
  families,
  familyMembers,
} from "../db/index.js";

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createOrEnableAllowedCall(fromMemberId: string, toMemberId: string): void {
  const existing = db.select()
    .from(allowedCalls)
    .where(and(
      eq(allowedCalls.fromMemberId, fromMemberId),
      eq(allowedCalls.toMemberId, toMemberId),
    ))
    .get();

  const now = new Date();
  if (existing) {
    db.update(allowedCalls)
      .set({ enabled: true, updatedAt: now })
      .where(eq(allowedCalls.id, existing.id))
      .run();
    return;
  }

  const fromMember = db.select().from(familyMembers).where(eq(familyMembers.id, fromMemberId)).get();
  if (!fromMember) return;

  db.insert(allowedCalls).values({
    id: cuid(),
    familyId: fromMember.familyId,
    fromMemberId,
    toMemberId,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }).run();
}

function serializeContactRequest(row: {
  id: string;
  status: string;
  requesterMemberId: string;
  targetMemberId: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}) {
  const requester = db.select()
    .from(familyMembers)
    .where(eq(familyMembers.id, row.requesterMemberId))
    .get();
  const target = db.select()
    .from(familyMembers)
    .where(eq(familyMembers.id, row.targetMemberId))
    .get();

  return {
    id: row.id,
    status: row.status,
    requesterMemberId: row.requesterMemberId,
    requesterDisplayName: requester?.displayName ?? "Contato",
    requesterKind: requester?.kind ?? "external",
    targetMemberId: row.targetMemberId,
    targetDisplayName: target?.displayName ?? "Contato",
    targetKind: target?.kind ?? "external",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function registerContactInviteRoutes(server: FastifyInstance): void {
  server.post<{ Params: { memberId: string } }>(
    "/members/:memberId/contact-invite",
    async (req, reply) => {
      const member = db.select()
        .from(familyMembers)
        .where(eq(familyMembers.id, req.params.memberId))
        .get();
      if (!member) {
        return reply.status(404).send({ error: "Member not found" });
      }

      const now = new Date();
      const ttlMinutes = Number(process.env.CONTACT_INVITE_TTL_MINUTES || "1440");
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
      const token = generateInviteToken();

      db.insert(contactInvites).values({
        id: cuid(),
        targetMemberId: member.id,
        token,
        expiresAt,
        createdAt: now,
      }).run();

      return {
        token,
        expiresAt: expiresAt.toISOString(),
        qrPayload: {
          type: "telefoninho-contact",
          version: 1,
          token,
        },
      };
    },
  );

  server.post("/contact-invites/claim", async (req, reply) => {
    const input = claimContactInviteSchema.parse(req.body);
    const invite = db.select()
      .from(contactInvites)
      .where(eq(contactInvites.token, input.token))
      .get();

    if (!invite || invite.revokedAt) {
      return reply.status(404).send({ error: "Invalid contact invite" });
    }

    if (invite.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Contact invite expired" });
    }

    const requester = db.select()
      .from(familyMembers)
      .where(eq(familyMembers.id, input.requesterMemberId))
      .get();
    const target = db.select()
      .from(familyMembers)
      .where(eq(familyMembers.id, invite.targetMemberId))
      .get();

    if (!requester || !target) {
      return reply.status(404).send({ error: "Member not found" });
    }

    if (requester.id === target.id) {
      return reply.status(400).send({ error: "Cannot add the same member as a contact" });
    }

    const existingRequest = db.select()
      .from(contactRequests)
      .where(and(
        eq(contactRequests.requesterMemberId, requester.id),
        eq(contactRequests.targetMemberId, target.id),
        eq(contactRequests.status, "pending"),
      ))
      .get();
    if (existingRequest) {
      return serializeContactRequest(existingRequest);
    }

    const now = new Date();
    const direct = requester.kind === "adult" && target.kind === "adult";
    const status = direct ? "auto_approved" : "pending";
    const requestId = cuid();

    db.insert(contactRequests).values({
      id: requestId,
      inviteId: invite.id,
      familyId: target.familyId,
      requesterMemberId: requester.id,
      targetMemberId: target.id,
      status,
      resolvedAt: direct ? now : null,
      createdAt: now,
      updatedAt: now,
    }).run();

    if (direct) {
      createOrEnableAllowedCall(requester.id, target.id);
    }

    const request = db.select()
      .from(contactRequests)
      .where(eq(contactRequests.id, requestId))
      .get();
    if (!request) {
      return reply.status(500).send({ error: "Contact request not found" });
    }
    return serializeContactRequest(request);
  });

  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId/contact-requests",
    async (req, reply) => {
      const family = db.select()
        .from(families)
        .where(eq(families.id, req.params.familyId))
        .get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }

      const rows = db.select()
        .from(contactRequests)
        .where(eq(contactRequests.familyId, req.params.familyId))
        .all();

      return { requests: rows.map(serializeContactRequest) };
    },
  );

  server.post<{ Params: { requestId: string } }>(
    "/contact-requests/:requestId/approve",
    async (req, reply) => {
      const input = resolveContactRequestSchema.parse(req.body ?? {});
      const request = db.select()
        .from(contactRequests)
        .where(eq(contactRequests.id, req.params.requestId))
        .get();
      if (!request) {
        return reply.status(404).send({ error: "Contact request not found" });
      }
      if (request.status !== "pending") {
        return serializeContactRequest(request);
      }

      const now = new Date();
      createOrEnableAllowedCall(request.requesterMemberId, request.targetMemberId);
      db.update(contactRequests)
        .set({
          status: "approved",
          resolvedByParentId: input.resolvedByParentId,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(contactRequests.id, request.id))
        .run();

      const updated = db.select()
        .from(contactRequests)
        .where(eq(contactRequests.id, request.id))
        .get();
      if (!updated) {
        return reply.status(500).send({ error: "Contact request not found" });
      }
      return serializeContactRequest(updated);
    },
  );

  server.post<{ Params: { requestId: string } }>(
    "/contact-requests/:requestId/reject",
    async (req, reply) => {
      const input = resolveContactRequestSchema.parse(req.body ?? {});
      const request = db.select()
        .from(contactRequests)
        .where(eq(contactRequests.id, req.params.requestId))
        .get();
      if (!request) {
        return reply.status(404).send({ error: "Contact request not found" });
      }
      if (request.status !== "pending") {
        return serializeContactRequest(request);
      }

      const now = new Date();
      db.update(contactRequests)
        .set({
          status: "rejected",
          resolvedByParentId: input.resolvedByParentId,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(contactRequests.id, request.id))
        .run();

      const updated = db.select()
        .from(contactRequests)
        .where(eq(contactRequests.id, request.id))
        .get();
      if (!updated) {
        return reply.status(500).send({ error: "Contact request not found" });
      }
      return serializeContactRequest(updated);
    },
  );
}
