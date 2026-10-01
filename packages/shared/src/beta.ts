import { z } from "zod";

export const betaEmailSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) });
export const accessTokenSchema = z.object({ token: z.string().min(32).max(256) });
export const betaRegisterSchema = accessTokenSchema.extend({ displayName: z.string().trim().min(1).max(96), password: z.string().min(10).max(128), acceptedPolicy: z.literal(true) });
export const betaResetSchema = accessTokenSchema.extend({ password: z.string().min(10).max(128) });
export const familySetupSchema = z.object({ familyName: z.string().trim().min(1).max(96), childName: z.string().trim().min(1).max(64), adultName: z.string().trim().min(1).max(64), allowCalls: z.literal(true) });
export const parentSessionSchema = z.object({ parent: z.object({ id: z.string(), email: z.string(), displayName: z.string(), role: z.enum(["admin", "responsible"]) }), families: z.array(z.object({ id: z.string(), name: z.string(), active: z.boolean() })) });
export const invitationSchema = z.object({ email: z.string(), purpose: z.enum(["beta", "responsible"]), existingAccount: z.boolean(), expiresAt: z.string() });
export const onboardingSchema = z.object({ configured: z.boolean(), members: z.array(z.object({ id: z.string(), displayName: z.string(), kind: z.string(), deviceName: z.string().nullable(), pairedAt: z.string().nullable() })), firstCallConfirmedAt: z.string().nullable(), telephony: z.enum(["preparing", "ready"]), downloadUrl: z.string().nullable() });
export type ParentSession = z.infer<typeof parentSessionSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type Onboarding = z.infer<typeof onboardingSchema>;
