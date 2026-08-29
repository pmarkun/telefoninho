import { FastifyInstance } from "fastify";
import { and, desc, eq, or } from "drizzle-orm";
import { createShortMessageSchema } from "@telefoninho/shared/validation";
import { allowedCalls, db, familyMembers, shortMessages } from "../db/index.js";
import { cuid, requireAuth } from "../auth-context.js";

function requireChild(req: Parameters<typeof requireAuth>[0], reply: Parameters<typeof requireAuth>[1]) {
  const auth = requireAuth(req, reply);
  if (!auth) return null;
  if (auth.kind !== "child") {
    reply.status(403).send({ error: "Child authorization required" });
    return null;
  }
  return auth;
}

function serializeMessage(
  message: typeof shortMessages.$inferSelect,
  names: Map<string, string>,
) {
  return {
    id: message.id,
    fromMemberId: message.fromMemberId,
    fromDisplayName: names.get(message.fromMemberId) ?? "Contato",
    toMemberId: message.toMemberId,
    toDisplayName: names.get(message.toMemberId) ?? "Contato",
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export function registerMessageRoutes(server: FastifyInstance): void {
  server.get("/child/messages", async (req, reply) => {
    const auth = requireChild(req, reply);
    if (!auth) return reply;

    const member = db.select().from(familyMembers).where(eq(familyMembers.id, auth.memberId)).get();
    if (!member?.active) return reply.status(404).send({ error: "Member not found" });

    const names = new Map(
      db.select({ id: familyMembers.id, name: familyMembers.displayName })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, member.familyId))
        .all()
        .map((item) => [item.id, item.name]),
    );
    const messages = db.select()
      .from(shortMessages)
      .where(or(
        eq(shortMessages.fromMemberId, member.id),
        eq(shortMessages.toMemberId, member.id),
      ))
      .orderBy(desc(shortMessages.createdAt))
      .limit(100)
      .all();

    return messages.map((message) => serializeMessage(message, names));
  });

  server.post("/child/messages", async (req, reply) => {
    const auth = requireChild(req, reply);
    if (!auth) return reply;
    const input = createShortMessageSchema.parse(req.body);

    const sender = db.select().from(familyMembers).where(eq(familyMembers.id, auth.memberId)).get();
    const recipient = db.select().from(familyMembers).where(eq(familyMembers.id, input.toMemberId)).get();
    if (!sender?.active || !recipient?.active || sender.familyId !== recipient.familyId) {
      return reply.status(404).send({ error: "Contact not found" });
    }
    const permission = db.select().from(allowedCalls).where(and(
      eq(allowedCalls.fromMemberId, sender.id),
      eq(allowedCalls.toMemberId, recipient.id),
      eq(allowedCalls.enabled, true),
    )).get();
    if (!permission) return reply.status(403).send({ error: "Contact is not allowed" });

    const message = {
      id: cuid(),
      familyId: sender.familyId,
      fromMemberId: sender.id,
      toMemberId: recipient.id,
      body: input.body,
      createdAt: new Date(),
    };
    db.insert(shortMessages).values(message).run();
    return reply.status(201).send(serializeMessage(message, new Map([
      [sender.id, sender.displayName],
      [recipient.id, recipient.displayName],
    ])));
  });

  server.delete<{ Params: { messageId: string } }>("/child/messages/:messageId", async (req, reply) => {
    const auth = requireChild(req, reply);
    if (!auth) return reply;
    const message = db.select().from(shortMessages).where(and(
      eq(shortMessages.id, req.params.messageId),
      or(
        eq(shortMessages.fromMemberId, auth.memberId),
        eq(shortMessages.toMemberId, auth.memberId),
      ),
    )).get();
    if (!message) return reply.status(404).send({ error: "Message not found" });
    db.delete(shortMessages).where(eq(shortMessages.id, message.id)).run();
    return reply.status(204).send();
  });
}
