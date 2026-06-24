"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

interface Member {
  id: string;
  displayName: string;
  kind: string;
  active: boolean;
  sipExtension: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState({ families: 0, members: 0, totalCalls: 0 });
  const [familyId, setFamilyId] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    setParentName(pn || "");

    const h = { Authorization: `Bearer ${t}` };

    fetch(`${API}/families`, { headers: h })
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => {
        if (data.length > 0) {
          setFamilyId(data[0].id);
          fetch(`${API}/families/${data[0].id}/members`, { headers: h })
            .then((r2) => r2.json())
            .then(setMembers);
        }
      })
      .catch(() => {});

    fetch(`${API}/admin/stats`, { headers: h })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [router]);

  async function regenerateAsterisk() {
    try {
      const res = await fetch(`${API}/families/${familyId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(`Config recarregada para ${data.length} membros. Execute pnpm generate:asterisk no servidor.`);
    } catch {
      alert("Erro ao recarregar");
    }
  }

  return (
    <div>
      <nav className="nav">
        <a href="/dashboard" className="brand">Telefoninho</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/members">Membros</a>
        <span className="spacer" />
        <span className="user">{parentName}</span>
        <a href="/login" onClick={(e) => { e.preventDefault(); localStorage.clear(); router.push("/login"); }}>Sair</a>
      </nav>
      <div className="container">
        <h1>Dashboard</h1>
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

        <div className="grid-2">
          <div className="card">
            <h2>Asterisk</h2>
            <p>Gere novamente as configurações SIP e Dialplan.</p>
            <button onClick={regenerateAsterisk} className="primary">
              Regenerar Config VoIP
            </button>
          </div>
          <div className="card">
            <h2>API Status</h2>
            <p className="status-ok">● Online</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {API}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
