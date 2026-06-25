"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "../notify-context";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
  const [members, setMembers] = useState<Member[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState(false);

  const tokenRef = useRef("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) { router.push("/login"); return; }
    tokenRef.current = t;
    setParentName(pn || "");
    loadPermissions(t, setMembers, setRules, notify);
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

  return (
    <div>
      <nav className="nav">
        <a href="/dashboard" className="brand">Telefoninho</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/members">Membros</a>
        <a href="/permissions">Permissões</a>
        <a href="/invites">Convites</a>
        <a href="/call-logs">Chamadas</a>
        <span className="spacer" />
        <span className="user">{parentName}</span>
        <a href="/login" onClick={(e) => { e.preventDefault(); localStorage.clear(); router.push("/login"); }}>Sair</a>
      </nav>
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
) {
  try {
    const familiesRes = await fetch(`${API}/families`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!familiesRes.ok) { notify("Erro ao carregar famílias", "error"); return; }
    const families: { id: string }[] = await familiesRes.json();
    if (families.length === 0) { notify("Nenhuma família encontrada", "error"); return; }
    const fid = families[0].id;

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
