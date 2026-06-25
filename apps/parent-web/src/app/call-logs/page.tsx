"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "../notify-context";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

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
  const [parentName, setParentName] = useState("");
  const [logs, setLogs] = useState<CallLog[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) { router.push("/login"); return; }
    setParentName(pn || "");

    fetch(`${API}/admin/call-logs`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setLogs)
      .catch(() => notify("Erro ao carregar histórico de chamadas", "error"));
  }, [router, notify]);

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
