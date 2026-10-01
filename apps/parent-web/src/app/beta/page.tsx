"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { parentSessionSchema } from "@telefoninho/shared/beta";
import { BetaShell } from "../components/beta-shell";
import { betaRequest } from "../components/auth-form";

type Invite = { id: string; email: string; usedAt: string | null; revokedAt: string | null; expiresAt: string; sentAt: string | null; lastError: string | null };
export default function BetaPage() {
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<{ emailConfigured: boolean; appDownloadConfigured: boolean } | null>(null);
  async function refresh() { setInvites(await betaRequest("/admin/beta-invitations")); }
  useEffect(() => {
    betaRequest("/auth/me").then(async (data) => {
      if (parentSessionSchema.parse(data).parent.role !== "admin") throw new Error("Esta página é da administração.");
      setAuthorized(true); setReadiness(await betaRequest("/admin/beta-readiness")); await refresh();
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Entre como administrador."));
  }, []);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await betaRequest("/admin/beta-invitations", { email }); setEmail(""); setMessage("Convite colocado na fila de envio. Para reenviar, informe o e-mail novamente; o link anterior será revogado."); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao enviar convite."); }
    finally { setBusy(false); }
  }
  return <BetaShell><span className="beta-tag">ADMINISTRAÇÃO</span><h1>Convites para o beta.</h1><p>Você escolhe quem entra. Cada família faz seu próprio cadastro.</p><Link href="/dashboard">Voltar para o painel →</Link>{error && <p className="beta-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}{authorized && <>{readiness && (!readiness.emailConfigured || !readiness.appDownloadConfigured) && <p className="beta-note">Antes de abrir a rodada: {!readiness.emailConfigured && "configure o envio de e-mails no servidor. "}{!readiness.appDownloadConfigured && "Disponibilize o link do aplicativo de teste."}</p>}<form onSubmit={invite} className="beta-card"><label htmlFor="invite-email">E-mail do responsável</label><div className="beta-invite-row"><input id="invite-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="primary" disabled={busy}>{busy ? "Enviando…" : "Enviar convite"}</button></div></form><div className="beta-card"><h2>Convites emitidos</h2><button onClick={() => { void refresh().catch(() => setError("Não foi possível atualizar.")); }}>Atualizar status</button>{invites.length === 0 && <p>Nenhum convite por enquanto.</p>}<ul className="beta-invite-list">{invites.map((item) => <li key={item.id}><strong>{item.email}</strong><span>{item.revokedAt ? "Revogado" : item.usedAt ? "Cadastro concluído" : new Date(item.expiresAt) < new Date() ? "Expirado" : item.lastError ? item.lastError : item.sentAt ? "E-mail enviado" : "Aguardando envio"}</span>{!item.revokedAt && !item.usedAt && <button disabled={busy} onClick={() => { setBusy(true); void betaRequest(`/admin/beta-invitations/${item.id}/revoke`, {}).then(refresh).catch(() => setError("Não foi possível revogar.")).finally(() => setBusy(false)); }}>Revogar</button>}</li>)}</ul></div></>}</BetaShell>;
}
