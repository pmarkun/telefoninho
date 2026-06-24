"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "../notify-context";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

interface Member {
  id: string;
  familyId: string;
  kind: string;
  displayName: string;
  avatarKey: string;
  colorKey: string;
  active: boolean;
  sipExtension: string | null;
}

export default function MembersPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formKind, setFormKind] = useState("child");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingExpires, setPairingExpires] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    setParentName(pn || "");
    loadData(t);
  }, [router]);

  async function loadData(t: string) {
    const h = { Authorization: `Bearer ${t}` };
    try {
      const familiesRes = await fetch(`${API}/families`, { headers: h });
      if (!familiesRes.ok) { notify("Erro ao carregar famílias", "error"); return; }
      const families = await familiesRes.json();
      if (families.length > 0) {
        const fid = families[0].id;
        setFamilyId(fid);
        const membersRes = await fetch(`${API}/families/${fid}/members`, { headers: h });
        if (!membersRes.ok) { notify("Erro ao carregar membros", "error"); return; }
        setMembers(await membersRes.json());
      }
    } catch {
      notify("Erro de conexão", "error");
    }
  }

  async function createMember() {
    if (!formName.trim()) { notify("Informe um nome", "error"); return; }
    try {
      const res = await fetch(`${API}/families/${familyId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: formKind, displayName: formName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify(err.error || "Erro ao criar membro", "error");
        return;
      }
      setShowForm(false);
      setFormName("");
      notify("Membro criado com sucesso", "success");
      loadData(token);
    } catch {
      notify("Erro de conexão ao criar membro", "error");
    }
  }

  async function toggleActive(member: Member) {
    try {
      const res = await fetch(`${API}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !member.active }),
      });
      if (!res.ok) { notify("Erro ao alterar status", "error"); return; }
      notify(member.active ? "Membro desativado" : "Membro ativado", "success");
      loadData(token);
    } catch {
      notify("Erro de conexão", "error");
    }
  }

  async function generatePairing(member: Member) {
    try {
      const res = await fetch(`${API}/members/${member.id}/pairing-code`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { notify("Erro ao gerar código", "error"); return; }
      const data = await res.json();
      setPairingCode(data.code);
      setPairingExpires(new Date(data.expiresAt).toLocaleString());
      notify("Código de pareamento gerado", "success");
    } catch {
      notify("Erro de conexão ao gerar código", "error");
    }
  }

  async function deleteMember(member: Member) {
    if (!confirm(`Remover ${member.displayName}?`)) return;
    try {
      const res = await fetch(`${API}/members/${member.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { notify("Erro ao remover membro", "error"); return; }
      notify(`Membro ${member.displayName} removido`, "success");
      loadData(token);
    } catch {
      notify("Erro de conexão ao remover membro", "error");
    }
  }

  return (
    <div>
      <nav className="nav">
        <a href="/dashboard" className="brand">Telefoninho</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/members">Membros</a>
        <a href="/permissions">Permissões</a>
        <a href="/call-logs">Chamadas</a>
        <span className="spacer" />
        <span className="user">{parentName}</span>
        <a href="/login" onClick={(e) => { e.preventDefault(); localStorage.clear(); router.push("/login"); }}>Sair</a>
      </nav>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Membros</h1>
          <button className="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "+ Novo Membro"}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h2>Novo Membro</h2>
            <div className="form-group">
              <label>Nome</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do membro" />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={formKind} onChange={(e) => setFormKind(e.target.value)}>
                <option value="child">Criança</option>
                <option value="adult">Adulto</option>
                <option value="external">Externo</option>
              </select>
            </div>
            <button className="primary" onClick={createMember}>Criar</button>
          </div>
        )}

        {pairingCode && (
          <div className="card" style={{ background: "var(--accent-light)" }}>
            <h2>Código de Pareamento</h2>
            <p style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "0.5rem", textAlign: "center" }}>
              {pairingCode}
            </p>
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Expira em: {pairingExpires}</p>
            <button onClick={() => setPairingCode("")} style={{ display: "block", margin: "0 auto" }}>Fechar</button>
          </div>
        )}

        <div className="card">
          {members.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhum membro. Crie o primeiro!</p>
          ) : (
            <table>
              <thead>
                <tr><th>Nome</th><th>Tipo</th><th>Ramal</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.displayName}</strong></td>
                    <td>{m.kind}</td>
                    <td>{m.sipExtension || "—"}</td>
                    <td>
                      <span className={`badge ${m.active ? "active" : "inactive"}`}>
                        {m.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => toggleActive(m)}>
                          {m.active ? "Desativar" : "Ativar"}
                        </button>
                        <button onClick={() => generatePairing(m)}>
                          Parear
                        </button>
                        <button className="danger" onClick={() => deleteMember(m)}>
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
