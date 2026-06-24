# Telefoninho

Monorepo do MVP Telefoninho (fases iniciais de bootstrap).

## Estrutura

- `apps/child-android` app Android (Jetpack Compose)
- `apps/parent-web` painel web parental (Next.js)
- `services/api` backend Fastify + Prisma
- `packages/shared` tipos/validações compartilhadas
- `infra/asterisk` Docker e templates de configuração
- `scripts` scripts de automação de desenvolvimento
- `docs` documentação e especificação

## Ambiente de desenvolvimento

Este repositório usa `nix develop` para padronizar ferramentas locais.

```bash
nix develop
```

Dentro da shell:

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Stack alvo

- Backend/painel: TypeScript (Node 22+, Fastify, Prisma, Zod, Next.js)
- Android: Kotlin + Jetpack Compose
- VoIP: Asterisk + PJSIP

## Fase implementada

Atualmente está pronto o esqueleto da Fase A do spec:

- estrutura de pastas padronizada
- stubs iniciais para API, web, app Android e infra
- docker-compose e scripts de bootstrap
- configs básicas de ambiente e documentação inicial

## Próximos passos

1. Implementar entidades Prisma e seed inicial
2. Criar endpoints de auth, membros, pareamento e regras
3. Implementar geração Asterisk
4. Evoluir telas Android e fluxo de chamada

