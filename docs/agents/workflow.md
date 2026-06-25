# Workflow, Git e Validação

## Fluxo de Desenvolvimento

1. Entre no ambiente com `nix develop` se ainda não estiver nele.
2. Rode `pnpm install` apenas se houver mudanças de dependências.
3. Faça mudanças pequenas e focadas.
4. Rode verificações relevantes.
5. Revise o diff com `git diff`.
6. Commit em unidade lógica pequena.

## Git

- Preserve mudanças locais do usuário. Antes de editar ou commitar, rode `git status --short`.
- Stageie só os arquivos da mudança atual. Pode haver mudanças locais intencionais, como `PLAN.md`.
- Não faça push direto para `main`.
- Se for publicar, crie branch descritiva e PR.
- Nunca force-push, rebase público ou apague branch remota sem confirmação explícita.

## Commits Atômicos

- Um commit = uma mudança lógica.
- Não misture refatoração, feature, docs e style se forem assuntos separados.
- Mensagem: `<tipo>(<escopo>): <descrição no imperativo>`.
- Tipos comuns: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`, `perf`.
- Título curto, até 72 caracteres quando possível.

## Verificações Recomendadas

- Monorepo TypeScript:
  - `nix develop --command pnpm typecheck`
  - `nix develop --command pnpm lint`
  - `nix develop --command pnpm test`
- Android, dentro de `apps/child-android`:
  - `nix develop --command ./gradlew assembleDebug`
  - `nix develop --command ./gradlew assembleDebug testDebugUnitTest`
- Script shell:
  - `bash -n scripts/<nome>.sh`
- Teste real quando houver celulares conectados:
  - `nix develop --command scripts/install-android.sh`
  - testar chamadas Pedro -> Maria e Maria -> Pedro;
  - verificar tocar, atender e áudio bidirecional.

## Estratégia de Testes

- API: Vitest, preferencialmente testes de rota/integração por endpoint.
- Shared: Vitest para validação Zod e tipos utilitários.
- Parent Web: lint/typecheck e testes de componente quando existirem.
- Child Android: JUnit/Compose Test para ViewModel/UI quando existir suporte.
- Se um teste não puder ser executado, registre comando, motivo e risco restante.

