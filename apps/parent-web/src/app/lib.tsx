"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useNotify } from "./notify-context";
import { API, getSession, chooseActiveFamily, Family, NavBar, ParentRole, setActiveFamilyId } from "./session";

interface Member {
  id: string;
  displayName: string;
  kind: string;
  avatarKey: string;
  colorKey: string;
  active: boolean;
  sipExtension: string | null;
}

export function useApi() {
  const [token, setToken] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentRole, setParentRole] = useState<ParentRole>("responsible");
  const [family, setFamily] = useState<Family | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotify();
  const router = useRouter();

  useEffect(() => {
    const t = getSession()?.token;
    const pn = localStorage.getItem("parentName");
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
    setParentName(pn || "");
    setParentRole(localStorage.getItem("parentRole") === "admin" ? "admin" : "responsible");

    fetch(`${API}/families`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setFamilies(data);
          const selected = chooseActiveFamily(data);
          setFamily(selected);
          if (selected) setActiveFamilyId(selected.id);
        }
      })
      .catch(() => notify("Erro ao carregar dados da família", "error"));

    setLoading(false);
  }, [router, notify]);

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  return { token, parentName, parentRole, family, families, members, setMembers, headers, API, loading };
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { parentName, parentRole, family, families, loading } = useApi();

  if (loading) return <div className="container">Carregando...</div>;

  return (
    <div>
      <NavBar
        parentName={parentName}
        parentRole={parentRole}
        families={families}
        activeFamilyId={family?.id || ""}
        onFamilyChange={(familyId) => {
          setActiveFamilyId(familyId);
          window.location.reload();
        }}
      />
      <div className="container">{children}</div>
    </div>
  );
}
