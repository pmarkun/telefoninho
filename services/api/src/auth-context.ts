import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  allowedCalls,
  contactRequests,
  db,
  families,
  familyMembers,
  familyResponsibles,
  parentUsers,
} from "./db/index.js";

const DEV_JWT_SECRET = process.env.JWT_SECRET || "change-me-dev";

export type ParentRole = "admin" | "responsible";

export type TokenPayload = {
  sub: string;
  email?: string;
  kind?: string;
  role?: ParentRole;
};

export type ParentAuthContext = {
  kind: "parent";
  userId: string;
  email: string;
  role: ParentRole;
};

export type ChildAuthContext = {
  kind: "child";
  memberId: string;
};

export type AuthContext = ParentAuthContext | ChildAuthContext;

export function signToken(payload: Record<string, string>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", DEV_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function hashPassword(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const body = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as TokenPayload;
    const expectedSig = crypto
      .createHmac("sha256", DEV_JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    if (parts[2] !== expectedSig) return null;
    return body;
  } catch {
    return null;
  }
}

export function getBearerPayload(req: FastifyRequest): TokenPayload | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply): AuthContext | null {
  const payload = getBearerPayload(req);
  if (!payload) {
    reply.status(401).send({ error: "Missing or invalid authorization" });
    return null;
  }

  if (payload.kind && payload.kind !== "parent") {
    return { kind: "child", memberId: payload.sub };
  }

  const user = db.select()
    .from(parentUsers)
    .where(and(eq(parentUsers.id, payload.sub), eq(parentUsers.active, true)))
    .get();
  if (!user) {
    reply.status(401).send({ error: "Invalid authorization" });
    return null;
  }

  return {
    kind: "parent",
    userId: user.id,
    email: user.email,
    role: user.role === "admin" ? "admin" : "responsible",
  };
}

export function requireParent(req: FastifyRequest, reply: FastifyReply): ParentAuthContext | null {
  const auth = requireAuth(req, reply);
  if (!auth) return null;
  if (auth.kind !== "parent") {
    reply.status(403).send({ error: "Parent authorization required" });
    return null;
  }
  return auth;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): ParentAuthContext | null {
  const parent = requireParent(req, reply);
  if (!parent) return null;
  if (parent.role !== "admin") {
    reply.status(403).send({ error: "Admin authorization required" });
    return null;
  }
  return parent;
}

export function hasFamilyAccess(parent: ParentAuthContext, familyId: string): boolean {
  if (parent.role === "admin") return true;
  const link = db.select()
    .from(familyResponsibles)
    .where(and(
      eq(familyResponsibles.familyId, familyId),
      eq(familyResponsibles.parentUserId, parent.userId),
    ))
    .get();
  return Boolean(link);
}

export function requireFamilyAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  familyId: string,
): ParentAuthContext | null {
  const parent = requireParent(req, reply);
  if (!parent) return null;
  if (!hasFamilyAccess(parent, familyId)) {
    reply.status(403).send({ error: "Family access denied" });
    return null;
  }
  return parent;
}

export function requireMemberAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  memberId: string,
): { parent: ParentAuthContext; member: typeof familyMembers.$inferSelect } | null {
  const member = db.select().from(familyMembers).where(eq(familyMembers.id, memberId)).get();
  if (!member) {
    reply.status(404).send({ error: "Member not found" });
    return null;
  }
  const parent = requireFamilyAccess(req, reply, member.familyId);
  if (!parent) return null;
  return { parent, member };
}

export function requireMemberOrChildAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  memberId: string,
): typeof familyMembers.$inferSelect | null {
  const member = db.select().from(familyMembers).where(eq(familyMembers.id, memberId)).get();
  if (!member) {
    reply.status(404).send({ error: "Member not found" });
    return null;
  }

  const auth = requireAuth(req, reply);
  if (!auth) return null;
  if (auth.kind === "child") {
    if (auth.memberId !== memberId) {
      reply.status(403).send({ error: "Member access denied" });
      return null;
    }
    return member;
  }
  if (!hasFamilyAccess(auth, member.familyId)) {
    reply.status(403).send({ error: "Family access denied" });
    return null;
  }
  return member;
}

export function requireAllowedCallAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  ruleId: string,
) {
  const rule = db.select().from(allowedCalls).where(eq(allowedCalls.id, ruleId)).get();
  if (!rule) {
    reply.status(404).send({ error: "Rule not found" });
    return null;
  }
  const parent = requireFamilyAccess(req, reply, rule.familyId);
  if (!parent) return null;
  return rule;
}

export function requireContactRequestAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  requestId: string,
) {
  const request = db.select().from(contactRequests).where(eq(contactRequests.id, requestId)).get();
  if (!request) {
    reply.status(404).send({ error: "Contact request not found" });
    return null;
  }
  const parent = requireFamilyAccess(req, reply, request.familyId);
  if (!parent) return null;
  return request;
}

export function getActiveFamily(familyId: string) {
  return db.select()
    .from(families)
    .where(and(eq(families.id, familyId), eq(families.active, true)))
    .get();
}

export function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}
