import { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { loginSchema } from "@telefoninho/shared/validation";
import { db, families, familyResponsibles, parentUsers } from "../db/index.js";
import { hashPassword, signToken } from "../auth-context.js";

export function registerAuthRoutes(server: FastifyInstance): void {
  server.post("/auth/login", async (req, reply) => {
    const input = loginSchema.parse(req.body);

    const user = db.select()
      .from(parentUsers)
      .where(and(eq(parentUsers.email, input.email), eq(parentUsers.active, true)))
      .get();
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const hash = hashPassword(input.password);
    if (hash !== user.passwordHash) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const role = user.role === "admin" ? "admin" : "responsible";
    const token = signToken({ sub: user.id, email: user.email, kind: "parent", role });
    const accessibleFamilies = role === "admin"
      ? db.select().from(families).where(eq(families.active, true)).all()
      : db.select({
        id: families.id,
        name: families.name,
        active: families.active,
        createdAt: families.createdAt,
        updatedAt: families.updatedAt,
      })
        .from(familyResponsibles)
        .innerJoin(families, eq(families.id, familyResponsibles.familyId))
        .where(and(
          eq(familyResponsibles.parentUserId, user.id),
          eq(families.active, true),
        ))
        .all();

    return {
      token,
      parent: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role,
      },
      families: accessibleFamilies,
    };
  });
}
