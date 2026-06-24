import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, families, familyMembers, parentUsers, sipAccounts, allowedCalls } from "../src/db/index.js";

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

async function seed() {
  console.log("🌱 Seeding Telefoninho database...");

  const existing = db.select().from(families).where(eq(families.name, "Família Demo")).get();
  if (existing) {
    console.log("Seed already applied, skipping.");
    return;
  }

  const now = new Date();

  db.insert(parentUsers).values({
    id: cuid(),
    email: "parent@demo.com",
    passwordHash: hash("devpassword"),
    displayName: "Pedro",
    createdAt: now,
    updatedAt: now,
  }).run();

  const familyId = cuid();
  db.insert(families).values({
    id: familyId,
    name: "Família Demo",
    createdAt: now,
    updatedAt: now,
  }).run();

  console.log(`  Family: Família Demo`);

  const membersData = [
    { kind: "adult", displayName: "Papai", avatarKey: "dad_pixel_01", colorKey: "blue", extension: "1001" },
    { kind: "adult", displayName: "Mamãe", avatarKey: "mom_pixel_01", colorKey: "pink", extension: "1002" },
    { kind: "child", displayName: "Tereza", avatarKey: "cat_pixel_01", colorKey: "green", extension: "1003" },
    { kind: "child", displayName: "Maria", avatarKey: "star_pixel_01", colorKey: "green", extension: "1004" },
  ];

  const members: { id: string; displayName: string }[] = [];

  for (const m of membersData) {
    const memberId = cuid();
    const sipId = cuid();
    const password = crypto.randomBytes(12).toString("hex");

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
      id: sipId,
      familyMemberId: memberId,
      extension: m.extension,
      username: m.extension,
      passwordHashOrEncrypted: hash(password),
      plaintextPassword: password,
      domain: "127.0.0.1",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }).run();

    members.push({ id: memberId, displayName: m.displayName });
    console.log(`  ${m.displayName} -> extension ${m.extension}, password: ${password}`);
  }

  const findMember = (name: string) => members.find((m) => m.displayName === name)!;

  const rules = [
    { from: "Tereza", to: "Papai" },
    { from: "Papai", to: "Tereza" },
    { from: "Tereza", to: "Mamãe" },
    { from: "Mamãe", to: "Tereza" },
    { from: "Maria", to: "Papai" },
    { from: "Papai", to: "Maria" },
    { from: "Maria", to: "Mamãe" },
    { from: "Mamãe", to: "Maria" },
  ];

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
