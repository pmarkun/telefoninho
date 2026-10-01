import Link from "next/link";
import type { ReactNode } from "react";

export function BetaShell({ children }: { children: ReactNode }) {
  return <div className="beta-shell"><header className="beta-header"><Link href="/login" className="beta-brand">☎ Telefoninho</Link><a href="https://telefoninho.com.br">O projeto ↗</a></header><main className="beta-content">{children}</main><footer className="beta-footer"><span>Conversas com quem a família escolhe.</span><a href="mailto:pedro@markun.com.br">Preciso de ajuda</a></footer></div>;
}
