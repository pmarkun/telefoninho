"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useNotify } from "./notify-context";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

interface Member {
  id: string;
  displayName: string;
  kind: string;
  avatarKey: string;
  colorKey: string;
  active: boolean;
  sipExtension: string | null;
}

interface Family {
  id: string;
  name: string;
}

export function useApi() {
  const [token, setToken] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotify();
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("token");
    const pn = localStorage.getItem("parentName");
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
    setParentName(pn || "");

    fetch(`${API}/families`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setFamily(data[0]);
        }
      })
      .catch(() => notify("Erro ao carregar dados da família", "error"));

    setLoading(false);
  }, [router, notify]);

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  return { token, parentName, family, members, setMembers, headers, API, loading };
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { parentName, loading } = useApi();
  const router = useRouter();

  if (loading) return <div className="container">Carregando...</div>;

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
        <a
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            localStorage.clear();
            router.push("/login");
          }}
        >
          Sair
        </a>
      </nav>
      <div className="container">{children}</div>
    </div>
  );
}
