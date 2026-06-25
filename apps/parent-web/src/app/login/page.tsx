"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Credenciais inválidas");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("parentName", data.parent.displayName);
      localStorage.setItem("parentRole", data.parent.role || "responsible");
      if (Array.isArray(data.families) && data.families.length > 0) {
        localStorage.setItem("activeFamilyId", data.families[0].id);
      } else {
        localStorage.removeItem("activeFamilyId");
      }
      router.push("/dashboard");
    } catch {
      setError("Erro de conexão com o servidor");
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "4rem auto", padding: "1rem" }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Telefoninho</h1>
        <p style={{ color: "var(--text-muted)" }}>Painel Parental</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@demo.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="devpassword"
              required
            />
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button type="submit" className="primary" style={{ width: "100%" }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
