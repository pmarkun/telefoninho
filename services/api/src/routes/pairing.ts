import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { claimPairingSchema } from "@telefoninho/shared/validation";
import { db, familyMembers, sipAccounts, pairingCodes, allowedCalls } from "../db/index.js";

function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerPairingRoutes(server: FastifyInstance): void {
  server.post<{ Params: { memberId: string } }>(
    "/members/:memberId/pairing-code",
    async (req, reply) => {
      const sipAccount = db.select()
        .from(sipAccounts)
        .where(eq(sipAccounts.familyMemberId, req.params.memberId))
        .get();
      if (!sipAccount) {
        return reply.status(404).send({ error: "Member not found" });
      }

      const code = generatePairingCode();
      const ttlMinutes = Number(process.env.PAIRING_CODE_TTL_MINUTES || "20");
      const now = new Date();

      const id = cuid();
      db.insert(pairingCodes).values({
        id,
        familyMemberId: req.params.memberId,
        code,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        createdAt: now,
      }).run();

      return {
        code,
        expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
        qrPayload: {
          type: "telefoninho-pairing",
          code,
          apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3001",
        },
      };
    },
  );

  server.post("/pairing/claim", async (req, reply) => {
    const input = claimPairingSchema.parse(req.body);

    const pairingCode = db.select()
      .from(pairingCodes)
      .where(eq(pairingCodes.code, input.code))
      .get();

    if (!pairingCode) {
      return reply.status(404).send({ error: "Invalid pairing code" });
    }

    if (pairingCode.claimedAt) {
      return reply.status(400).send({ error: "Pairing code already used" });
    }

    if (pairingCode.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Pairing code expired" });
    }

    const sipAccount = db.select()
      .from(sipAccounts)
      .where(eq(sipAccounts.familyMemberId, pairingCode.familyMemberId))
      .get();
    if (!sipAccount) {
      return reply.status(500).send({ error: "No SIP account for this member" });
    }

    const member = db.select()
      .from(familyMembers)
      .where(eq(familyMembers.id, pairingCode.familyMemberId))
      .get();
    if (!member) {
      return reply.status(500).send({ error: "Member not found" });
    }

    db.update(pairingCodes)
      .set({ claimedAt: new Date() })
      .where(eq(pairingCodes.id, pairingCode.id))
      .run();

    const rules = db.select({
      toMemberId: allowedCalls.toMemberId,
      enabled: allowedCalls.enabled,
      displayName: familyMembers.displayName,
      avatarKey: familyMembers.avatarKey,
      colorKey: familyMembers.colorKey,
      sipExtension: sipAccounts.extension,
    })
      .from(allowedCalls)
      .innerJoin(familyMembers, eq(familyMembers.id, allowedCalls.toMemberId))
      .leftJoin(sipAccounts, eq(sipAccounts.familyMemberId, allowedCalls.toMemberId))
      .where(eq(allowedCalls.fromMemberId, pairingCode.familyMemberId))
      .all();

    const contacts = rules
      .filter((r) => r.enabled && r.sipExtension)
      .map((r) => ({
        memberId: r.toMemberId,
        displayName: r.displayName,
        avatarKey: r.avatarKey,
        colorKey: r.colorKey,
        sipUri: `sip:${r.sipExtension}@${sipAccount.domain}`,
      }));

    return {
      profile: {
        memberId: member.id,
        displayName: member.displayName,
        avatarKey: member.avatarKey,
        colorKey: member.colorKey,
      },
      sip: {
        domain: sipAccount.domain,
        port: 5060,
        transport: "udp",
        username: sipAccount.username,
        extension: sipAccount.extension,
        password: sipAccount.plaintextPassword || "",
      },
      contacts,
      settings: {
        showDialpad: false,
        allowEmergencyButton: false,
        theme: "pixel-green",
      },
    };
  });
}
