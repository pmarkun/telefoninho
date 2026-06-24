import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "./notify-context";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
