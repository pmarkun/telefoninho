import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { betaEmailSchema as emailSchema, accessTokenSchema as tokenSchema, betaRegisterSchema as registerSchema, betaResetSchema as resetSchema } from "@telefoninho/shared/beta";
import { accessLinks, db, emailOutbox, families, familyResponsibles, parentUsers } from "../db/index.js";
import { cuid, findParentByEmail, hashPassword, requireAdmin, requireFamilyAccess, requireParent, signToken } from "../auth-context.js";
import { enqueueMail } from "../email.js";
import { sessionCookie } from "../web-security.js";
import { parentSession } from "./auth.js";


export function tokenHash(token: string): string { return crypto.createHash("sha256").update(token).digest("hex"); }

export function issueLink(email: string, purpose: "beta" | "responsible" | "reset", familyId: string | null = null, createdBy: string | null = null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const id = cuid();
  const now = new Date();
  const ttl = purpose === "reset" ? 30 * 60000 : 7 * 86400000;
  db.transaction((tx) => {
    const previous = tx.select().from(accessLinks).where(and(eq(accessLinks.email, email), eq(accessLinks.purpose, purpose), isNull(accessLinks.usedAt), isNull(accessLinks.revokedAt))).all();
    for (const link of previous) if (link.familyId === familyId) tx.update(accessLinks).set({ revokedAt: now }).where(eq(accessLinks.id, link.id)).run();
    tx.insert(accessLinks).values({ id, email, purpose, tokenHash: tokenHash(token), familyId, createdBy, expiresAt: new Date(now.getTime() + ttl), createdAt: now }).run();
    const route = purpose === "reset" ? "redefinir-senha" : "convite";
    const origin = process.env.PARENT_WEB_URL || "http://localhost:3000";
    const url = `${origin}/${route}#token=${token}`;
    enqueueMail(id, { to: email, subject: purpose === "reset" ? "Recupere seu acesso ao Telefoninho" : "Seu convite para o Telefoninho", text: `${purpose === "reset" ? "Defina uma nova senha" : "Você recebeu um convite. Confira os primeiros passos"}:\n\n${url}\n\nEste link é pessoal e tem validade de ${purpose === "reset" ? "30 minutos" : "7 dias"}. Se não esperava este e-mail, pode ignorá-lo.\n\nTelefoninho` });
  });
  return { id, email, expiresAt: new Date(now.getTime() + ttl) };
}

function validLink(token: string) {
  const link = db.select().from(accessLinks).where(eq(accessLinks.tokenHash, tokenHash(token))).get();
  return link && !link.usedAt && !link.revokedAt && link.expiresAt > new Date() ? link : null;
}

