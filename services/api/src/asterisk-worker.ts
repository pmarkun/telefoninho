import { db, asteriskConfigState } from "./db/index.js";
import { generateAsteriskConfig } from "./asterisk-config.js";
import { reloadAsterisk } from "./asterisk-ami.js";
import { getAsteriskConfigStatus, markAsteriskConfigApplied, markAsteriskConfigError, markAsteriskConfigPending } from "./asterisk-config-state.js";

let running: Promise<{ ok: boolean; generatedAccounts: number; appliedAt: string } | null> | null = null;
export function reconcileAsterisk(force = false) {
  if (running) return running;
  running = applyConfig(force).finally(() => { running = null; });
  return running;
}

async function applyConfig(force: boolean) {
  getAsteriskConfigStatus();
  const state = db.select().from(asteriskConfigState).get();
  if (!state || (!state.pending && !force)) return null;
  try {
    const generation = generateAsteriskConfig();
    await reloadAsterisk();
    const changed = db.select().from(asteriskConfigState).get()?.revision !== state.revision;
    const appliedAt = new Date();
    markAsteriskConfigApplied(generation.generatedAt, appliedAt);
    if (changed) markAsteriskConfigPending();
    return { ok: true, generatedAccounts: generation.generatedAccounts, appliedAt: appliedAt.toISOString() };
  } catch {
    markAsteriskConfigError("A telefonia ainda não foi aplicada. Nova tentativa automática em breve.", null);
    throw new Error("Não foi possível preparar a telefonia. Nova tentativa automática em breve.");
  }
}
