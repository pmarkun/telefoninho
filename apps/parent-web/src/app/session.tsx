"use client";

import { useRouter } from "next/navigation";

export const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
export const ACTIVE_FAMILY_KEY = "activeFamilyId";

export type Family = {
  id: string;
  name: string;
  active: boolean;
};

export type ParentRole = "admin" | "responsible";

export type SessionInfo = {
  token: string;
  parentName: string;
  parentRole: ParentRole;
};

export function getSession(): SessionInfo | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return {
    token,
    parentName: localStorage.getItem("parentName") || "",
    parentRole: (localStorage.getItem("parentRole") === "admin" ? "admin" : "responsible"),
  };
}

export async function loadFamilies(token: string): Promise<Family[]> {
  const res = await fetch(`${API}/families`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erro ao carregar famílias");
  return res.json();
}

export function chooseActiveFamily(families: Family[]): Family | null {
  if (families.length === 0) return null;
  const stored = localStorage.getItem(ACTIVE_FAMILY_KEY);
  return families.find((family) => family.id === stored) || families[0];
}

export function setActiveFamilyId(familyId: string): void {
  localStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
}

export function NavBar({
  parentName,
  parentRole,
  families,
  activeFamilyId,
  onFamilyChange,
}: {
  parentName: string;
  parentRole: ParentRole;
  families: Family[];
  activeFamilyId: string;
  onFamilyChange: (familyId: string) => void;
}) {
  const router = useRouter();

  return (
    <nav className="nav">
      <a href="/dashboard" className="brand">Telefoninho</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/families">Famílias</a>
      <a href="/members">Membros</a>
      <a href="/permissions">Permissões</a>
      <a href="/invites">Convites</a>
      <a href="/call-logs">Chamadas</a>
      <a href="/users">Usuários</a>
      <span className="spacer" />
      {families.length > 0 && (
        <select
          className="family-switcher"
          value={activeFamilyId}
          onChange={(event) => onFamilyChange(event.target.value)}
          aria-label="Família ativa"
        >
          {families.map((family) => (
            <option key={family.id} value={family.id}>{family.name}</option>
          ))}
        </select>
      )}
      <span className="user">{parentName}{parentRole === "admin" ? " · admin" : ""}</span>
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
  );
}
