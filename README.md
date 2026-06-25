# Telefoninho

Telefoninho é um sistema de telefone infantil controlado pelos pais. Crianças podem fazer chamadas apenas para contatos previamente autorizados no painel web. O sistema usa **Asterisk + PJSIP** como central VoIP e oferece um app Android com chamadas SIP reais via **Liblinphone**.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Fastify + Drizzle ORM + SQLite + Zod |
| Painel web | Next.js 15 (App Router) + Tailwind |
| App Android | Kotlin + Jetpack Compose + Liblinphone |
| VoIP | Asterisk + PJSIP |
| Infra | Docker Compose, Nix flake |

## Pré-requisitos

- **Opção A (Nix):** `nix develop` ativa o shell com Node 22, pnpm, JDK 17, Gradle, SQLite, Docker.
- **Opção B (manual):** Node 22+, pnpm 10, Docker + Compose, JDK 17 (só para Android), SQLite.

## Instalação e uso

```bash
# 1. Entrar no ambiente (Nix)
nix develop

# 2. Copiar configuração
cp .env.example .env
# Edite JWT_SECRET e, se necessário, DATABASE_URL

# 3. Instalar dependências
pnpm install

# 4. Aplicar schema do banco
pnpm db:push

# 5. Popular com dados de exemplo (família demo com 4 membros)
pnpm seed

# 6. Subir o Asterisk (Docker)
docker compose up -d asterisk

# 7. (Opcional) Gerar configs do Asterisk
pnpm infra:generate-asterisk

# 8. Iniciar desenvolvimento (API + web simultaneamente)
pnpm dev
```

- API: http://localhost:3001
- Painel web: http://localhost:3000
- Asterisk SIP: udp://localhost:5060

### Serviços individuais

```bash
pnpm dev:api     # só a API (porta 3001)
pnpm dev:web     # só o painel web (porta 3000)
```

## Testes

```bash
# Todos os testes (root do monorepo)
pnpm test

# Testes de um workspace específico
pnpm --filter @telefoninho/api test
pnpm --filter @telefoninho/shared test

# Testes de integração da API
pnpm --filter @telefoninho/api test:integration

# Assistir modo watch
pnpm --filter @telefoninho/api test:watch
```

## TypeScript

```bash
pnpm typecheck   # type-check todos os pacotes
pnpm lint        # lint todos os pacotes
```

## Android

Abra `apps/child-android/` no Android Studio ou rode com Gradle:

```bash
cd apps/child-android
./gradlew assembleDebug  # dentro do nix develop
```

Para testar o app em celular fisico contra a API local, veja [docs/android-network-testing.md](docs/android-network-testing.md).

## Deploy em VPS

O caminho recomendado para o MVP é subir API, painel web, Asterisk e Caddy em uma VPS única com Docker Compose.

Veja [docs/deploy-vps.md](docs/deploy-vps.md).

## Estrutura

```
telefoninho/
├── apps/
│   ├── child-android/     # App Android (Jetpack Compose + Liblinphone)
│   └── parent-web/        # Painel parental (Next.js)
├── services/
│   └── api/               # API backend (Fastify + Drizzle)
├── packages/
│   └── shared/            # Tipos e schemas Zod compartilhados
├── infra/
│   └── asterisk/          # Dockerfile e templates Asterisk
├── scripts/               # Scripts auxiliares
├── docker-compose.yml
├── flake.nix
└── PLAN.md                # Status detalhado da implementação
```
