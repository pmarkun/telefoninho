# PLAN.md — Plano de implementacao do Telefoninho

## Estado atual

**MVP completo.** Todas as fases de A a G foram implementadas:

### Fase A — Bootstrap solido (CONCLUIDA)
- Monorepo com pnpm workspaces, Nix flake, Docker Compose
- `pnpm install`, `pnpm typecheck`, `pnpm build` funcionando
- Flake com ferramentas essenciais (node, pnpm, gradle, docker)

### Fase B — Backend core (CONCLUIDA)
- Drizzle ORM com SQLite, schema de 7 tabelas (parent_user, family, family_member,
  sip_account, allowed_call, quiet_hours, pairing_code, call_log)
- Migration inicial aplicada
- Seed com Familia Demo (4 membros, regras determinísticas)
- 15+ endpoints: auth, familias, membros CRUD, allowed-calls, pairing code
  generation/claim, child config, admin stats/call-logs
- Validacao Zod em todos os inputs
- JWT custom para auth

### Fase C — Asterisk e allowlist (CONCLUIDA)
- Geracao de `pjsip.generated.conf` e `extensions.generated.conf` via script
- Contextos por membro com allowlist no dialplan
- Bloqueio de destinos nao permitidos no proprio Asterisk
- Comando de reload manual (`reload-asterisk.sh`)

### Fase D — Painel parental (CONCLUIDA)
- Next.js 15 com App Router, CSS custom
- Login, Dashboard com estatisticas, CRUD de membros
- **Matriz de permissoes**: grid visual para toggle de allowed-calls
- **Historico de chamadas**: tabela com logs de chamadas
- **Sistema de notificacoes**: toasts de erro/sucesso em todas as paginas
- Erros tratados com feedback visual (substitui `catch {}` vazios)

### Fase E — Android sem VoIP real (CONCLUIDA)
- Arquitetura em pacotes: `data/`, `ui/`, `viewmodel/`, `voip/`
- Models compartilhados (ChildProfile, ContactInfo, SipCredentials, etc.)
- ApiClient com HTTP real chamando `POST /pairing/claim`
- ConfigStore com DataStore para persistencia do pareamento
- AppViewModel com gerenciamento de estado (UiState, Screen)
- Telas: Pairing, Home, Calling, Incoming, ActiveCall
- Design 8-bit (PixelTheme) preservado e extraido para modulo proprio

### Fase F — Android com Liblinphone (CONCLUIDA)
- Integracao do Linphone SDK (no-video, 5.4.x) via Maven
- VoipManager: wrapper do Core Linphone com registro SIP,
  chamadas outgoing/incoming, accept/decline/hangup
- ViewModel coordena eventos VoIP com transicoes de tela
- Permissoes: RECORD_AUDIO, FOREGROUND_SERVICE
- Senha SIP nunca aparece em logs (mantida apenas em DataStore)

### Fase G — Testes e polimento (CONCLUIDA)
- Vitest configurado para API e shared package
- 9 testes unitarios de validacao Zod no shared package
- Testes de integracao para rotas da API (health, auth)
- Scripts `pnpm test` no root e em cada workspace
- PLAN.md atualizado

## Limites do MVP (nao implementados)
- Chamadas em background (push notifications/FCM)
- Suporte a NAT/STUN/TURN
- TLS/SRTP (Asterisk configurado para UDP plaintext)
- Teclado numerico no app infantil
- Chat, video, busca ou contatos publicos
- Quiet hours (schema existe, sem endpoints)

## Proximos passos (fora do escopo MVP)
- CI/CD (GitHub Actions)
- Pre-commit hooks (simple-git-hooks/husky)
- Deploy em producao
- Suporte a multiple families por parent
