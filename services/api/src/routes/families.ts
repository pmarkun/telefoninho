import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, families as familiesTable } from "../db/index.js";

export function registerFamilyRoutes(server: FastifyInstance): void {
  server.get("/families", async () => {
    return db.select().from(familiesTable).all();
  });

  server.get<{ Params: { familyId: string } }>(
    "/families/:familyId",
    async (req, reply) => {
      const family = db.select().from(familiesTable).where(
        eq(familiesTable.id, req.params.familyId),
      ).get();
      if (!family) {
        return reply.status(404).send({ error: "Family not found" });
      }
      return family;
    },
  );
}
