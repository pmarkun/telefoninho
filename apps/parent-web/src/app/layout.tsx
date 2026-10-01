import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "./notify-context";
export const metadata = { title: "Telefoninho · sua família", description: "Organize sua família, prepare os aparelhos e converse com os contatos autorizados.", icons: { icon: "/favicon.png" } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
