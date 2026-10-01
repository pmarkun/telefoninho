import { eq, sql } from "drizzle-orm";
import { asteriskConfigState, db } from "./db/index.js";

const ASTERISK_CONFIG_STATE_ID = "default";

export type AsteriskConfigStatus = {
  pending: boolean;
  lastGeneratedAt: string | null;
  lastAppliedAt: string | null;
  lastError: string | null;
};

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function ensureAsteriskConfigState() {
  const existing = db.select()
    .from(asteriskConfigState)
    .where(eq(asteriskConfigState.id, ASTERISK_CONFIG_STATE_ID))
    .get();

  if (existing) {
    return existing;
  }

  const now = new Date();
  db.insert(asteriskConfigState).values({
    id: ASTERISK_CONFIG_STATE_ID,
    pending: false,
    lastGeneratedAt: null,
    lastAppliedAt: null,
    lastError: null,
    updatedAt: now,
  }).run();

  return db.select()
    .from(asteriskConfigState)
    .where(eq(asteriskConfigState.id, ASTERISK_CONFIG_STATE_ID))
    .get();
}

export function getAsteriskConfigStatus(): AsteriskConfigStatus {
  const state = ensureAsteriskConfigState();
  return {
    pending: state?.pending ?? false,
    lastGeneratedAt: serializeDate(state?.lastGeneratedAt ?? null),
    lastAppliedAt: serializeDate(state?.lastAppliedAt ?? null),
    lastError: state?.lastError ?? null,
  };
}

export function markAsteriskConfigPending(): void {
  ensureAsteriskConfigState();
  db.update(asteriskConfigState)
    .set({
      pending: true,
      revision: sql`${asteriskConfigState.revision} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(asteriskConfigState.id, ASTERISK_CONFIG_STATE_ID))
    .run();
}

export function markAsteriskConfigApplied(generatedAt: Date, appliedAt: Date): void {
  ensureAsteriskConfigState();
  db.update(asteriskConfigState)
    .set({
      pending: false,
      lastGeneratedAt: generatedAt,
      lastAppliedAt: appliedAt,
      lastError: null,
      updatedAt: appliedAt,
    })
    .where(eq(asteriskConfigState.id, ASTERISK_CONFIG_STATE_ID))
    .run();
}

export function markAsteriskConfigError(error: string, generatedAt: Date | null): void {
  ensureAsteriskConfigState();
  db.update(asteriskConfigState)
    .set({
      pending: true,
      lastGeneratedAt: generatedAt,
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(asteriskConfigState.id, ASTERISK_CONFIG_STATE_ID))
    .run();
}
