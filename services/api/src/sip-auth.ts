import crypto from "node:crypto";

const SIP_EXTENSION_START = 1001;

export function generateSipExtension(): string {
  return String(SIP_EXTENSION_START + Math.floor(Math.random() * 8999));
}

export function generateSipPassword(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function hashSipPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}
