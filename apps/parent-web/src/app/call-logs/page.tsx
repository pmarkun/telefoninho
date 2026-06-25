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

interface CallLog {
  id: string;
  fromExtension: string;
  toExtension: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  status: string;
  blockReason: string | null;
}

const statusLabels: Record<string, string> = {
  answered: "Atendida",
  missed: "Perdida",
  declined: "Recusada",
  blocked: "Bloqueada",
  failed: "Falha",
};

export default function CallLogsPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [families, setFamilies] = useState<Family[]>([]);
  const [activeFamily, setActiveFamily] = useState<Family | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.push("/login"); return; }
    setToken(session.token);
    setParentName(session.parentName);
    setParentRole(session.parentRole);
    loadLogs(session.token);
  }, [router, notify]);

  async function loadLogs(t = token, selectedFamilyId?: string) {
    if (!t) return;
    try {
      const familyList = await loadFamilies(t);
      setFamilies(familyList);
      const family = selectedFamilyId
        ? familyList.find((item) => item.id === selectedFamilyId) || familyList[0] || null
        : chooseActiveFamily(familyList);
      setActiveFamily(family);
      if (!family) {
        setLogs([]);
        return;
      }
      setActiveFamilyId(family.id);

      const res = await fetch(`${API}/admin/call-logs?familyId=${family.id}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      setLogs(await res.json());
    } catch {
      notify("Erro ao carregar histórico de chamadas", "error");
    }
  }

  function changeFamily(familyId: string) {
    setActiveFamilyId(familyId);
    loadLogs(token, familyId);
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
        <h1>Histórico de Chamadas</h1>
        {logs.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Nenhuma chamada registrada.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>De</th>
                  <th>Para</th>
                  <th>Duração</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.startedAt).toLocaleString("pt-BR")}</td>
                    <td>{log.fromExtension}</td>
                    <td>{log.toExtension}</td>
                    <td>{log.durationSeconds ? `${log.durationSeconds}s` : "—"}</td>
                    <td>
                      <span className={`badge ${log.status === "answered" ? "active" : "inactive"}`}>
                        {statusLabels[log.status] || log.status}
                      </span>
                      {log.blockReason && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                          ({log.blockReason})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
