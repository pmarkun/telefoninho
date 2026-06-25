import { z } from "zod";

export const pairingCodeSchema = z.string().length(6).regex(/^\d{6}$/);
export const memberNameSchema = z.string().min(1).max(64);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createMemberSchema = z.object({
  kind: z.enum(["child", "adult", "external"]),
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
