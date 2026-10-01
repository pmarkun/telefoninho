import crypto from "node:crypto";
import { and, eq, isNull, lt, lte } from "drizzle-orm";
import { z } from "zod";
import { accessLinks, db, emailOutbox } from "./db/index.js";
import { cuid } from "./auth-context.js";

const mailSchema = z.object({ to: z.string().email(), subject: z.string(), text: z.string() });
export type Mail = z.infer<typeof mailSchema>;
export type MailSender = (mail: Mail, id: string) => Promise<void>;

function mailKey(): Buffer {
  return crypto.createHash("sha256").update(process.env.JWT_SECRET || "change-me-dev").digest();
}

export function sealMail(mail: Mail): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", mailKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(mail)), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

export function openMail(payload: string): Mail {
  const [iv, tag, body] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", mailKey(), iv);
  decipher.setAuthTag(tag);
  return mailSchema.parse(JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString()));
}

export function enqueueMail(linkId: string, mail: Mail): void {
  db.insert(emailOutbox).values({ id: cuid(), linkId, encryptedPayload: sealMail(mail), nextAttemptAt: new Date() }).run();
}

export const sendResendMail: MailSender = async (mail, id) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("email_not_configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": id },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, reply_to: process.env.EMAIL_REPLY_TO, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`email_http_${response.status}`);
};

let delivering = false;
export async function deliverOutbox(send: MailSender = sendResendMail): Promise<void> {
  if (delivering) return;
  delivering = true;
  try {
    const rows = db.select().from(emailOutbox)
      .where(and(isNull(emailOutbox.sentAt), lt(emailOutbox.attempts, 8), lte(emailOutbox.nextAttemptAt, new Date()))).limit(10).all();
    for (const row of rows) {
      const link = db.select().from(accessLinks).where(eq(accessLinks.id, row.linkId)).get();
      if (!link || link.usedAt || link.revokedAt || link.expiresAt <= new Date()) {
        db.update(emailOutbox).set({ sentAt: new Date(), encryptedPayload: "", lastError: "link_inactive" }).where(eq(emailOutbox.id, row.id)).run();
        continue;
      }
      try {
        await send(openMail(row.encryptedPayload), row.id);
        db.update(emailOutbox).set({ sentAt: new Date(), encryptedPayload: "", lastError: null }).where(eq(emailOutbox.id, row.id)).run();
      } catch {
        db.update(emailOutbox).set({
          attempts: row.attempts + 1,
          nextAttemptAt: new Date(Date.now() + Math.min(2 ** row.attempts * 60000, 3600000)),
          lastError: row.attempts >= 7 ? "Envio não concluído após várias tentativas. Emita um novo convite." : "Falha no envio. Reenvio automático pendente.",
        }).where(eq(emailOutbox.id, row.id)).run();
      }
    }
  } finally { delivering = false; }
}
