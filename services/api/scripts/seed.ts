import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, families, familyMembers, familyResponsibles, parentUsers, sipAccounts, allowedCalls } from "../src/db/index.js";

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

async function seed() {
  console.log("🌱 Seeding Telefoninho database...");

  const now = new Date();
  const sipDomain = process.env.ASTERISK_HOST || "127.0.0.1";

  const existingParent = db.select().from(parentUsers).where(eq(parentUsers.email, "parent@demo.com")).get();
  if (existingParent) {
    db.update(parentUsers).set({
      passwordHash: hash("devpassword"),
      displayName: "Pedro",
      role: "admin",
      active: true,
      updatedAt: now,
    }).where(eq(parentUsers.id, existingParent.id)).run();
  } else {
    db.insert(parentUsers).values({
      id: cuid(),
      email: "parent@demo.com",
      passwordHash: hash("devpassword"),
      displayName: "Pedro",
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  const existingFamily = db.select().from(families).where(eq(families.name, "Família Demo")).get();
  const familyId = existingFamily?.id ?? cuid();
  if (existingFamily) {
    db.update(families).set({ active: true, updatedAt: now }).where(eq(families.id, familyId)).run();
  } else {
    db.insert(families).values({
      id: familyId,
      name: "Família Demo",
      active: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  const parent = db.select().from(parentUsers).where(eq(parentUsers.email, "parent@demo.com")).get();
  if (parent) {
    const existingLink = db.select().from(familyResponsibles).where(eq(familyResponsibles.parentUserId, parent.id)).get();
    if (!existingLink) {
      db.insert(familyResponsibles).values({
        id: cuid(),
        familyId,
        parentUserId: parent.id,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  console.log(`  Family: Família Demo`);

  const membersData = [
    { kind: "adult", displayName: "Pedro", avatarKey: "dad_pixel_01", colorKey: "blue", extension: "1001" },
    { kind: "adult", displayName: "Maisa", avatarKey: "mom_pixel_01", colorKey: "pink", extension: "1002" },
    { kind: "child", displayName: "Tereza", avatarKey: "cat_pixel_01", colorKey: "green", extension: "1003" },
    { kind: "child", displayName: "Maria", avatarKey: "star_pixel_01", colorKey: "green", extension: "1004" },
  ];

  const members: { id: string; displayName: string }[] = [];

  for (const m of membersData) {
    const existingSip = db.select().from(sipAccounts).where(eq(sipAccounts.extension, m.extension)).get();
    const memberId = existingSip?.familyMemberId ?? cuid();
    const password = existingSip?.plaintextPassword ?? crypto.randomBytes(12).toString("hex");

    if (existingSip) {
      db.update(familyMembers).set({
        familyId,
        kind: m.kind,
        displayName: m.displayName,
        avatarKey: m.avatarKey,
        colorKey: m.colorKey,
        active: true,
        updatedAt: now,
      }).where(eq(familyMembers.id, memberId)).run();

      db.update(sipAccounts).set({
        username: m.extension,
        passwordHashOrEncrypted: hash(password),
        plaintextPassword: password,
        domain: sipDomain,
        enabled: true,
        updatedAt: now,
      }).where(eq(sipAccounts.id, existingSip.id)).run();
    } else {
      db.insert(familyMembers).values({
        id: memberId,
        familyId,
        kind: m.kind,
        displayName: m.displayName,
        avatarKey: m.avatarKey,
        colorKey: m.colorKey,
        active: true,
        createdAt: now,
        updatedAt: now,
      }).run();

      db.insert(sipAccounts).values({
        id: cuid(),
        familyMemberId: memberId,
        extension: m.extension,
        username: m.extension,
        passwordHashOrEncrypted: hash(password),
        plaintextPassword: password,
        domain: sipDomain,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    members.push({ id: memberId, displayName: m.displayName });
    console.log(`  ${m.displayName} -> extension ${m.extension}, password: ${password}`);
  }

  const findMember = (name: string) => members.find((m) => m.displayName === name)!;

  const rules = [
    { from: "Tereza", to: "Pedro" },
    { from: "Pedro", to: "Tereza" },
    { from: "Tereza", to: "Maisa" },
    { from: "Maisa", to: "Tereza" },
    { from: "Maria", to: "Pedro" },
    { from: "Pedro", to: "Maria" },
    { from: "Maria", to: "Maisa" },
    { from: "Maisa", to: "Maria" },
  ];

  db.delete(allowedCalls).where(eq(allowedCalls.familyId, familyId)).run();

  for (const r of rules) {
    db.insert(allowedCalls).values({
      id: cuid(),
      familyId,
      fromMemberId: findMember(r.from).id,
      toMemberId: findMember(r.to).id,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  console.log(`  ${rules.length} allowed call rules created`);
  console.log("  Parent user: parent@demo.com / devpassword");
  console.log("✅ Seed complete!");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
