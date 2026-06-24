import { FastifyInstance } from "fastify";

export function registerHealthRoutes(server: FastifyInstance): void {
  server.get("/health", async () => {
    return { status: "ok" };
  });
}
