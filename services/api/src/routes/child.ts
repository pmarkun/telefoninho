import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, familyMembers, sipAccounts, allowedCalls } from "../db/index.js";

const DEV_JWT_SECRET = process.env.JWT_SECRET || "change-me-dev";

function verifyToken(token: string): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const body = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const expectedSig = crypto
      .createHmac("sha256", DEV_JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64url");
    if (parts[2] !== expectedSig) return null;
    return { sub: body.sub };
  } catch {
    return null;
  }
}

export function registerChildRoutes(server: FastifyInstance): void {
  server.get("/child/config", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing authorization" });
    }

    const payload = verifyToken(auth.slice(7));
    if (!payload) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    const member = db.select()
      .from(familyMembers)
      .where(eq(familyMembers.id, payload.sub))
      .get();
    if (!member) {
      return reply.status(404).send({ error: "Member not found" });
    }

    const sipAccount = db.select()
      .from(sipAccounts)
      .where(eq(sipAccounts.familyMemberId, member.id))
      .get();
    if (!sipAccount) {
      return reply.status(500).send({ error: "No SIP account for this member" });
    }

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
      .where(eq(allowedCalls.fromMemberId, member.id))
      .all();

    const contacts = rules
      .filter((r) => r.enabled && r.sipExtension)
      .map((r) => ({
        memberId: r.toMemberId,
        displayName: r.displayName,
        avatarKey: r.avatarKey,
        colorKey: r.colorKey,
        sipExtension: r.sipExtension,
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
