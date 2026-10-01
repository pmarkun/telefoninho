import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const parentUsers = sqliteTable("parent_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("responsible"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  authVersion: integer("auth_version").notNull().default(0),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  policyVersion: text("policy_version"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const families = sqliteTable("family", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const familyResponsibles = sqliteTable("family_responsible", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  parentUserId: text("parent_user_id").notNull().references(() => parentUsers.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  familyUserUnique: uniqueIndex("family_responsible_family_user_unique").on(table.familyId, table.parentUserId),
}));

export const familyMembers = sqliteTable("family_member", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  kind: text("kind").notNull().default("child"),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key").notNull().default("star_pixel_01"),
  colorKey: text("color_key").notNull().default("green"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sipAccounts = sqliteTable("sip_account", {
  id: text("id").primaryKey(),
  familyMemberId: text("family_member_id").notNull().unique().references(() => familyMembers.id),
  extension: text("extension").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHashOrEncrypted: text("password_hash_or_encrypted").notNull(),
  plaintextPassword: text("plaintext_password"),
  domain: text("domain").notNull().default("127.0.0.1"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const allowedCalls = sqliteTable("allowed_call", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  fromMemberId: text("from_member_id").notNull().references(() => familyMembers.id),
  toMemberId: text("to_member_id").notNull().references(() => familyMembers.id),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const quietHours = sqliteTable("quiet_hours", {
  id: text("id").primaryKey(),
  familyMemberId: text("family_member_id").notNull().references(() => familyMembers.id),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  startLocalTime: text("start_local_time").notNull().default("21:00"),
  endLocalTime: text("end_local_time").notNull().default("07:00"),
  daysOfWeek: text("days_of_week").notNull().default("mon,tue,wed,thu,fri,sat,sun"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
});

export const pairingCodes = sqliteTable("pairing_code", {
  id: text("id").primaryKey(),
  familyMemberId: text("family_member_id").notNull().references(() => familyMembers.id),
  code: text("code").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const contactInvites = sqliteTable("contact_invite", {
  id: text("id").primaryKey(),
  targetMemberId: text("target_member_id").notNull().references(() => familyMembers.id),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const contactRequests = sqliteTable("contact_request", {
  id: text("id").primaryKey(),
  inviteId: text("invite_id").notNull().references(() => contactInvites.id),
  familyId: text("family_id").notNull().references(() => families.id),
  requesterMemberId: text("requester_member_id").notNull().references(() => familyMembers.id),
  targetMemberId: text("target_member_id").notNull().references(() => familyMembers.id),
  status: text("status").notNull().default("pending"),
  resolvedByParentId: text("resolved_by_parent_id").references(() => parentUsers.id),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const callLogs = sqliteTable("call_log", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  fromMemberId: text("from_member_id"),
  toMemberId: text("to_member_id"),
  fromExtension: text("from_extension").notNull(),
  toExtension: text("to_extension").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  durationSeconds: integer("duration_seconds"),
  status: text("status").notNull().default("missed"),
  blockReason: text("block_reason"),
});

export const shortMessages = sqliteTable("short_message", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => families.id),
  fromMemberId: text("from_member_id").notNull().references(() => familyMembers.id),
  toMemberId: text("to_member_id").notNull().references(() => familyMembers.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const asteriskConfigState = sqliteTable("asterisk_config_state", {
  id: text("id").primaryKey(),
  pending: integer("pending", { mode: "boolean" }).notNull().default(false),
  revision: integer("revision").notNull().default(0),
  lastGeneratedAt: integer("last_generated_at", { mode: "timestamp" }),
  lastAppliedAt: integer("last_applied_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const accessLinks = sqliteTable("access_link", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  purpose: text("purpose").notNull(),
  email: text("email").notNull(),
  familyId: text("family_id").references(() => families.id),
  createdBy: text("created_by").references(() => parentUsers.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const emailOutbox = sqliteTable("email_outbox", {
  id: text("id").primaryKey(),
  linkId: text("link_id").notNull().references(() => accessLinks.id),
  encryptedPayload: text("encrypted_payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }).notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  lastError: text("last_error"),
});

export const familySetups = sqliteTable("family_setup", {
  familyId: text("family_id").primaryKey().references(() => families.id),
  childId: text("child_id").notNull().references(() => familyMembers.id),
  adultId: text("adult_id").notNull().references(() => familyMembers.id),
  firstCallConfirmedAt: integer("first_call_confirmed_at", { mode: "timestamp" }),
});

export const memberDevices = sqliteTable("member_device", {
  memberId: text("member_id").primaryKey().references(() => familyMembers.id),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  pairedAt: integer("paired_at", { mode: "timestamp" }).notNull(),
});
