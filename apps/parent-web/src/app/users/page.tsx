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

type Responsible = {
  id: string;
  email: string;
  displayName: string;
  role: ParentRole;
  active: boolean;
};

export default function UsersPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push("/login"); return; }
    setToken(session.token);
    setParentName(session.parentName);
    setParentRole(session.parentRole);
    reload(session.token);
  }, [router]);

  async function reload(t = token, selectedFamilyId?: string) {
    if (!t) return;
    try {
      const familyList = await loadFamilies(t);
      setFamilies(familyList);
      const family = selectedFamilyId
        ? familyList.find((item) => item.id === selectedFamilyId) || familyList[0] || null
        : chooseActiveFamily(familyList);
      setActiveFamily(family);
      if (!family) {
        setResponsibles([]);
        return;
      }
      setActiveFamilyId(family.id);
      const res = await fetch(`${API}/families/${family.id}/responsibles`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      setResponsibles(await res.json());
    } catch {
      notify("Erro ao carregar usuários", "error");
    }
  }

  function changeFamily(familyId: string) {
    setActiveFamilyId(familyId);
    reload(token, familyId);
  }

  async function addResponsible() {
    if (!activeFamily) return;
    if (!email.trim() || !displayName.trim()) {
      notify("Informe nome e email", "error");
      return;
    }
    try {
      const res = await fetch(`${API}/families/${activeFamily.id}/responsibles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          password: password || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Erro ao adicionar responsável", "error");
        return;
      }
      setEmail("");
      setDisplayName("");
      setPassword("");
      notify("Responsável adicionado", "success");
      await reload(token, activeFamily.id);
    } catch {
      notify("Erro ao adicionar responsável", "error");
    }
  }

  async function toggleResponsible(responsible: Responsible) {
    try {
      const res = await fetch(`${API}/responsibles/${responsible.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !responsible.active }),
      });
      if (!res.ok) throw new Error();
      notify(responsible.active ? "Usuário desativado" : "Usuário ativado", "success");
      await reload(token, activeFamily?.id);
    } catch {
      notify("Erro ao atualizar usuário", "error");
    }
  }

  async function unlinkResponsible(responsible: Responsible) {
    if (!activeFamily) return;
    if (!confirm(`Remover ${responsible.displayName} desta família?`)) return;
    try {
      const res = await fetch(`${API}/families/${activeFamily.id}/responsibles/${responsible.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Erro ao remover responsável", "error");
        return;
      }
      notify("Responsável removido da família", "success");
      await reload(token, activeFamily.id);
    } catch {
      notify("Erro ao remover responsável", "error");
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
        <h1>Usuários{activeFamily ? ` · ${activeFamily.name}` : ""}</h1>

        <div className="card">
          <h2>Novo responsável</h2>
          <div className="grid-3">
            <div className="form-group">
              <label>Nome</label>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Senha</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          </div>
          <button className="primary" onClick={addResponsible} disabled={!activeFamily}>Adicionar</button>
        </div>

        <div className="card">
          <h2>Responsáveis</h2>
          {responsibles.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhum responsável vinculado.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Nome</th><th>Email</th><th>Papel</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {responsibles.map((responsible) => (
                  <tr key={responsible.id}>
                    <td><strong>{responsible.displayName}</strong></td>
                    <td>{responsible.email}</td>
                    <td>{responsible.role}</td>
                    <td>
                      <span className={`badge ${responsible.active ? "active" : "inactive"}`}>
                        {responsible.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="button-row">
                        <button onClick={() => toggleResponsible(responsible)}>
                          {responsible.active ? "Desativar" : "Ativar"}
                        </button>
                        <button className="danger" onClick={() => unlinkResponsible(responsible)}>
                          Remover vínculo
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
