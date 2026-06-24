# Instruções para o OpenCode (AGENTS.md)

## Padrões de Código

### TypeScript (API, Shared, Parent Web)

- **Strict mode**: `strict: true` no tsconfig, sem `any` ou type assertions desnecessárias (`as`).
- **Zod primeiro**: validação de entrada sempre com Zod schemas, nunca manual.
- **Prefira `type` a `interface`**: usar `type` para uniões, tuplas e objetos simples. `interface` só para declaration merging ou extensão pública.
- **Sem classes**: usar funções puras e objetos simples. Sem pattern `class XRepository` — preferir funções com injeção de dependência manual.
- **Async/await**: sem callbacks ou `.then()` solto. Tratar erros com `try/catch` ou Effect (se estiver no .opencode).
- **Named exports**: sempre `export function`/`export const`, nunca `export default`.
- **Path aliases**: usar `@telefoninho/shared/...` (definido no tsconfig.base.json).
- **Fastify**: plugins registrados com `fastify.register()`, handlers assíncronos, schemas de validação com Zod-to-JSON-Schema.
- **Next.js App Router**: Server Components por padrão, Client Components só quando necessário (eventos, estado, efeitos). Loading/error boundaries em cada rota.

### Kotlin/Compose (Child Android)

- **State hoisting**: estado no ViewModel, Compose só renderiza. `remember` só para estado local de UI (animações, input temporário).
- **Sem hardcoded strings**: usar recursos string.xml.
- **Material3**: seguir o design system Pixel (tema 8-bit definido no `PixelTheme`).
- **Corrotinas**: `viewModelScope.launch` para async, `StateFlow` para expor estado.

### Geral

- **Sem código comentado**: remover em vez de comentar.
- **Nomes descritivos**: `getActiveMembers()` em vez de `getData()`.
- **DRY com medida**: extrair repetição, mas evitar abstração prematura.
- **Side effects isolados**: IO, rede, banco de dados sempre em boundaries claras (services/api handlers, ViewModels).
- **Segurança**: secrets em variáveis de ambiente, nunca no código. `.env` no `.gitignore`.

## Commits Atômicos

- **Um commit = uma mudança lógica**. Exemplos:
  - `feat: add POST /api/family-members endpoint` — inclui schema, handler, teste.
  - `refactor: extract sip config generation to dedicated module` — só reorganização, sem mudança funcional.
  - `fix: validate pairing code expiry before activation` — correção localizada.
- **Não misturar**: refatoração e funcionalidade nova no mesmo commit. Style fixes com style fixes.
- **Mensagem de commit**: `<tipo>(<escopo>): <descrição no imperativo>`.
  - Tipos: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`.
  - Exemplo: `feat(api): add pairing code generation with TTL validation`.
  - Exemplo: `test(api): add integration tests for auth endpoints`.
- **Mensagens curtas** (≤72 chars no título). Corpo opcional com motivo e decisões.

## Testes Antes de Commitar

- **Todo commit deve passar**:
  1. `pnpm typecheck` — sem erros de tipo.
  2. `pnpm lint` — sem warnings (quando configurado).
  3. Testes do escopo modificado (quando existirem).
- **Estratégia de testes** (a implementar):
  - **API**: Vitest + Supertest, testes de integração por endpoint.
  - **Shared**: Vitest, testes unitários para validação Zod.
  - **Parent Web**: Testing Library + Vitest, testes de componente.
  - **Child Android**: JUnit + Compose Test, testes de ViewModel e UI.
- **Before commit hook** (futuro): configurar `simple-git-hooks` ou `husky` para rodar `pnpm typecheck && pnpm lint` automaticamente.

## Fluxo de Desenvolvimento

1. `nix develop` (se não estiver no shell Nix).
2. `pnpm install` se houver mudanças de dependências.
3. Fazer a mudança seguindo os padrões acima.
4. Rodar `pnpm typecheck` e `pnpm lint`.
5. Revisar diff com `git diff`.
6. Commitar com mensagem atômica.
7. (Opcional) `pnpm build` para verificar build completo.
