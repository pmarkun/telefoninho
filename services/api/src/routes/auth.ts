import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { loginSchema } from "@telefoninho/shared/validation";
import { db, families, familyResponsibles, parentUsers } from "../db/index.js";
import { checkPassword, findParentByEmail, hashPassword, requireParent, signToken } from "../auth-context.js";
import { sessionCookie } from "../web-security.js";

export function parentSession(user: typeof parentUsers.$inferSelect) {
  const role = user.role === "admin" ? "admin" : "responsible";
  const accessibleFamilies = role === "admin"
    ? db.select().from(families).where(eq(families.active, true)).all()
    : db.select({ id: families.id, name: families.name, active: families.active })
      .from(familyResponsibles).innerJoin(families, eq(families.id, familyResponsibles.familyId))
      .where(and(eq(familyResponsibles.parentUserId, user.id), eq(families.active, true))).all();
  return { parent: { id: user.id, email: user.email, displayName: user.displayName, role }, families: accessibleFamilies };
}

export function registerAuthRoutes(server: FastifyInstance): void {
  server.post("/auth/login", async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const user = findParentByEmail(input.email);
    if (!user || !user.active || !checkPassword(input.password, user.passwordHash)) {
      if (!user) hashPassword(input.password);
      return reply.status(401).send({ error: "E-mail ou senha incorretos." });
    }
    if (!user.passwordHash.startsWith("scrypt:")) {
      db.update(parentUsers).set({ passwordHash: hashPassword(input.password) }).where(eq(parentUsers.id, user.id)).run();
    }
    sessionCookie(reply, signToken({ sub: user.id, kind: "parent", v: String(user.authVersion) }));
    return parentSession(user);
  });
  server.get("/auth/me", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const user = db.select().from(parentUsers).where(eq(parentUsers.id, parent.userId)).get();
    return user ? parentSession(user) : reply.status(401).send({ error: "Entre novamente." });
  });
  server.post("/auth/logout", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (parent) {
      const user = db.select().from(parentUsers).where(eq(parentUsers.id, parent.userId)).get();
      if (user) db.update(parentUsers).set({ authVersion: user.authVersion + 1 }).where(eq(parentUsers.id, user.id)).run();
    }
    sessionCookie(reply, "", true);
    if (!parent) return reply;
    return { ok: true };
  });
}
