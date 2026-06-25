"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
}

interface Rule {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  enabled: boolean;
}

export default function PermissionsPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);

  const tokenRef = useRef("");

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push("/login"); return; }
    tokenRef.current = session.token;
    setParentName(session.parentName);
    setParentRole(session.parentRole);
    loadPermissions(session.token, setMembers, setRules, notify, setFamilies, setActiveFamily);
  }, [router, notify]);

  const getRule = useCallback(
    (fromId: string, toId: string): Rule | undefined =>
      rules.find((r) => r.fromMemberId === fromId && r.toMemberId === toId),
    [rules],
  );

  const isEnabled = useCallback(
    (fromId: string, toId: string): boolean => {
      const rule = getRule(fromId, toId);
      return rule ? rule.enabled : false;
    },
    [getRule],
  );

  async function toggle(fromId: string, toId: string, currentEnabled: boolean) {
    setSaving(true);
    const newEnabled = !currentEnabled;
    try {
      const res = await fetch(`${API}/allowed-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ fromMemberId: fromId, toMemberId: toId, enabled: newEnabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao salvar" }));
        notify(err.error || "Erro ao salvar permissão", "error");
        return;
      }
      const saved = await res.json();
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      notify(
        newEnabled
          ? "Permissão ativada. Config VoIP pendente."
          : "Permissão desativada. Config VoIP pendente.",
        "success",
      );
    } catch {
      notify("Erro de conexão ao salvar permissão", "error");
    } finally {
      setSaving(false);
    }
  }

  function changeFamily(familyId: string) {
    setActiveFamilyId(familyId);
    loadPermissions(tokenRef.current, setMembers, setRules, notify, setFamilies, setActiveFamily, familyId);
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
        <h1>Matriz de Permissões</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Marque quais membros podem ligar uns para os outros. Depois regenere a Config VoIP no Dashboard.
        </p>
        {members.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Nenhum membro encontrado.</p>
        ) : (
          <div className="table-wrapper">
            <table className="permission-matrix">
              <thead>
                <tr>
                  <th>De ↓ / Para →</th>
                  {members.map((m) => (
                    <th key={m.id} className={`matrix-col ${!m.active ? "inactive-member" : ""}`}>
                      {m.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((from) => (
                  <tr key={from.id} className={!from.active ? "inactive-member" : ""}>
                    <td className="matrix-row-label">
                      <strong>{from.displayName}</strong>
                      <span className={`badge ${from.active ? "active" : "inactive"}`}>
                        {from.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    {members.map((to) => {
                      const enabled = isEnabled(from.id, to.id);
                      return (
                        <td key={to.id} className="matrix-cell">
                          {from.id === to.id ? (
                            <span className="matrix-diagonal">—</span>
                          ) : (
                            <label className="matrix-checkbox-label">
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={saving || !from.active || !to.active}
                                onChange={() => toggle(from.id, to.id, enabled)}
                              />
                              <span className={`matrix-checkmark ${enabled ? "on" : "off"}`}>
                                {enabled ? "✓" : "✗"}
                              </span>
                            </label>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {saving && <p style={{ color: "var(--text-muted)" }}>Salvando...</p>}
      </div>
    </div>
  );
}

async function loadPermissions(
  token: string,
  setMembers: (v: Member[]) => void,
  setRules: (v: Rule[]) => void,
  notify: (msg: string, type?: "success" | "error" | "info") => void,
  setFamilies: (v: Family[]) => void,
  setActiveFamily: (v: Family | null) => void,
  selectedFamilyId?: string,
) {
  try {
    const families = await loadFamilies(token);
    setFamilies(families);
    if (families.length === 0) { notify("Nenhuma família encontrada", "error"); return; }
    const family = selectedFamilyId
      ? families.find((item) => item.id === selectedFamilyId) || families[0]
      : chooseActiveFamily(families);
    setActiveFamily(family);
    if (!family) return;
    setActiveFamilyId(family.id);
    const fid = family.id;

    const permRes = await fetch(`${API}/families/${fid}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!permRes.ok) { notify("Erro ao carregar permissões", "error"); return; }
    const data = await permRes.json();
    setMembers(data.members || []);
    setRules(data.rules || []);
  } catch {
    notify("Erro de conexão ao carregar permissões", "error");
  }
}
