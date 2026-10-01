import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

export function webOrigins(): string[] {
  return (process.env.WEB_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,https://admin.telefoninho.com.br").split(",");
}

export function sessionCookie(reply: FastifyReply, token: string, clear = false): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  reply.header("Set-Cookie", `telefoninho_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 43200}${secure}`);
  reply.header("Cache-Control", "no-store");
}

export function registerWebSecurity(server: FastifyInstance): void {
  const attempts = new Map<string, { count: number; until: number }>();
  server.addHook("onRequest", async (req, reply) => {
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (unsafe && (req.headers.origin || req.headers.cookie?.includes("telefoninho_session=")) && !webOrigins().includes(req.headers.origin || "")) {
      return reply.status(403).send({ error: "Origem não autorizada." });
    }
    const path = req.url.split("?")[0];
    if (!(path.startsWith("/auth/") || path === "/pairing/claim" || path.endsWith("/responsible-invitations") || path === "/admin/beta-invitations")) return;
    reply.header("Cache-Control", "no-store");
    if (!unsafe) return;
    const time = Date.now();
    for (const [key, value] of attempts) if (value.until <= time) attempts.delete(key);
    const key = `${req.ip}:${path}`;
    const current = attempts.get(key) || { count: 0, until: time + 15 * 60_000 };
    if (attempts.size >= 20000 && !attempts.has(key)) return reply.status(429).send({ error: "Tente novamente mais tarde." });
    current.count += 1;
    attempts.set(key, current);
    const limit = path === "/pairing/claim" ? 20 : 10;
    if (current.count > limit) {
      reply.header("Retry-After", Math.ceil((current.until - time) / 1000));
      return reply.status(429).send({ error: "Muitas tentativas. Aguarde alguns minutos." });
    }
  });
  server.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) return reply.status(400).send({ error: "Confira os campos informados." });
    const code = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (code >= 500) server.log.error("Falha na requisição");
    return reply.status(code).send({ error: code >= 500 ? "Não foi possível concluir. Tente novamente." : "Requisição inválida." });
  });
}
