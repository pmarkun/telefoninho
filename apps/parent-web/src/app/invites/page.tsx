"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "../notify-context";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

type Member = {
  id: string;
  familyId: string;
  kind: string;
  displayName: string;
  active: boolean;
};

type ContactRequest = {
  id: string;
  status: string;
  requesterMemberId: string;
  requesterDisplayName: string;
  requesterKind: string;
  targetMemberId: string;
  targetDisplayName: string;
  targetKind: string;
  createdAt: string;
  resolvedAt: string | null;
};

type InviteResponse = {
  token: string;
  expiresAt: string;
  qrPayload: {
    type: "telefoninho-contact";
    version: 1;
    token: string;
  };
};

function parseQrToken(value: string): string | null {
  try {
    const payload = JSON.parse(value);
    if (
      payload &&
      payload.type === "telefoninho-contact" &&
      payload.version === 1 &&
      typeof payload.token === "string"
    ) {
      return payload.token;
    }
  } catch {
    return null;
  }
  return null;
}

export default function InvitesPage() {
  const router = useRouter();
  const { notify } = useNotify();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [token, setToken] = useState("");
  const [parentName, setParentName] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedRequesterId, setSelectedRequesterId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState("");
  const [scannerActive, setScannerActive] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    setParentName(pn || "");
    loadData(t);
    return () => controlsRef.current?.stop();
  }, [router]);

  async function loadData(t: string) {
    const headers = { Authorization: `Bearer ${t}` };
    try {
      const familiesRes = await fetch(`${API}/families`, { headers });
      if (!familiesRes.ok) { notify("Erro ao carregar famílias", "error"); return; }
      const families = await familiesRes.json();
      if (!Array.isArray(families) || families.length === 0) return;

      const fid = families[0].id;
      setFamilyId(fid);

      const membersRes = await fetch(`${API}/families/${fid}/members`, { headers });
      if (!membersRes.ok) { notify("Erro ao carregar membros", "error"); return; }
      const memberList = await membersRes.json();
      setMembers(memberList);
      if (memberList.length > 0) {
        setSelectedOwnerId((current) => current || memberList[0].id);
        setSelectedRequesterId((current) => current || memberList[0].id);
      }

      await loadRequests(t, fid);
    } catch {
      notify("Erro de conexão", "error");
    }
  }

  async function loadRequests(t = token, fid = familyId) {
    if (!t || !fid) return;
    try {
      const res = await fetch(`${API}/families/${fid}/contact-requests`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) { notify("Erro ao carregar pedidos", "error"); return; }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      notify("Erro de conexão ao carregar pedidos", "error");
    }
  }

  async function generateInvite() {
    if (!selectedOwnerId) { notify("Escolha um membro", "error"); return; }
    try {
      const res = await fetch(`${API}/members/${selectedOwnerId}/contact-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) { notify("Erro ao gerar QR", "error"); return; }
      const data: InviteResponse = await res.json();
      const dataUrl = await QRCode.toDataURL(JSON.stringify(data.qrPayload), {
        margin: 2,
        width: 320,
      });
      setQrDataUrl(dataUrl);
      setQrExpiresAt(new Date(data.expiresAt).toLocaleString());
      notify("QR de contato gerado", "success");
    } catch {
      notify("Erro de conexão ao gerar QR", "error");
    }
  }

  async function claimInvite(inviteToken: string) {
    if (!selectedRequesterId) { notify("Escolha quem vai adicionar", "error"); return; }
    try {
      const res = await fetch(`${API}/contact-invites/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: inviteToken, requesterMemberId: selectedRequesterId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "QR inválido", "error");
        return;
      }
      notify(data.status === "auto_approved" ? "Contato adicionado" : "Pedido enviado", "success");
      await loadRequests();
    } catch {
      notify("Erro de conexão ao usar QR", "error");
    }
  }

  async function startScanner() {
    if (!videoRef.current) return;
    setScannerActive(true);
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result) => {
        if (!result) return;
        const inviteToken = parseQrToken(result.getText());
        controlsRef.current?.stop();
        setScannerActive(false);
        if (!inviteToken) {
          notify("QR não é um convite do Telefoninho", "error");
          return;
        }
        await claimInvite(inviteToken);
      });
      controlsRef.current = controls;
    } catch {
      setScannerActive(false);
      notify("Não foi possível abrir a câmera", "error");
    }
  }

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScannerActive(false);
  }

  async function resolveRequest(requestId: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`${API}/contact-requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) { notify("Erro ao atualizar pedido", "error"); return; }
      notify(action === "approve" ? "Pedido aprovado" : "Pedido recusado", "success");
      await loadRequests();
    } catch {
      notify("Erro de conexão ao atualizar pedido", "error");
    }
  }

  const pending = requests.filter((request) => request.status === "pending");

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
        <h1>Convites por QR</h1>

        <div className="grid-2">
          <div className="card">
            <h2>Gerar QR</h2>
            <div className="form-group">
              <label>Contato que vai aparecer no QR</label>
              <select value={selectedOwnerId} onChange={(e) => setSelectedOwnerId(e.target.value)}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.displayName} ({member.kind})</option>
                ))}
              </select>
            </div>
            <button className="primary" onClick={generateInvite}>Gerar QR</button>
            {qrDataUrl && (
              <div className="qr-panel">
                <img src={qrDataUrl} alt="QR de convite de contato" />
                <p>Expira em: {qrExpiresAt}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Ler QR</h2>
            <div className="form-group">
              <label>Quem vai adicionar o contato</label>
              <select value={selectedRequesterId} onChange={(e) => setSelectedRequesterId(e.target.value)}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.displayName} ({member.kind})</option>
                ))}
              </select>
            </div>
            <video ref={videoRef} className="qr-video" muted />
            <div className="button-row">
              <button className="primary" onClick={startScanner} disabled={scannerActive}>Abrir câmera</button>
              <button onClick={stopScanner} disabled={!scannerActive}>Parar</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Pedidos pendentes</h2>
          {pending.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nenhum pedido pendente.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Quem pediu</th><th>Contato</th><th>Criado em</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {pending.map((request) => (
                  <tr key={request.id}>
                    <td>{request.requesterDisplayName} ({request.requesterKind})</td>
                    <td>{request.targetDisplayName} ({request.targetKind})</td>
                    <td>{new Date(request.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="button-row">
                        <button className="primary" onClick={() => resolveRequest(request.id, "approve")}>Aprovar</button>
                        <button className="danger" onClick={() => resolveRequest(request.id, "reject")}>Recusar</button>
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
