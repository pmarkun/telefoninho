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

export default function FamiliesPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

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
      if (family) setActiveFamilyId(family.id);
    } catch {
      notify("Erro ao carregar famílias", "error");
    }
  }

  function changeFamily(familyId: string) {
    setActiveFamilyId(familyId);
    reload(token, familyId);
  }

  async function createFamily() {
    if (!newName.trim()) { notify("Informe o nome da família", "error"); return; }
    try {
      const res = await fetch(`${API}/families`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      const family = await res.json();
      setNewName("");
      setActiveFamilyId(family.id);
      notify("Família criada", "success");
      await reload(token, family.id);
    } catch {
      notify("Erro ao criar família", "error");
    }
  }

  async function saveFamily(familyId: string) {
    if (!editingName.trim()) { notify("Informe o nome da família", "error"); return; }
    try {
      const res = await fetch(`${API}/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (!res.ok) throw new Error();
      setEditingId("");
      setEditingName("");
      notify("Família atualizada", "success");
      await reload(token, familyId);
    } catch {
      notify("Erro ao atualizar família", "error");
    }
  }

  async function archiveFamily(family: Family) {
    if (!confirm(`Arquivar ${family.name}?`)) return;
    try {
      const res = await fetch(`${API}/families/${family.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      localStorage.removeItem("activeFamilyId");
      notify("Família arquivada. Config VoIP pendente.", "success");
      await reload(token);
    } catch {
      notify("Erro ao arquivar família", "error");
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
        <h1>Famílias</h1>

        <div className="card">
          <h2>Nova família</h2>
          <div className="button-row">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome da família" />
            <button className="primary" onClick={createFamily}>Criar</button>
          </div>
        </div>

        <div className="card">
          <h2>Famílias ativas</h2>
          {families.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhuma família ativa.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Nome</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {families.map((family) => (
                  <tr key={family.id}>
                    <td>
                      {editingId === family.id ? (
                        <input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                      ) : (
                        <strong>{family.name}</strong>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${family.id === activeFamily?.id ? "active" : "inactive"}`}>
                        {family.id === activeFamily?.id ? "Selecionada" : "Ativa"}
                      </span>
                    </td>
                    <td>
                      <div className="button-row">
                        <button onClick={() => changeFamily(family.id)}>Selecionar</button>
                        {editingId === family.id ? (
                          <button className="primary" onClick={() => saveFamily(family.id)}>Salvar</button>
                        ) : (
                          <button onClick={() => { setEditingId(family.id); setEditingName(family.name); }}>Editar</button>
                        )}
                        <button className="danger" onClick={() => archiveFamily(family)}>Arquivar</button>
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
