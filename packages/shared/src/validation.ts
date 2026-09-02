import { z } from "zod";

export const pairingCodeSchema = z.string().length(6).regex(/^\d{6}$/);
export const memberNameSchema = z.string().min(1).max(64);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createFamilySchema = z.object({
  name: z.string().min(1).max(96),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(96).optional(),
  active: z.boolean().optional(),
});

export const createResponsibleSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(96),
  password: z.string().min(6).max(128).optional(),
});

export const updateResponsibleSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(96).optional(),
  password: z.string().min(6).max(128).optional(),
  active: z.boolean().optional(),
  role: z.enum(["admin", "responsible"]).optional(),
});

export const createMemberSchema = z.object({
  kind: z.enum(["child", "adult"]),
  displayName: memberNameSchema,
  avatarKey: z.string().min(1).max(64).optional().default("star_pixel_01"),
  colorKey: z.string().min(1).max(32).optional().default("green"),
});

export const updateMemberSchema = z.object({
  displayName: memberNameSchema.optional(),
  avatarKey: z.string().min(1).max(64).optional(),
  colorKey: z.string().min(1).max(32).optional(),
  active: z.boolean().optional(),
});

export const allowedCallSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

export const createShortMessageSchema = z.object({
  toMemberId: z.string().min(1),
  body: z.string().trim().min(1).max(160),
});

export const updateAllowedCallSchema = z.object({
  enabled: z.boolean(),
});

export const contactInviteQrPayloadSchema = z.object({
  type: z.literal("telefoninho-contact"),
  version: z.literal(1),
  token: z.string().min(32).max(256),
});

export const claimContactInviteSchema = z.object({
  token: z.string().min(32).max(256),
  requesterMemberId: z.string().min(1),
});

export const resolveContactRequestSchema = z.object({
  resolvedByParentId: z.string().min(1).optional(),
});

export const claimPairingSchema = z.object({
  code: pairingCodeSchema,
  deviceName: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(128),
});
