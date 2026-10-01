"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onboardingSchema, parentSessionSchema, type Onboarding } from "@telefoninho/shared/beta";
import { BetaShell } from "../components/beta-shell";
import { betaRequest, rememberSession } from "../components/auth-form";
import { chooseActiveFamily, type Family, setActiveFamilyId } from "../session";

type Pairing = { code: string; expiresAt: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [state, setState] = useState<Onboarding | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [childName, setChildName] = useState("");
  const [adultName, setAdultName] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [codes, setCodes] = useState<Record<string, Pairing>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    betaRequest("/auth/me").then((data) => {
      const session = parentSessionSchema.parse(data); rememberSession(session); setFamilies(session.families);
      const chosen = chooseActiveFamily(session.families);
      setFamilyId(chosen?.id || ""); setFamilyName(chosen?.name || ""); setAdultName(session.parent.displayName);
    }).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!familyId) return;
    let active = true;
    const refresh = async () => {
      try { const data = onboardingSchema.parse(await betaRequest(`/families/${familyId}/onboarding`)); if (active) setState(data); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar sua família."); }
    };
    setState(null); setCodes({}); setActiveFamilyId(familyId); void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [familyId]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); if (familyId) setState(onboardingSchema.parse(await betaRequest(`/families/${familyId}/onboarding`))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível continuar."); }
    finally { setBusy(false); }
  }
  function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => { await betaRequest(`/families/${familyId}/onboarding`, { familyName, childName, adultName, allowCalls: allowed }); });
  }
  async function pair(memberId: string) {
    await perform(async () => {
      const data = await betaRequest(`/members/${memberId}/pairing-code`, {});
      setCodes((previous) => ({ ...previous, [memberId]: { code: data.code, expiresAt: data.expiresAt } }));
    });
  }
  const paired = state?.members.filter((member) => member.pairedAt).length || 0;
  return <BetaShell><div className="beta-page-heading"><span className="beta-tag">SUA FAMÍLIA · PRIMEIROS PASSOS</span><h1>Vamos preparar a primeira conversa.</h1><p>Você pode sair e continuar de onde parou. As etapas concluídas ficam salvas.</p><div className="button-row"><Link href="/dashboard">Abrir painel →</Link>{families.length > 1 && <label>Família <select aria-label="Família" value={familyId} onChange={(event) => { setFamilyId(event.target.value); setFamilyName(families.find((family) => family.id === event.target.value)?.name || ""); }}>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label>}</div></div>
    {error && <p className="beta-error" role="alert">{error}</p>}
    {!familyId && <section className="beta-card"><h2>Aguardando sua família</h2><p>Se já entrou, abra seu convite para vincular a família. Você também pode criar uma pelo painel.</p><Link href="/families">Ver famílias →</Link></section>}
    {familyId && !state && <p role="status">Carregando seus primeiros passos…</p>}
    {state && <div className="beta-onboarding-grid"><section className="beta-card"><span className="beta-tag">01 · FAMÍLIA E CONTATOS</span><h2>{state.configured ? "Sua família está organizada." : "Quem vai conversar?"}</h2>
      {!state.configured && state.members.length === 0 && <form onSubmit={configure}><div className="form-group"><label htmlFor="family-name">Nome da família</label><input id="family-name" value={familyName} onChange={(event) => setFamilyName(event.target.value)} maxLength={96} required /></div><div className="form-group"><label htmlFor="child-name">Apelido da criança</label><input id="child-name" value={childName} onChange={(event) => setChildName(event.target.value)} maxLength={64} required /></div><div className="form-group"><label htmlFor="adult-name">Nome do primeiro contato</label><input id="adult-name" value={adultName} onChange={(event) => setAdultName(event.target.value)} maxLength={64} required /></div><label className="beta-checkbox"><input type="checkbox" checked={allowed} onChange={(event) => setAllowed(event.target.checked)} required /><span>Autorizo chamadas entre estes dois contatos, nos dois sentidos.</span></label><button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar família e contatos"}</button></form>}
      {!state.configured && state.members.length > 0 && <p>Esta família já tem contatos. Continue a configuração em <Link href="/members">Membros</Link> e <Link href="/permissions">Permissões</Link>.</p>}
      {state.configured && <><ul className="beta-member-list">{state.members.map((member) => <li key={member.id}><strong>{member.displayName}</strong><span>{member.kind === "child" ? "Perfil infantil" : "Contato da família"}</span></li>)}</ul><Link href="/members">Gerenciar contatos →</Link><p><Link href="/users">Convidar outro responsável →</Link></p></>}
    </section><section className="beta-card"><span className="beta-tag">02 · APARELHOS</span><h2>Um app em cada Android.</h2><p>Instale o Telefoninho em dois aparelhos com Android 8 ou superior. No beta, o contato adulto também usa o aplicativo. Este painel não recebe chamadas.</p>
      {state.downloadUrl ? <a className="beta-button" href={state.downloadUrl}>Instalar o aplicativo ↗</a> : <p className="beta-note">O link da versão de teste ainda não foi disponibilizado. Peça o aplicativo ao suporte antes de continuar.</p>}
      <ol><li>Instale a versão de teste nos dois aparelhos.</li><li>Abra o app e permita o microfone para chamadas.</li><li>Gere um código abaixo e digite no aparelho correspondente.</li></ol>
      {state.telephony === "preparing" && state.configured && <p role="status" className="beta-note">Estamos preparando a telefonia automaticamente. Se demorar, entre em contato com o suporte.</p>}
      {state.members.map((member) => <div className="beta-device" key={member.id}><h3>{member.displayName}</h3>{member.pairedAt ? <><p className="status-ok">Aparelho pareado: {member.deviceName}</p><button disabled={busy} onClick={() => { if (confirm("Desparear este aparelho? Ele perderá o acesso ao serviço.")) void perform(async () => { await betaRequest(`/members/${member.id}/unpair`, {}); }); }}>Desparear aparelho</button></> : <><button disabled={busy} onClick={() => { void pair(member.id); }}>{codes[member.id] ? "Gerar novo código" : "Gerar código de pareamento"}</button>{codes[member.id] && <p className="beta-pair-code"><strong>{codes[member.id].code}</strong><small>Válido até {new Date(codes[member.id].expiresAt).toLocaleTimeString("pt-BR")}. Um código por aparelho.</small></p>}</>}</div>)}
    </section><section className="beta-card beta-call-card"><span className="beta-tag">03 · PRIMEIRA CONVERSA</span><h2>{state.firstCallConfirmedAt ? "Primeira conversa confirmada!" : "Agora, testem uma ligação."}</h2>{state.firstCallConfirmedAt ? <><p>A família confirmou que ouviu a voz nos dois sentidos. Você pode continuar organizando os contatos no painel.</p><Link className="beta-button" href="/dashboard">Ir para o painel →</Link></> : <><p>Com os dois aparelhos conectados à internet, toque no contato e atenda no outro aparelho. Falem dos dois lados e encerrem a chamada.</p><p className="beta-note">Se não tocar, confira a internet e as permissões do app. Se o áudio falhar, teste o microfone e mantenha o app aberto durante este primeiro teste.</p><button className="primary" disabled={busy || !state.configured || paired < 2 || state.telephony !== "ready"} onClick={() => { void perform(async () => { await betaRequest(`/families/${familyId}/onboarding/confirm-call`, { audioBothWays: true }); }); }}>Conseguimos conversar nos dois sentidos</button>{paired < 2 && <p><small>Pareie os dois aparelhos para liberar esta etapa.</small></p>}</>}</section></div>}
  </BetaShell>;
}
