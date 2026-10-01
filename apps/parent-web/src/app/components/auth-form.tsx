"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invitationSchema, parentSessionSchema, type Invitation, type ParentSession } from "@telefoninho/shared/beta";
import { API } from "../session";
import { BetaShell } from "./beta-shell";

export function rememberSession(data: ParentSession): void {
  localStorage.removeItem("token");
  localStorage.setItem("sessionPresent", "yes");
  localStorage.setItem("parentName", data.parent.displayName);
  localStorage.setItem("parentRole", data.parent.role);
  if (data.families[0]) localStorage.setItem("activeFamilyId", data.families[0].id);
  else localStorage.removeItem("activeFamilyId");
}

export async function betaRequest(path: string, body?: unknown) {
  const response = await fetch(`${API}${path}`, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Não foi possível continuar.");
  return data;
}

export function AuthForm({ mode }: { mode: "login" | "invite" | "forgot" | "reset" }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(mode === "invite");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const value = params.get("token") || params.get("convite") || "";
    setToken(value);
    if (mode === "invite") {
      if (!value) { setError("O beta é por convite. Abra o link que recebeu por e-mail."); setLoading(false); return; }
      let active = true;
      betaRequest("/auth/invitation", { token: value }).then((data) => {
        if (!active) return;
        const info = invitationSchema.parse(data);
        setInvitation(info); setEmail(info.email);
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Convite indisponível."); }).finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    if (mode === "reset" && !value) setError("Abra o link de recuperação recebido por e-mail.");
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      if (mode === "forgot") {
        const data = await betaRequest("/auth/forgot-password", { email }); setMessage(data.message);
      } else if (mode === "reset") {
        await betaRequest("/auth/reset-password", { token, password }); setPassword(""); setMessage("Senha atualizada. Entre novamente para continuar.");
      } else if (mode === "invite") {
        const data = parentSessionSchema.parse(await betaRequest("/auth/register", { token, displayName: name, password, acceptedPolicy: accepted }));
        rememberSession(data); router.push("/primeiros-passos");
      } else {
        const data = parentSessionSchema.parse(await betaRequest("/auth/login", { email, password }));
        rememberSession(data);
        if (token) await betaRequest("/auth/accept-invitation", { token });
        router.push(data.parent.role === "admin" && !token ? "/dashboard" : "/primeiros-passos");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  }

  const title = { login: "Entre na sua família.", invite: "Seu primeiro Telefoninho.", forgot: "Vamos recuperar seu acesso.", reset: "Uma nova senha." }[mode];
  const label = { login: "Entrar", invite: "Criar minha conta", forgot: "Enviar instruções", reset: "Salvar nova senha" }[mode];
  const formVisible = !message && (mode !== "invite" || Boolean(invitation && !invitation.existingAccount)) && (mode !== "reset" || Boolean(token));
  return <BetaShell><div className="beta-auth-grid"><section className="beta-intro"><span className="beta-tag">BETA FECHADO</span><h1>{title}</h1><p>Um telefone para conversar com os contatos escolhidos pela família.</p><ol className="beta-steps"><li>Organize sua família.</li><li>Prepare os aparelhos Android.</li><li>Façam a primeira conversa.</li></ol><p className="beta-note">Nesta fase, as chamadas usam o app em dois aparelhos Android 8 ou superior. O painel organiza os contatos.</p></section><section className="beta-card" aria-label="Acesso ao Telefoninho">
    {loading && mode === "invite" && !invitation && <p role="status">Conferindo seu convite…</p>}
    {error && <p className="beta-error" role="alert">{error}</p>}
    {message && <><p role="status">{message}</p><Link href="/login">Voltar para o acesso →</Link></>}
    {invitation?.existingAccount && <><h2>Você já tem uma conta.</h2><p>Entre com {invitation.email} para aceitar o convite. Sua conta será preservada.</p><Link className="beta-button" href={`/login#convite=${encodeURIComponent(token)}`}>Entrar e aceitar convite</Link></>}
    {formVisible && <form onSubmit={submit}>
      {mode === "invite" && <div className="form-group"><label htmlFor="name">Seu nome</label><input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={96} required /></div>}
      {mode !== "reset" && <div className="form-group"><label htmlFor="email">Seu e-mail</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={mode === "invite"} maxLength={254} required /></div>}
      {mode !== "forgot" && <div className="form-group"><label htmlFor="password">{mode === "login" ? "Senha" : "Escolha uma senha"}</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "login" ? 1 : 10} maxLength={128} required />{mode !== "login" && <small>Use pelo menos 10 caracteres.</small>}</div>}
      {mode === "invite" && <label className="beta-checkbox"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>Sou responsável pela configuração e li a <a href="https://telefoninho.com.br/privacy.html" target="_blank" rel="noreferrer">política de privacidade</a>.</span></label>}
      <button className="primary beta-submit" disabled={loading}>{loading ? "Aguarde…" : label}</button>
    </form>}
    {mode === "login" && <><Link className="beta-secondary" href="/esqueci-senha">Esqueci minha senha</Link><p className="beta-note">Ainda não tem acesso? O cadastro é por convite. Abra o link recebido por e-mail.</p></>}
  </section></div></BetaShell>;
}
