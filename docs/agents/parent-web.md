# Parent Web

Leia este arquivo quando mexer em `apps/parent-web`.

- Next.js App Router: Server Components por padrão.
- Use Client Components só quando houver eventos, estado, efeitos ou APIs do browser.
- Mantenha loading/error boundaries quando criar rotas novas.
- Prefira componentes simples e claros; não misture lógica de API, estado visual e formatação quando puder separar sem exagero.
- Validação deve seguir contratos compartilhados de `packages/shared` quando aplicável.

## Validação

- Rode conforme escopo:
  - `nix develop --command pnpm typecheck`
  - `nix develop --command pnpm lint`
  - testes de componente quando existirem.

