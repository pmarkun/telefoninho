"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "../notify-context";
import {
  API,
  chooseActiveFamily,
  Family,
  getSession,
  loadFamilies,
  NavBar,
  ParentRole,
  setActiveFamilyId,
} from "../session";

interface Member {
  id: string;
  displayName: string;
  kind: string;
  active: boolean;
  sipExtension: string | null;
}

interface AsteriskStatus {
  pending: boolean;
  lastGeneratedAt: string | null;
  lastAppliedAt: string | null;
  lastError: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState({ families: 0, members: 0, totalCalls: 0 });
  const [asteriskStatus, setAsteriskStatus] = useState<AsteriskStatus | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push("/login"); return; }
    setToken(session.token);
    setParentName(session.parentName);
    setParentRole(session.parentRole);
    loadDashboard(session.token);
  }, [router, notify]);

  async function loadDashboard(t = token, familyId?: string) {
    if (!t) return;
    const h = { Authorization: `Bearer ${t}` };
    try {
      const familyList = await loadFamilies(t);
      setFamilies(familyList);
      const chosen = familyId
        ? familyList.find((family) => family.id === familyId) || familyList[0] || null
        : chooseActiveFamily(familyList);
      setActiveFamily(chosen);
      if (!chosen) {
        setMembers([]);
        return;
      }
      setActiveFamilyId(chosen.id);

      const membersRes = await fetch(`${API}/families/${chosen.id}/members`, { headers: h });
      if (!membersRes.ok) throw new Error("members");
      setMembers(await membersRes.json());

      const statsRes = await fetch(`${API}/admin/stats?familyId=${chosen.id}`, { headers: h });
      if (!statsRes.ok) throw new Error("stats");
      setStats(await statsRes.json());

      if (getSession()?.parentRole === "admin") await loadAsteriskStatus(t, setAsteriskStatus, notify);
    } catch {
      notify("Erro ao carregar dashboard", "error");
    }
  }

  function changeFamily(familyId: string) {
    setActiveFamilyId(familyId);
    loadDashboard(token, familyId);
  }

  async function regenerateAsterisk() {
    setRegenerating(true);
    try {
      const res = await fetch(`${API}/admin/asterisk/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao regenerar config VoIP" }));
        throw new Error(err.error || "Erro ao regenerar config VoIP");
      }
      const data = await res.json();
      notify(`Config VoIP aplicada para ${data.generatedAccounts} contas SIP`, "success");
      await loadAsteriskStatus(token, setAsteriskStatus, notify);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao regenerar config VoIP", "error");
      if (token) {
        await loadAsteriskStatus(token, setAsteriskStatus, notify);
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div>
      <NavBar
        parentName={parentName}
        parentRole={parentRole}
        families={families}
        activeFamilyId={activeFamily?.id || ""}
        onFamilyChange={changeFamily}
      />
      <div className="container">
        <h1>Dashboard{activeFamily ? ` · ${activeFamily.name}` : ""}</h1>
        <div className="card"><h2>Preparar o Telefoninho</h2><p>Organize os contatos, pareie os aparelhos e teste a primeira chamada.</p><a href="/primeiros-passos">Continuar os primeiros passos →</a></div>
        <div className="grid-3">
          <div className="card">
            <h3>{stats.families}</h3>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Famílias</p>
          </div>
          <div className="card">
            <h3>{stats.members}</h3>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Membros</p>
          </div>
          <div className="card">
            <h3>{stats.totalCalls}</h3>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Chamadas</p>
          </div>
        </div>

        <div className="card">
          <h2>Membros</h2>
          {members.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhum membro encontrado.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Nome</th><th>Tipo</th><th>Ramal</th><th>Status</th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.displayName}</td>
                    <td>{m.kind}</td>
                    <td>{m.sipExtension || "—"}</td>
                    <td>
                      <span className={`badge ${m.active ? "active" : "inactive"}`}>
                        {m.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {parentRole === "admin" && <div className="grid-2">
          <div className="card">
            <h2>Asterisk</h2>
            {asteriskStatus?.pending ? (
              <div
                style={{
                  border: "1px solid #f59e0b",
                  background: "rgba(245, 158, 11, 0.12)",
                  padding: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <strong>Configuração VoIP pendente</strong>
                <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)" }}>
                  Permissões ou contas SIP mudaram. Regenere para aplicar no Asterisk.
                </p>
                {asteriskStatus.lastError && (
                  <p style={{ margin: "0.5rem 0 0", color: "#ef4444" }}>{asteriskStatus.lastError}</p>
                )}
              </div>
            ) : (
              <p className="status-ok">● Config VoIP aplicada</p>
            )}
            {asteriskStatus?.lastAppliedAt && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Última aplicação: {formatDateTime(asteriskStatus.lastAppliedAt)}
              </p>
            )}
            <button onClick={regenerateAsterisk} className="primary" disabled={regenerating || !token}>
              {regenerating ? "Regenerando..." : "Regenerar Config VoIP"}
            </button>
          </div>
          <div className="card">
            <h2>API Status</h2>
            <p className="status-ok">● Online</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {API}
            </p>
          </div>
        </div>}
      </div>
    </div>
  );
}

async function loadAsteriskStatus(
  token: string,
  setAsteriskStatus: (v: AsteriskStatus) => void,
  notify: (msg: string, type?: "success" | "error" | "info") => void,
) {
  try {
    const res = await fetch(`${API}/admin/asterisk/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    setAsteriskStatus(await res.json());
  } catch {
    notify("Erro ao carregar status VoIP", "error");
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
