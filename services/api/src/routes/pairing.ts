import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { claimPairingSchema } from "@telefoninho/shared/validation";
import { db, familyMembers, sipAccounts, pairingCodes, allowedCalls, memberDevices } from "../db/index.js";
import { getActiveFamily, requireMemberAccess, signToken } from "../auth-context.js";
import { generateSipPassword, hashSipPassword } from "../sip-auth.js";
import { markAsteriskConfigPending } from "../asterisk-config-state.js";

function generatePairingCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function registerPairingRoutes(server: FastifyInstance): void {
  server.post<{ Params: { memberId: string } }>(
    "/members/:memberId/pairing-code",
    async (req, reply) => {
      if (!requireMemberAccess(req, reply, req.params.memberId)) return reply;
      const sipAccount = db.select()
        .from(sipAccounts)
        .where(eq(sipAccounts.familyMemberId, req.params.memberId))
        .get();
      if (!sipAccount) {
        return reply.status(404).send({ error: "Member not found" });
      }

      let code = generatePairingCode();
      while (db.select().from(pairingCodes).where(eq(pairingCodes.code, code)).get()) code = generatePairingCode();
      const ttlMinutes = Number(process.env.PAIRING_CODE_TTL_MINUTES || "20");
      const now = new Date();
      db.update(pairingCodes).set({ revokedAt: now }).where(and(eq(pairingCodes.familyMemberId, req.params.memberId), isNull(pairingCodes.claimedAt))).run();

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

    if (pairingCode.claimedAt || pairingCode.revokedAt) {
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
    if (!member || !member.active || !getActiveFamily(member.familyId)) {
      return reply.status(500).send({ error: "Member not found" });
    }

    const claimed = db.transaction((tx) => {
      const claim = tx.update(pairingCodes).set({ claimedAt: new Date() })
        .where(and(eq(pairingCodes.id, pairingCode.id), isNull(pairingCodes.claimedAt), isNull(pairingCodes.revokedAt))).run();
      if (claim.changes !== 1) return false;
      tx.update(familyMembers).set({ tokenVersion: member.tokenVersion + 1 }).where(eq(familyMembers.id, member.id)).run();
      if (tx.select().from(memberDevices).where(eq(memberDevices.memberId, member.id)).get()) {
        const password = generateSipPassword();
        tx.update(sipAccounts).set({ plaintextPassword: password, passwordHashOrEncrypted: hashSipPassword(password) }).where(eq(sipAccounts.id, sipAccount.id)).run();
        sipAccount.plaintextPassword = password;
        markAsteriskConfigPending();
      }
      tx.insert(memberDevices).values({ memberId: member.id, deviceId: input.deviceId, deviceName: input.deviceName, pairedAt: new Date() })
        .onConflictDoUpdate({ target: memberDevices.memberId, set: { deviceId: input.deviceId, deviceName: input.deviceName, pairedAt: new Date() } }).run();
      return true;
    });
    if (!claimed) return reply.status(400).send({ error: "Pairing code already used" });

    const rules = db.select({
      toMemberId: allowedCalls.toMemberId,
      enabled: allowedCalls.enabled,
    })
      .from(allowedCalls)
      .where(eq(allowedCalls.fromMemberId, pairingCode.familyMemberId))
      .all();
    const enabledMemberIds = new Set(rules.filter((r) => r.enabled).map((r) => r.toMemberId));

    const familyContacts = db.select({
      memberId: familyMembers.id,
      displayName: familyMembers.displayName,
      avatarKey: familyMembers.avatarKey,
      colorKey: familyMembers.colorKey,
      sipExtension: sipAccounts.extension,
    })
      .from(familyMembers)
      .leftJoin(sipAccounts, eq(sipAccounts.familyMemberId, familyMembers.id))
      .where(eq(familyMembers.familyId, member.familyId))
      .all();

    const contacts = familyContacts
      .filter((r) => r.memberId !== member.id && r.sipExtension)
      .map((r) => ({
        memberId: r.memberId,
        displayName: r.displayName,
        avatarKey: r.avatarKey,
        colorKey: r.colorKey,
        sipExtension: r.sipExtension,
        enabled: enabledMemberIds.has(r.memberId),
        sipUri: `sip:${r.sipExtension}@${sipAccount.domain}`,
      }));

    return {
      token: signToken({ sub: member.id, kind: member.kind, v: String(member.tokenVersion + 1) }),
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
