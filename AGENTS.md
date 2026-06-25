# AGENTS.md

Este arquivo deve ficar curto. Ele aponta para instrucoes mais especificas e guarda apenas regras essenciais para trabalhar neste repo.

## Essencial

- Antes de mudar codigo, leia os arquivos relevantes abaixo e o contexto local dos arquivos que serao alterados.
- Estamos no NixOS: use `nix develop` ou `nix develop --command ...` para build, testes, scripts e servidores locais.
- Preserve mudancas existentes no worktree. Nao reverta trabalho do usuario sem pedido explicito.
- Nunca altere secrets, `.env.production`, producao, banco ou VPS de forma destrutiva sem confirmacao explicita.
- Nao faca push direto para `main`. Para publicar, use branch descritiva e PR.
- Mantenha commits atomicos e rode as verificacoes relevantes antes de finalizar.
- A estetica do app infantil e sempre 8-bit/pixel.

## Instrucoes Detalhadas

- Regras gerais de codigo e seguranca: `docs/agents/general.md`
- Workflow de git, commits e validacao: `docs/agents/workflow.md`
- TypeScript, API Fastify e shared package: `docs/agents/typescript-api.md`
- Parent Web Next.js: `docs/agents/parent-web.md`
- Android child app, Compose, ADB e testes reais: `docs/agents/android.md`
- SIP, Asterisk e audio VoIP: `docs/agents/sip-asterisk.md`
- Deploy, VPS e operacao de servidor: `docs/agents/deploy.md`
