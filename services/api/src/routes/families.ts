import { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { createFamilySchema, updateFamilySchema, updateResponsibleSchema } from "@telefoninho/shared/validation";
import { db, families as familiesTable, familyResponsibles, parentUsers } from "../db/index.js";
import { cuid, requireFamilyAccess, requireParent } from "../auth-context.js";
import { markAsteriskConfigPending } from "../asterisk-config-state.js";

export function registerFamilyRoutes(server: FastifyInstance): void {
  server.get("/families", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;

    if (parent.role === "admin") {
      return db.select().from(familiesTable).where(eq(familiesTable.active, true)).all();
    }

    return db.select({
      id: familiesTable.id,
      name: familiesTable.name,
      active: familiesTable.active,
      createdAt: familiesTable.createdAt,
      updatedAt: familiesTable.updatedAt,
    })
      .from(familyResponsibles)
      .innerJoin(familiesTable, eq(familiesTable.id, familyResponsibles.familyId))
      .where(and(
        eq(familyResponsibles.parentUserId, parent.userId),
        eq(familiesTable.active, true),
      ))
      .all();
  });

  server.post("/families", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const input = createFamilySchema.parse(req.body);
    const now = new Date();
    const familyId = cuid();

    db.insert(familiesTable).values({
      id: familyId,
      name: input.name,
      active: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    if (parent.role !== "admin") {
      db.insert(familyResponsibles).values({
        id: cuid(),
        familyId,
        parentUserId: parent.userId,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    return db.select().from(familiesTable).where(eq(familiesTable.id, familyId)).get();
  });

  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId",
    async (req, reply) => {
      if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
      const family = db.select().from(familiesTable).where(
        and(eq(familiesTable.id, req.params.familyId), eq(familiesTable.active, true)),
      ).get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }
      return family;
    },
  );

  server.patch<{ Params: { familyId: string } }>("/families/:familyId", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    const input = updateFamilySchema.parse(req.body);
    const current = db.select().from(familiesTable).where(eq(familiesTable.id, req.params.familyId)).get();
    if (!current) return reply.status(404).send({ error: "Family not found" });

    db.update(familiesTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(familiesTable.id, req.params.familyId))
      .run();

    if (input.active !== undefined && input.active !== current.active) {
      markAsteriskConfigPending();
    }

    return db.select().from(familiesTable).where(eq(familiesTable.id, req.params.familyId)).get();
  });

  server.delete<{ Params: { familyId: string } }>("/families/:familyId", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    const current = db.select().from(familiesTable).where(eq(familiesTable.id, req.params.familyId)).get();
    if (!current) return reply.status(404).send({ error: "Family not found" });

    db.update(familiesTable)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(familiesTable.id, req.params.familyId))
      .run();
    markAsteriskConfigPending();
    return { success: true };
  });

  server.get<{ Params: { familyId: string } }>("/families/:familyId/responsibles", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    return db.select({
      id: parentUsers.id,
      email: parentUsers.email,
      displayName: parentUsers.displayName,
      role: parentUsers.role,
      active: parentUsers.active,
    })
      .from(familyResponsibles)
      .innerJoin(parentUsers, eq(parentUsers.id, familyResponsibles.parentUserId))
      .where(eq(familyResponsibles.familyId, req.params.familyId))
      .all();
  });

  server.post<{ Params: { familyId: string } }>("/families/:familyId/responsibles", async (req, reply) => {
    if (!requireFamilyAccess(req, reply, req.params.familyId)) return reply;
    return reply.status(410).send({ error: "Envie um convite para o responsável aceitar com sua própria conta." });
  });

  server.patch<{ Params: { parentUserId: string } }>("/responsibles/:parentUserId", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const target = db.select().from(parentUsers).where(eq(parentUsers.id, req.params.parentUserId)).get();
    if (!target) return reply.status(404).send({ error: "Responsible not found" });
    const input = updateResponsibleSchema.parse(req.body);
    if (input.email || input.password) {
      return reply.status(403).send({ error: "Alterações de acesso exigem verificação pelo próprio titular." });
    }
    if (parent.role !== "admin" && (target.id !== parent.userId || input.active !== undefined || input.role !== undefined)) {
      return reply.status(403).send({ error: "Você só pode editar seu próprio nome. Gerencie o vínculo na família." });
    }

    db.update(parentUsers)
      .set({
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.role ? { role: input.role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(parentUsers.id, req.params.parentUserId))
      .run();

    return { id: target.id, displayName: input.displayName || target.displayName, active: input.active ?? target.active, role: input.role || target.role };
  });

  server.delete<{ Params: { familyId: string; parentUserId: string } }>(
    "/families/:familyId/responsibles/:parentUserId",
    async (req, reply) => {
      const parent = requireFamilyAccess(req, reply, req.params.familyId);
      if (!parent) return reply;

      const links = db.select({
        parentUserId: familyResponsibles.parentUserId,
        active: parentUsers.active,
      })
        .from(familyResponsibles)
        .innerJoin(parentUsers, eq(parentUsers.id, familyResponsibles.parentUserId))
        .where(eq(familyResponsibles.familyId, req.params.familyId))
        .all();
      const activeResponsibleCount = links.filter((link) => link.active).length;
      if (activeResponsibleCount <= 1 && parent.role !== "admin") {
        return reply.status(400).send({ error: "Cannot remove the last responsible" });
      }

      db.delete(familyResponsibles)
        .where(and(
          eq(familyResponsibles.familyId, req.params.familyId),
          eq(familyResponsibles.parentUserId, req.params.parentUserId),
        ))
        .run();
      return { success: true };
    },
  );
}
