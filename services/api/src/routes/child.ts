import { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-context.js";
import { eq } from "drizzle-orm";
import { db, familyMembers, sipAccounts, allowedCalls } from "../db/index.js";

export function registerChildRoutes(server: FastifyInstance): void {
  server.get("/child/config", async (req, reply) => {
    const access = requireAuth(req, reply);
    if (!access) return reply;
    if (access.kind !== "child") return reply.status(403).send({ error: "Device authorization required" });

    const member = db.select()
      .from(familyMembers)
      .where(eq(familyMembers.id, access.memberId))
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
    })
      .from(allowedCalls)
      .where(eq(allowedCalls.fromMemberId, member.id))
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
