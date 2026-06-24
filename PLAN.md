# PLAN.md — Plano de implementacao do Telefoninho

Este plano transforma o `docs/specs.md` em fases pequenas, verificaveis e com uma ordem que reduz risco. A prioridade e fazer o caminho critico funcionar: backend provisiona, Asterisk bloqueia corretamente, app pareia, app liga.

## Estado atual

Fase A esta iniciada:

- Monorepo criado.
- `nix develop` funcionando.
- Workspaces `pnpm` configurados.
- Stubs de API, web, Android, shared package e Asterisk criados.
- Docker Compose definido para API, painel e Asterisk.

Limite atual:

- Ainda nao ha schema Prisma real.
- Ainda nao ha endpoints de dominio.
- Ainda nao ha geracao real de configuracao Asterisk.
- Android ainda e apenas tela placeholder.

## Principios de execucao

- Fazer primeiro o fluxo local e demo, antes de producao.
- Manter allowlist no Asterisk, nao apenas no app.
- Evitar features fora do MVP: chat, video, busca, teclado numerico e contatos publicos.
- Validar cada fase com comandos claros antes de seguir.
- Atualizar README/docs ao fim de cada fase.

## Fase A — Bootstrap solido

Objetivo: garantir que a base do repo roda e que os comandos iniciais nao quebram por configuracao.

Tarefas:

- Revisar scripts `pnpm` do monorepo.
- Garantir que Dockerfiles instalam o workspace correto.
- Garantir que `nix develop` inclui ferramentas essenciais.
- Garantir que API responde `/health`.
- Garantir que web builda com Next.js.
- Garantir que Android tem estrutura Gradle minima.

Verificacoes:

```bash
nix develop --command bash -lc 'node --version && pnpm --version && uv --version'
pnpm install
pnpm typecheck
pnpm build
```

Aceite:

- `nix develop` entra sem erro.
- `pnpm install` conclui.
- API compila.
- Painel compila.
- Android consegue iniciar build Gradle basico quando `ANDROID_HOME` estiver configurado, ou aponta claramente a falta do SDK.

## Fase B — Backend core

Objetivo: criar o nucleo de dados e endpoints para familia, membros, regras e pareamento.

Tarefas:

- Criar schema Prisma com `ParentUser`, `Family`, `FamilyMember`, `SipAccount`, `AllowedCall`, `QuietHours`, `PairingCode` e `CallLog`.
- Criar migration inicial SQLite.
- Implementar seed demo:
  - Familia Demo.
  - Pedro/Papai `1001`.
  - Mamae `1002`.
  - Tereza `1003`.
  - Maria `1004`.
  - Regras permitidas conforme spec.
- Implementar `POST /auth/login` com dev password.
- Implementar `GET /families/:familyId/members`.
- Implementar `POST /families/:familyId/members`.
- Implementar `GET /members/:memberId/contacts`.
- Implementar `POST /allowed-calls`.
- Implementar `POST /members/:memberId/pairing-code`.
- Implementar `POST /pairing/claim`.
- Implementar `GET /child/config`.
- Isolar geracao e armazenamento de senha SIP em modulo proprio.
- Impedir logs de senha SIP, JWT e pairing code usado.

Verificacoes:

```bash
pnpm --filter @telefoninho/api db:migrate
pnpm --filter @telefoninho/api seed
pnpm --filter @telefoninho/api typecheck
pnpm --filter @telefoninho/api build
```

Aceite:

- Seed cria dados determinicos.
- Pairing code expira e so pode ser usado uma vez.
- Child config retorna apenas contatos permitidos.
- Endpoints validam input com Zod.

## Fase C — Asterisk e allowlist real

Objetivo: transformar dados do backend em configuracao SIP/Dialplan deterministica.

Tarefas:

- Implementar `generate-asterisk.ts` lendo dados via Prisma.
- Gerar `infra/asterisk/config/pjsip.generated.conf`.
- Gerar `infra/asterisk/config/extensions.generated.conf`.
- Incluir arquivos gerados nas configs principais do Asterisk.
- Criar contextos por membro.
- Criar rotas apenas para `AllowedCall.enabled = true`.
- Bloquear qualquer destino nao permitido.
- Criar comando de reload manual.
- Documentar teste com softphone externo.

Verificacoes:

```bash
pnpm infra:generate-asterisk
docker compose up -d asterisk
docker compose exec asterisk asterisk -rx "pjsip show endpoints"
docker compose exec asterisk asterisk -rx "dialplan show"
```