export function registerAccessRoutes(server: FastifyInstance): void {
  server.post("/auth/invitation", async (req, reply) => {
    const { token } = tokenSchema.parse(req.body);
    const link = validLink(token);
    if (!link || link.purpose === "reset") return reply.status(400).send({ error: "Convite inválido, utilizado ou expirado. Peça um novo convite." });
    const existing = findParentByEmail(link.email);
    return { email: link.email, purpose: link.purpose, existingAccount: Boolean(existing), expiresAt: link.expiresAt };
  });

  server.post("/auth/register", async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const link = validLink(input.token);
    if (!link || link.purpose === "reset") return reply.status(400).send({ error: "Convite inválido, utilizado ou expirado." });
    if (findParentByEmail(link.email)) return reply.status(409).send({ error: "Já existe uma conta. Entre para aceitar o convite." });
    if (link.familyId && !db.select().from(families).where(and(eq(families.id, link.familyId), eq(families.active, true))).get()) return reply.status(400).send({ error: "A família deste convite está indisponível." });
    const now = new Date();
    const userId = cuid();
    const passwordHash = hashPassword(input.password);
    db.transaction((tx) => {
      tx.insert(parentUsers).values({ id: userId, email: link.email, displayName: input.displayName, passwordHash, role: "responsible", active: true, emailVerifiedAt: now, policyVersion: "2026-10-beta", createdAt: now, updatedAt: now }).run();
      const familyId = link.familyId || cuid();
      if (!link.familyId) tx.insert(families).values({ id: familyId, name: "Minha família", active: true, createdAt: now, updatedAt: now }).run();
      tx.insert(familyResponsibles).values({ id: cuid(), familyId, parentUserId: userId, createdAt: now, updatedAt: now }).run();
      tx.update(accessLinks).set({ usedAt: now }).where(eq(accessLinks.id, link.id)).run();
    });
    const user = db.select().from(parentUsers).where(eq(parentUsers.id, userId)).get();
    if (!user) return reply.status(500).send({ error: "Não foi possível criar a conta." });
    sessionCookie(reply, signToken({ sub: userId, kind: "parent" }));
    return parentSession(user);
  });

  server.post("/auth/accept-invitation", async (req, reply) => {
    const parent = requireParent(req, reply);
    if (!parent) return reply;
    const link = validLink(tokenSchema.parse(req.body).token);
    if (!link || link.purpose === "reset" || parent.email.toLowerCase() !== link.email) return reply.status(400).send({ error: "Entre com o e-mail que recebeu um convite válido." });
    if (link.familyId && !db.select().from(families).where(and(eq(families.id, link.familyId), eq(families.active, true))).get()) return reply.status(400).send({ error: "Família indisponível." });
    const now = new Date();
    db.transaction((tx) => {
      if (link.familyId) {
        tx.insert(familyResponsibles).values({ id: cuid(), familyId: link.familyId, parentUserId: parent.userId, createdAt: now, updatedAt: now }).onConflictDoNothing().run();
      } else if (!tx.select().from(familyResponsibles).where(eq(familyResponsibles.parentUserId, parent.userId)).get()) {
        const familyId = cuid();
        tx.insert(families).values({ id: familyId, name: "Minha família", active: true, createdAt: now, updatedAt: now }).run();
        tx.insert(familyResponsibles).values({ id: cuid(), familyId, parentUserId: parent.userId, createdAt: now, updatedAt: now }).run();
      }
      tx.update(accessLinks).set({ usedAt: now }).where(eq(accessLinks.id, link.id)).run();
    });
    return { ok: true };
  });

  server.post("/auth/forgot-password", async (req) => {
    const { email } = emailSchema.parse(req.body);
    if (findParentByEmail(email)?.active) issueLink(email, "reset");
    return { message: "Se houver uma conta ativa, enviaremos as instruções por e-mail." };
  });
  server.post("/auth/reset-password", async (req, reply) => {
    const input = resetSchema.parse(req.body);
    const link = validLink(input.token);
    if (!link || link.purpose !== "reset") return reply.status(400).send({ error: "Link inválido, utilizado ou expirado. Solicite outro." });
    const user = findParentByEmail(link.email);
    if (!user?.active) return reply.status(400).send({ error: "Link indisponível." });
    const passwordHash = hashPassword(input.password);
    db.transaction((tx) => {
      tx.update(parentUsers).set({ passwordHash, authVersion: user.authVersion + 1, updatedAt: new Date() }).where(eq(parentUsers.id, user.id)).run();
      tx.update(accessLinks).set({ usedAt: new Date() }).where(eq(accessLinks.id, link.id)).run();
    });
    sessionCookie(reply, "", true);
    return { ok: true };
  });

  server.post("/admin/beta-invitations", async (req, reply) => {
    const parent = requireAdmin(req, reply);
    if (!parent) return reply;
    return issueLink(emailSchema.parse(req.body).email, "beta", null, parent.userId);
  });
  server.get("/admin/beta-readiness", async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
    return { emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM), appDownloadConfigured: Boolean(process.env.ANDROID_BETA_DOWNLOAD_URL) };
  });
  server.get("/admin/beta-invitations", async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
    return db.select({ id: accessLinks.id, email: accessLinks.email, expiresAt: accessLinks.expiresAt, usedAt: accessLinks.usedAt, revokedAt: accessLinks.revokedAt, sentAt: emailOutbox.sentAt, lastError: emailOutbox.lastError })
      .from(accessLinks).leftJoin(emailOutbox, eq(emailOutbox.linkId, accessLinks.id)).where(eq(accessLinks.purpose, "beta")).all();
  });
  server.post<{ Params: { id: string } }>("/admin/beta-invitations/:id/revoke", async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
    db.update(accessLinks).set({ revokedAt: new Date() }).where(and(eq(accessLinks.id, req.params.id), eq(accessLinks.purpose, "beta"))).run();
    return { ok: true };
  });
  server.post<{ Params: { familyId: string } }>("/families/:familyId/responsible-invitations", async (req, reply) => {
    const parent = requireFamilyAccess(req, reply, req.params.familyId);
    if (!parent) return reply;
    const family = db.select().from(families).where(and(eq(families.id, req.params.familyId), eq(families.active, true))).get();
    if (!family) return reply.status(404).send({ error: "Família indisponível." });
    return issueLink(emailSchema.parse(req.body).email, "responsible", family.id, parent.userId);
  });
}
