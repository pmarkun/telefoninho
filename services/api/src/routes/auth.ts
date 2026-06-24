import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { loginSchema } from "@telefoninho/shared/validation";
import { db, parentUsers } from "../db/index.js";

const DEV_JWT_SECRET = process.env.JWT_SECRET || "change-me-dev";

function signToken(payload: Record<string, string>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", DEV_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function registerAuthRoutes(server: FastifyInstance): void {
  server.post("/auth/login", async (req, reply) => {
    const input = loginSchema.parse(req.body);

    const user = db.select().from(parentUsers).where(eq(parentUsers.email, input.email)).get();
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const hash = crypto.createHash("sha256").update(input.password).digest("hex");
    if (hash !== user.passwordHash) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = signToken({ sub: user.id, email: user.email });

    return {
      token,
      parent: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  });
}