Aceite:

- Dois ramais registram com cliente SIP externo.
- Ramal permitido liga para destino permitido.
- Ramal nao permitido e bloqueado no dialplan.
- Config gerada e deterministica.

## Fase D — Painel parental

Objetivo: permitir ao responsavel operar os dados do MVP sem mexer em banco.

Tarefas:

- Criar layout operacional simples, desktop-first.
- Criar login dev.
- Criar dashboard com status API/Asterisk.
- Listar membros.
- Criar e editar membro.
- Criar matriz de permissoes.
- Alternar `AllowedCall`.
- Gerar pairing code.
- Mostrar historico minimo.
- Adicionar botao para regenerar config Asterisk.

Verificacoes:

```bash
pnpm --filter @telefoninho/parent-web typecheck
pnpm --filter @telefoninho/parent-web build
```

Aceite:

- Responsavel consegue criar membro.
- Responsavel consegue definir permissoes.
- Responsavel consegue gerar codigo de pareamento.
- UI nao sugere chat, feed, busca global ou contato publico.

## Fase E — Android sem VoIP real

Objetivo: implementar o fluxo infantil completo com estados falsos, antes de integrar Liblinphone.

Tarefas:

- Criar arquitetura de pacotes conforme spec.
- Criar modelos `ChildProfile`, `Contact`, `AppState` e estados de chamada.
- Implementar tela de pareamento por codigo.
- Chamar `POST /pairing/claim`.
- Salvar config em DataStore.
- Renderizar home com contatos aprovados.
- Implementar telas `CALLING`, `RINGING` e `IN_CALL` em modo fake.
- Implementar design 8-bit basico.
- Pedir apenas permissoes necessarias para esta fase.

Verificacoes:

```bash
cd apps/child-android
./gradlew assembleDebug
```

Aceite:

- App abre em pareamento quando sem config.
- Pairing salva config local.
- Home mostra contatos aprovados.
- Nao ha teclado numerico.
- Nao ha credenciais SIP na UI.

## Fase F — Android com Liblinphone

Objetivo: substituir estados fake por chamada SIP real com app aberto.

Tarefas:

- Adicionar Liblinphone SDK.
- Criar `VoipEngine`, `VoipListener` e `LinphoneVoipEngine`.
- Configurar conta SIP a partir do pareamento.
- Registrar no Asterisk.
- Implementar chamada para contato.
- Implementar recebimento com app aberto.
- Implementar atender, recusar e desligar.
- Atualizar status visual conforme eventos reais.
- Garantir que senha SIP nao aparece em logs.

Verificacoes:

```bash
cd apps/child-android
./gradlew assembleDebug
```

Roteiro manual:

1. Subir API e Asterisk.
2. Rodar seed.
3. Gerar config Asterisk.
4. Parear Tereza no Android.
5. Registrar softphone como Papai.
6. Ligar do app para Papai.
7. Ligar do Papai para app.
8. Testar destino nao permitido.

Aceite:

- App registra SIP.
- App liga para contato permitido.
- App recebe chamada quando aberto.
- App bloqueia UX local quando contato esta inativo.
- Asterisk bloqueia chamadas nao permitidas mesmo fora do app.

## Fase G — Polimento e limites do MVP

Objetivo: deixar a demo honesta, segura e facil de continuar.

Tarefas:

- Melhorar mensagens de erro.
- Adicionar tela de privacidade simples.
- Documentar limitacoes: background, NAT, push, TLS/SRTP e emulador.
- Adicionar testes unitarios do backend.
- Adicionar testes unitarios Android para parse/config/estado.
- Revisar permissoes Android.
- Revisar logs sensiveis.
- Atualizar README final do MVP.

Verificacoes:

```bash
pnpm typecheck
pnpm build
pnpm --filter @telefoninho/api test
cd apps/child-android && ./gradlew testDebugUnitTest assembleDebug
```

Aceite:

- Limites do MVP estao documentados.
- Testes principais passam.
- Demo local tem roteiro reproduzivel.
- Nao ha gravacao, transcricao, analytics, contatos do aparelho ou localizacao.

## Ordem recomendada imediata

1. Fechar Fase A com `pnpm install`, `pnpm typecheck` e `pnpm build`.
2. Implementar Fase B ate `pairing/claim`.
3. Implementar Fase C antes de investir no Android real.
4. Criar painel minimo para operar a demo.
5. Fazer Android fake.
6. Integrar Liblinphone.
