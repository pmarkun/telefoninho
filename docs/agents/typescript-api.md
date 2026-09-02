# TypeScript, API e Shared

Leia este arquivo quando mexer em `services/api`, `packages/shared`, schemas, endpoints, contratos ou validação.

## Código

- Strict mode: `strict: true`, sem `any` ou type assertions desnecessárias (`as`).
- Zod primeiro: validação de entrada sempre com Zod schemas, nunca manual.
- Prefira `type` a `interface`. Use `interface` só para declaration merging ou extensão pública.
- Sem classes em código de domínio/API. Prefira funções puras e objetos simples com injeção manual de dependências.
- Use `async`/`await`; não deixe callbacks ou `.then()` soltos.
- Use named exports (`export function`, `export const`), nunca `export default`.
- Use path aliases como `@telefoninho/shared/...` quando aplicável.

## Fastify e Contratos

- Fastify: registre plugins com `fastify.register()`, handlers assíncronos, validação com Zod/Zod-to-JSON-Schema quando houver schema.
- Requisições `POST` para Fastify devem enviar `Content-Type: application/json` e payload JSON, mesmo quando o endpoint não usa body.
- Esse cuidado evita `FST_ERR_CTP_INVALID_MEDIA_TYPE`, já visto no fluxo “Meu QR”.
- `/child/config` exige `Authorization: Bearer <token>`. Para refresh de contatos no Android, o pareamento precisa retornar e salvar token da criança.
- Ao adicionar endpoints ou contratos compartilhados, mantenha `packages/shared/src/types.ts`, API e Android sincronizados.

## Validação

- Rode conforme escopo:
  - `nix develop --command pnpm typecheck`
  - `nix develop --command pnpm lint`
  - `nix develop --command pnpm test`
- API: Vitest, preferencialmente testes de rota/integração por endpoint.
- Shared: Vitest para validação Zod e tipos utilitários.

