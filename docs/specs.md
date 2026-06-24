# SPEC — Telefoninho: app mobile VoIP simples para crianças

## 0. Resumo do produto

Criar um MVP Android de um “telefone infantil” com UX extremamente simples: a criança vê uma tela com botões grandes de contatos aprovados e consegue fazer/receber chamadas de áudio via VoIP/SIP. O app não deve parecer um messenger, rede social ou softphone técnico. Deve parecer um telefone/brinquedo digital 8-bit: poucos botões, sem teclado numérico por padrão, sem chat, sem feed, sem busca, sem adicionar contatos.

O sistema terá:

1. App Android da criança.
2. Painel parental web.
3. Backend API.
4. Servidor VoIP com Asterisk em Docker.
5. Geração/provisionamento de ramais SIP.
6. Regras de allowlist aplicadas no servidor, não apenas na interface.
7. Monorepo com apps, serviços, infra e documentação.

Nome de trabalho: **Telefoninho**.

## 1. Objetivo do MVP

Permitir que uma criança:

* Abra o app.
* Veja contatos aprovados pelos responsáveis.
* Toque em um contato.
* Faça uma chamada de áudio VoIP para esse contato/ramal.
* Receba chamada apenas de contatos aprovados.
* Atenda ou recuse com botões grandes.
* Não consiga discar para números arbitrários.
* Não consiga adicionar contatos.
* Não consiga mandar mensagem.
* Não veja configurações técnicas.

Permitir que um responsável:

* Crie perfis de crianças.
* Crie contatos/ramais.
* Defina quem pode ligar para quem.
* Defina nomes e avatares simples.
* Defina horários permitidos.
* Veja histórico mínimo de chamadas.
* Gere código/QR de pareamento do app da criança.
* Bloqueie/desbloqueie contatos.

## 2. Não objetivos do MVP

Não implementar no MVP:

* iOS.
* Vídeo.
* Chat.
* Stickers.
* Mensagens de texto.
* Gravação de chamadas.
* Transcrição.
* IA ouvindo chamadas.
* Contatos públicos.
* Busca de usuários.
* Convites entre crianças.
* Chamadas para PSTN/número telefônico real.
* Marketplace de avatares.
* Sistema complexo de pagamentos.
* Push VoIP robusto com app fechado.
* Multi-tenant production-grade.

O MVP pode funcionar bem com o app aberto ou em foreground service simples no Android. Push real, bateria e recebimento confiável com app totalmente fechado entram na fase 2.

## 3. Princípios de produto

### 3.1 A criança não administra nada

A criança só pode:

* Escolher contato.
* Ligar.
* Atender.
* Desligar.
* Ver status simples.

A criança não pode:

* Adicionar contato.
* Remover contato.
* Abrir teclado SIP.
* Ver ramal/senha.
* Alterar servidor.
* Mandar convite.
* Ver lista global.
* Mudar permissões.

### 3.2 Segurança deve estar no servidor

A interface pode esconder coisas, mas a regra real deve estar no backend/PBX.

Mesmo que alguém modifique o app, intercepte o tráfego ou tente usar outro cliente SIP com a credencial da criança, o ramal da criança só deve conseguir ligar para ramais permitidos.

### 3.3 Logs mínimos

Guardar apenas:

* Quem ligou para quem.
* Data/hora.
* Duração.
* Status: atendida, perdida, recusada, bloqueada.
* Motivo de bloqueio quando aplicável.

Não guardar:

* Áudio.
* Conteúdo de conversa.
* Transcrição.
* Localização.
* Lista de contatos do aparelho.
* Microfone fora de chamada.
* Dados desnecessários.

### 3.4 Visual: brinquedo sério

A estética deve misturar:

* Game Boy.
* Tamagotchi.
* Nokia antigo.
* Interfone.
* Telefone fixo de cozinha.

Tom visual:

* 8-bit/pixel art.
* Botões grandes.
* Baixa carga cognitiva.
* Pouquíssimos textos.
* Animações curtas.
* Nada viciante.
* Nada de recompensa infinita.

## 4. Stack recomendada

### 4.1 Monorepo

Usar monorepo com esta estrutura:

```txt
telefoninho/
  README.md
  docker-compose.yml
  .env.example
  docs/
    architecture.md
    local-dev.md
    product-principles.md
    privacy.md
    ai-coding-plan.md

  apps/
    child-android/
      README.md
      build.gradle.kts
      settings.gradle.kts
      app/
        src/main/...
    parent-web/
      README.md
      package.json
      src/...

  services/
    api/
      README.md
      package.json
      prisma/
      src/...

  packages/
    shared/
      package.json
      src/
        types.ts
        validation.ts

  infra/
    asterisk/
      Dockerfile
      config/
        pjsip.conf
        extensions.conf
        rtp.conf
        http.conf
        manager.conf
      templates/
        pjsip.template.conf
        extensions.template.conf
      scripts/
        generate-asterisk-config.ts
        reload-asterisk.sh

  scripts/
    dev.sh
    reset-db.sh
    seed.ts
```

### 4.2 Backend e painel parental

Usar TypeScript para backend e web, por velocidade de prototipagem.

Backend:

* Node.js 22+
* Fastify
* Prisma
* SQLite no desenvolvimento
* PostgreSQL preparado para produção futura
* Zod para validação
* JWT simples para painel parental
* OpenAPI gerado automaticamente ou documentação manual inicial

Painel parental:

* Next.js
* React
* Tailwind ou CSS simples
* Sem dependência pesada de UI kit no MVP
* Autenticação simples por senha/dev token no MVP
* Layout responsivo, mas desktop-first ok para MVP

### 4.3 App Android

Usar:

* Kotlin
* Jetpack Compose
* Gradle Kotlin DSL
* Liblinphone SDK
* MVVM simples
* DataStore para salvar provisionamento local
* Retrofit/Ktor client para API
* Coil apenas se usar avatar remoto; preferir avatares locais/pixel art no MVP
* Sem Firebase no MVP, salvo se implementar push na fase 2

### 4.4 VoIP

Usar:

* Asterisk em Docker
* PJSIP
* Ramais SIP por criança/adulto/dispositivo
* Dialplan com contextos separados por perfil
* Allowlist no dialplan
* Sem PSTN no MVP
* Sem trunks externos no MVP

Fase 2:

* Flexisip como proxy SIP/push
* FCM para Android
* TLS/SRTP
* Melhor integração com chamadas em background

## 5. Arquitetura

### 5.1 Diagrama lógico

```txt
┌────────────────────┐
│  App Android Criança│
│  Jetpack Compose    │
│  Liblinphone SDK    │
└──────────┬─────────┘
           │
           │ HTTPS: config, contatos, pairing
           │ SIP/RTP: chamadas
           │
┌──────────▼─────────┐        ┌───────────────────┐
│     Backend API     │◄──────►│   Parent Web      │
│ Fastify + Prisma    │ HTTPS  │ Next.js           │
└──────────┬─────────┘        └───────────────────┘
           │
           │ gera configs/reload
           │
┌──────────▼─────────┐
│      Asterisk       │
│ PJSIP + Dialplan    │
└────────────────────┘
```

### 5.2 Fluxo de provisionamento

1. Responsável entra no painel parental.
2. Cria uma criança.
3. Backend gera:

   * `child_id`
   * `sip_extension`
   * `sip_username`
   * `sip_password`
   * `sip_domain`
   * `pairing_code`
4. Painel mostra QR code ou código curto.
5. Criança abre app Android.
6. App mostra tela “Conectar meu telefoninho”.
7. Responsável escaneia QR ou digita código.
8. App chama API:

   * `POST /pairing/claim`
9. API retorna configuração segura:

   * perfil da criança
   * credencial SIP
   * contatos aprovados
   * tema/avatar
10. App salva no DataStore.
11. App registra no SIP via Liblinphone.
12. App entra na tela principal.

### 5.3 Fluxo de chamada feita pela criança

1. Criança toca no botão “Papai”.
2. App verifica estado local:

   * tem rede?
   * está pareado?
   * contato está ativo?
   * horário permitido?
3. App inicia chamada SIP para `sip:1001@domain`.
4. Asterisk recebe chamada do ramal da criança.
5. Asterisk valida contexto do originador.
6. Se contato está permitido, disca destino.
7. Se bloqueado, toca áudio/retorna erro.
8. Backend registra evento via AMI/ARI ou, no MVP simples, via CDR/log import posterior.

### 5.4 Fluxo de chamada recebida

1. Um ramal aprovado liga para a criança.
2. Asterisk valida no contexto de origem/destino.
3. App recebe INVITE SIP.
4. App mostra tela fullscreen:

   * “Papai está ligando”
   * botão verde gigante: atender
   * botão vermelho gigante: desligar
5. Ao atender, app entra em tela de chamada.
6. Ao desligar, volta para home.

No MVP, aceitar limitação: recebimento pode ser inconsistente se o app estiver fechado. Para teste, manter app aberto ou serviço foreground.

## 6. Modelo de dados

Usar Prisma.

### 6.1 Entidades

#### ParentUser

```ts
type ParentUser = {
  id: string
  email: string
  passwordHash: string
  displayName: string
  createdAt: Date
  updatedAt: Date
}
```

#### Family

```ts
type Family = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}
```

#### FamilyMember

Representa qualquer pessoa que possa aparecer como contato: criança, responsável, avó, amigo autorizado etc.

```ts
type FamilyMember = {
  id: string
  familyId: string
  kind: "child" | "adult" | "external"
  displayName: string
  avatarKey: string
  colorKey: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}
```

#### SipAccount

```ts
type SipAccount = {
  id: string
  familyMemberId: string
  extension: string
  username: string
  passwordHashOrEncrypted: string
  domain: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

Para MVP local, pode guardar senha em texto no SQLite apenas em desenvolvimento, mas o código deve isolar isso em função própria para trocar por criptografia depois.

#### AllowedCall

Regra direcionada.

```ts
type AllowedCall = {
  id: string
  familyId: string
  fromMemberId: string
  toMemberId: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

#### QuietHours

```ts
type QuietHours = {
  id: string
  familyMemberId: string
  timezone: string
  startLocalTime: string // "21:00"
  endLocalTime: string   // "07:00"
  daysOfWeek: string     // "mon,tue,wed,thu,fri,sat,sun"
  enabled: boolean
}
```

#### PairingCode

```ts
type PairingCode = {
  id: string
  familyMemberId: string
  code: string
  expiresAt: Date
  claimedAt?: Date
  createdAt: Date
}
```

#### CallLog

```ts
type CallLog = {
  id: string
  familyId: string
  fromMemberId?: string
  toMemberId?: string
  fromExtension: string
  toExtension: string
  startedAt: Date
  endedAt?: Date
  durationSeconds?: number
  status: "answered" | "missed" | "declined" | "blocked" | "failed"
  blockReason?: string
}
```

## 7. API

Base URL local:

```txt
http://localhost:3001
```

### 7.1 Auth parental

#### POST /auth/login

Request:

```json
{
  "email": "parent@example.com",
  "password": "devpassword"
}
```

Response:

```json
{
  "token": "jwt",
  "parent": {
    "id": "parent_123",
    "displayName": "Pedro"
  }
}
```

### 7.2 Crianças/perfis

#### GET /families/:familyId/members

Retorna membros da família.

#### POST /families/:familyId/members

Cria membro.

Request:

```json
{
  "kind": "child",
  "displayName": "Tereza",
  "avatarKey": "cat_pixel_01",
  "colorKey": "green"
}
```

Response:

```json
{
  "id": "member_123",
  "displayName": "Tereza",
  "kind": "child",
  "sip": {
    "extension": "1003"
  }
}
```

### 7.3 Contatos permitidos

#### GET /members/:memberId/contacts

Retorna contatos que aparecem no app da criança.

Response:

```json
{
  "memberId": "member_child_1",
  "contacts": [
    {
      "id": "member_adult_1",
      "displayName": "Papai",
      "avatarKey": "dad_pixel_01",
      "colorKey": "blue",
      "sipExtension": "1001",
      "enabled": true
    }
  ]
}
```

#### POST /allowed-calls

Cria permissão.

Request:

```json
{
  "fromMemberId": "member_child_1",
  "toMemberId": "member_adult_1",
  "enabled": true
}
```

Observação: para contato aparecer e chamada ser bidirecional, criar duas regras:

* child -> adult
* adult -> child

### 7.4 Pareamento

#### POST /members/:memberId/pairing-code

Cria código de pareamento.

Response:

```json
{
  "code": "842913",
  "expiresAt": "2026-06-24T03:00:00.000Z",
  "qrPayload": {
    "type": "telefoninho-pairing",
    "code": "842913",
    "apiBaseUrl": "http://192.168.0.10:3001"
  }
}
```

#### POST /pairing/claim

Usado pelo app Android.

Request:

```json
{
  "code": "842913",
  "deviceName": "Android Pedro Test",
  "deviceId": "hashed-device-id"
}
```

Response:

```json
{
  "profile": {
    "memberId": "member_child_1",
    "displayName": "Tereza",
    "avatarKey": "cat_pixel_01",
    "colorKey": "green"
  },
  "sip": {
    "domain": "192.168.0.10",
    "port": 5060,
    "transport": "udp",
    "username": "1003",
    "extension": "1003",
    "password": "generated-password"
  },
  "contacts": [
    {
      "memberId": "member_adult_1",
      "displayName": "Papai",
      "avatarKey": "dad_pixel_01",
      "colorKey": "blue",
      "sipUri": "sip:1001@192.168.0.10"
    }
  ],
  "settings": {
    "showDialpad": false,
    "allowEmergencyButton": false,
    "theme": "pixel-green"
  }
}
```

### 7.5 Configuração do app

#### GET /child/config

Header:

```txt
Authorization: Bearer child-device-token
```

Response igual ao `/pairing/claim`, exceto sem reenviar senha se não for necessário. Para MVP pode reenviar, mas deixar comentário técnico para melhorar depois.

### 7.6 Asterisk config

#### POST /admin/asterisk/regenerate

Gera arquivos:

* `infra/asterisk/config/pjsip.generated.conf`
* `infra/asterisk/config/extensions.generated.conf`

Depois executa reload.

No MVP, pode ser script manual:

```bash
pnpm infra:generate-asterisk
docker compose exec asterisk asterisk -rx "pjsip reload"
docker compose exec asterisk asterisk -rx "dialplan reload"
```

## 8. Configuração Asterisk

### 8.1 Estratégia

Cada ramal deve ter:

* endpoint PJSIP
* auth
* aor
* contexto próprio no dialplan

Exemplo:

```txt
Ramal 1001 — Pedro
context = ctx-member-1001

Ramal 1003 — Tereza
context = ctx-member-1003
```

O contexto define para quais extensões esse ramal pode discar.

### 8.2 pjsip.conf exemplo

Arquivo gerado em `infra/asterisk/config/pjsip.generated.conf`.

```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[1001]
type=endpoint
context=ctx-member-1001
disallow=all
allow=opus,ulaw,alaw
auth=auth1001
aors=1001

[auth1001]
type=auth
auth_type=userpass
username=1001
password=dev-password-1001

[1001]
type=aor
max_contacts=5
remove_existing=yes

[1003]
type=endpoint
context=ctx-member-1003
disallow=all
allow=opus,ulaw,alaw
auth=auth1003
aors=1003

[auth1003]
type=auth
auth_type=userpass
username=1003
password=dev-password-1003

[1003]
type=aor
max_contacts=5
remove_existing=yes
```

### 8.3 extensions.conf exemplo

Arquivo gerado em `infra/asterisk/config/extensions.generated.conf`.

```ini
[globals]

[blocked]
exten => s,1,Answer()
 same => n,Playback(vm-goodbye)
 same => n,Hangup()

; Contexto do Pedro: pode ligar para Tereza
[ctx-member-1001]
exten => 1003,1,Dial(PJSIP/1003,30)
 same => n,Hangup()

; Qualquer outra discagem bloqueia
exten => _X.,1,Goto(blocked,s,1)

; Contexto da Tereza: pode ligar para Pedro
[ctx-member-1003]
exten => 1001,1,Dial(PJSIP/1001,30)
 same => n,Hangup()

; Qualquer outra discagem bloqueia
exten => _X.,1,Goto(blocked,s,1)
```

### 8.4 Futuro: horários no dialplan

No MVP, o app e API podem bloquear quiet hours, mas a fase seguinte deve gerar bloqueios no dialplan também.

Exemplo conceitual:

```ini
exten => 1001,1,GotoIfTime(21:00-07:00,*,*,*?blocked,s,1)
 same => n,Dial(PJSIP/1001,30)
 same => n,Hangup()
```

A implementação correta precisa lidar com timezone, dias da semana e virada de meia-noite.

## 9. App Android da criança

### 9.1 Telas

#### Tela 1 — Pareamento

Estado inicial quando não há config local.

Conteúdo:

```txt
┌────────────────────┐
│   TELEFONINHO      │
│                    │
│  Conectar com      │
│  código dos pais   │
│                    │
│ [ DIGITAR CÓDIGO ] │
│ [ ESCANEAR QR ]    │
└────────────────────┘
```

Para MVP, implementar primeiro apenas “digitar código”. QR pode ficar como TODO.

#### Tela 2 — Home

Mostra contatos aprovados.

```txt
┌────────────────────┐
│   TELEFONINHO      │
│                    │
│ [ PAPAI ] [ MAMÃE ]│
│                    │
│ [ VÓ   ] [ MARIA ] │
│                    │
│  ☎ pronto          │
└────────────────────┘
```

Componentes:

* título
* grade de contatos
* status de conexão
* botão escondido de debug apenas em build debug
* sem menu visível para criança

Estados:

* `READY`
* `REGISTERING`
* `OFFLINE`
* `CALLING`
* `IN_CALL`
* `RINGING`
* `QUIET_HOURS`
* `LOCKED_BY_PARENT`

#### Tela 3 — Chamando

```txt
┌────────────────────┐
│ Ligando para       │
│ PAPAI              │
│                    │
│  bip... bip...     │
│                    │
│ [ DESLIGAR ]       │
└────────────────────┘
```

#### Tela 4 — Recebendo chamada

```txt
┌────────────────────┐
│ PAPAI              │
│ está ligando       │
│                    │
│ [ ATENDER ]        │
│ [ AGORA NÃO ]      │
└────────────────────┘
```

#### Tela 5 — Em chamada

```txt
┌────────────────────┐
│ Falando com        │
│ PAPAI              │
│                    │
│  03:12             │
│                    │
│ [ DESLIGAR ]       │
└────────────────────┘
```

Opções futuras:

* viva-voz
* volume
* mudo

Não implementar no MVP se atrasar.

### 9.2 Arquitetura Android

Pacotes:

```txt
com.telefoninho.child
  MainActivity.kt

  data/
    ApiClient.kt
    ChildConfigRepository.kt
    LocalConfigStore.kt
    models/

  voip/
    SipService.kt
    LinphoneManager.kt
    CallState.kt
    SipAccountConfig.kt

  ui/
    theme/
    screens/
      PairingScreen.kt
      HomeScreen.kt
      IncomingCallScreen.kt
      ActiveCallScreen.kt
      CallingScreen.kt
    components/
      PixelButton.kt
      ContactButton.kt
      StatusBar8Bit.kt

  domain/
    Contact.kt
    ChildProfile.kt
    UseCases.kt
```

### 9.3 Estado global

Criar `AppState`.

```kotlin
data class AppState(
    val profile: ChildProfile? = null,
    val contacts: List<Contact> = emptyList(),
    val sipRegistrationState: SipRegistrationState = SipRegistrationState.None,
    val callState: CallState = CallState.Idle,
    val networkState: NetworkState = NetworkState.Unknown,
    val isQuietHours: Boolean = false
)
```

### 9.4 Interface do VoIP

Criar uma interface para isolar Liblinphone:

```kotlin
interface VoipEngine {
    fun configure(account: SipAccountConfig)
    fun start()
    fun stop()
    fun call(contact: Contact)
    fun acceptCall()
    fun declineCall()
    fun hangup()
    fun setListener(listener: VoipListener)
}

interface VoipListener {
    fun onRegistrationChanged(state: SipRegistrationState)
    fun onIncomingCall(call: IncomingCallInfo)
    fun onCallStateChanged(state: CallState)
    fun onError(error: VoipError)
}
```

Implementação:

```kotlin
class LinphoneVoipEngine(
    private val context: Context
) : VoipEngine {
    // encapsular org.linphone.core.Core
}
```

A UI nunca deve chamar Liblinphone direto.

### 9.5 Permissões Android

Manifest MVP:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
```

Observações:

* `RECORD_AUDIO` só deve ser pedido quando necessário para chamada.
* Mostrar tela explicativa simples antes da permissão: “O Telefoninho precisa do microfone para você falar durante a ligação.”
* Não pedir contatos do aparelho.
* Não pedir localização.
* Não pedir câmera no MVP.

### 9.6 Integração com Android Telecom

MVP pode começar sem integração profunda, mas a arquitetura deve reservar uma camada:

```txt
voip/
  AndroidCallIntegration.kt
```

Fase 1:

* Notificação foreground durante chamada.
* Tela própria do app para atender/desligar.

Fase 2:

* Integrar Core-Telecom.
* Registrar app como calling app.
* Melhorar experiência de chamada recebida.
* Suportar Bluetooth/headset melhor.

## 10. Painel parental web

### 10.1 Telas

#### Login

MVP:

* email
* senha
* ou dev token

#### Dashboard

Mostra:

* crianças
* adultos/contatos
* status do Asterisk/API
* botão “regenerar configuração VoIP”

#### Perfil da criança

Campos:

* nome
* avatar
* cor
* ramal
* ativo/inativo
* contatos permitidos
* horários
* pareamento

Ações:

* gerar código de pareamento
* bloquear todos os contatos
* resetar credencial SIP
* ver histórico

#### Contatos

Criar/editar:

* nome
* tipo: adulto, criança, externo
* avatar
* ramal SIP
* ativo/inativo

#### Permissões

Matriz simples:

```txt
             Pedro  Maisa  Maria  Vó
Tereza         ✓      ✓      ✓    ✓
Maria          ✓      ✓      -    ✓
```

Cada checkbox cria/remove `AllowedCall`.

#### Histórico

Tabela:

```txt
Data       De      Para     Duração   Status
23/06      Tereza  Pedro    02:13     atendida
23/06      Pedro   Tereza   --        perdida
```

Não mostrar conteúdo. Não gravar.

## 11. Design system 8-bit

### 11.1 Tokens

Cores conceituais:

```ts
const themes = {
  green: {
    bg: "#D7F5D0",
    fg: "#1B3D1B",
    panel: "#B8E6B0",
    accent: "#2F7D32"
  },
  blue: {
    bg: "#D8ECFF",
    fg: "#17324D",
    panel: "#B8D8F2",
    accent: "#245D8C"
  },
  pink: {
    bg: "#FFE1EF",
    fg: "#4A1830",
    panel: "#F6B8D0",
    accent: "#9C2F5D"
  }
}
```

A implementação Android pode começar com tema Compose simples.

### 11.2 Componentes

#### PixelButton

Requisitos:

* altura mínima 72dp
* largura mínima 140dp
* borda grossa
* sombra “pixel”
* texto grande
* estado pressionado visível

#### ContactButton

Mostra:

* avatar pixel art
* nome
* status opcional

#### StatusBar8Bit

Mostra:

* “pronto”
* “sem rede”
* “conectando”
* “fora de horário”
* “chamada”

### 11.3 Avatares

MVP:

* usar avatares locais vetoriais ou PNG simples em `res/drawable`
* chaves:

  * `dad_pixel_01`
  * `mom_pixel_01`
  * `cat_pixel_01`
  * `dog_pixel_01`
  * `star_pixel_01`
  * `robot_pixel_01`
  * `heart_pixel_01`

Não implementar upload de imagem no MVP.

## 12. Segurança e privacidade

### 12.1 Requisitos

* Sem coleta de localização.
* Sem acesso a contatos do aparelho.
* Sem analytics de terceiros no MVP.
* Sem SDK de anúncios.
* Sem gravação.
* Sem transcrição.
* Sem IA.
* Sem diretório público.
* Sem UGC além de nomes/avatares definidos por responsáveis.
* Dados pessoais mínimos.
* Consentimento parental explícito no painel.
* Tela de privacidade em linguagem simples.

### 12.2 Dados sensíveis

Microfone é usado apenas durante chamada.

O app não deve:

* ativar microfone fora de chamada;
* fazer background recording;
* enviar áudio para backend próprio;
* armazenar áudio no dispositivo;
* manter logs verbosos com SIP password.

### 12.3 Credenciais SIP

MVP:

* salvar em DataStore.
* não exibir na UI.
* limpar no logout/reset.

Futuro:

* criptografar localmente.
* usar Android Keystore.

### 12.4 Logs

Nunca logar:

* senha SIP
* token JWT
* pairing code completo após uso
* corpo de resposta com credenciais em produção

## 13. Desenvolvimento local

### 13.1 Comandos esperados

Na raiz:

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm seed
pnpm dev
```

Android:

```bash
cd apps/child-android
./gradlew assembleDebug
```

### 13.2 docker-compose.yml

Serviços:

* `api`
* `parent-web`
* `asterisk`
* `db` opcional; no MVP pode usar SQLite sem serviço DB

Exemplo mínimo:

```yaml
services:
  asterisk:
    build: ./infra/asterisk
    container_name: telefoninho-asterisk
    ports:
      - "5060:5060/udp"
      - "10000-10100:10000-10100/udp"
    volumes:
      - ./infra/asterisk/config:/etc/asterisk

  api:
    image: node:22
    working_dir: /app
    command: sh -c "pnpm install && pnpm dev"
    ports:
      - "3001:3001"
    volumes:
      - .:/app
    environment:
      - DATABASE_URL=file:/app/services/api/dev.db

  parent-web:
    image: node:22
    working_dir: /app
    command: sh -c "pnpm install && pnpm --filter parent-web dev"
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### 13.3 Seed inicial

Criar:

* família “Família Demo”
* parent “Pedro”
* adulto “Papai” ramal 1001
* adulto “Mamãe” ramal 1002
* criança “Tereza” ramal 1003
* criança “Maria” ramal 1004

Permissões:

* Tereza -> Papai
* Papai -> Tereza
* Tereza -> Mamãe
* Mamãe -> Tereza
* Maria -> Papai
* Papai -> Maria
* Maria -> Mamãe
* Mamãe -> Maria
* Maria <-> Tereza opcional

## 14. Critérios de aceite do MVP

### 14.1 Backend

* Consegue criar família/membro.
* Consegue gerar ramal SIP.
* Consegue criar allowed call.
* Consegue gerar pairing code.
* Consegue entregar config para app Android.
* Consegue regenerar arquivos Asterisk.
* Tem seed funcional.

### 14.2 Asterisk

* Dois ramais conseguem registrar usando cliente SIP externo.
* Ramal autorizado consegue ligar para destino permitido.
* Ramal não autorizado é bloqueado.
* Config gerada é determinística.
* Reload funciona sem reiniciar container.

### 14.3 Android

* App abre em tela de pareamento se não configurado.
* App aceita código de pareamento.
* App salva config local.
* App registra no SIP.
* App mostra contatos aprovados.
* App inicia chamada ao tocar contato.
* App recebe chamada quando aberto.
* App permite atender/desligar.
* App não mostra teclado numérico.
* App não mostra credenciais SIP.
* App não pede contatos/localização/câmera.

### 14.4 Painel parental

* Login dev funciona.
* Lista membros.
* Cria membro.
* Edita nome/avatar/cor.
* Mostra matriz de permissões.
* Atualiza allowed calls.
* Gera código de pareamento.
* Mostra histórico mínimo.

## 15. Testes

### 15.1 Backend

Usar Vitest.

Testar:

* criação de membro gera ramal único.
* allowed call bloqueia duplicatas.
* pairing code expira.
* pairing code só pode ser usado uma vez.
* child config só retorna contatos permitidos.
* geração de Asterisk inclui contextos corretos.
* geração de Asterisk não inclui rotas bloqueadas.

### 15.2 Android

Testes unitários básicos:

* parse de config.
* estado inicial sem pareamento.
* estado após pareamento.
* clique em contato chama `VoipEngine.call`.
* contato desativado não chama.
* quiet hours bloqueia chamada localmente.

UI tests se der tempo:

* renderiza tela de pareamento.
* renderiza home com contatos.
* renderiza tela de chamada recebida.

### 15.3 Integração manual

Roteiro:

1. Subir docker.
2. Rodar seed.
3. Abrir painel parental.
4. Gerar pairing code para Tereza.
5. Instalar app Android em device/emulador.
6. Parear app.
7. Registrar um softphone externo como ramal 1001.
8. No app, ligar para Papai.
9. Do softphone, ligar para Tereza.
10. Tentar discar ramal não permitido.
11. Confirmar bloqueio.

## 16. Ordem de implementação para IA

### Fase A — Esqueleto do monorepo

1. Criar estrutura de pastas.
2. Criar README principal.
3. Criar `.env.example`.
4. Criar docker-compose.
5. Criar serviço API vazio com Fastify.
6. Criar app Next.js parental vazio.
7. Criar app Android Compose vazio.
8. Garantir que tudo sobe/compila.

### Fase B — Backend core

1. Criar Prisma schema.
2. Criar migrations.
3. Criar seed.
4. Criar endpoints:

   * auth login dev
   * CRUD members
   * CRUD allowed calls
   * pairing code
   * pairing claim
   * child config
5. Criar validação com Zod.
6. Criar testes.

### Fase C — Asterisk infra

1. Criar Dockerfile Asterisk.
2. Criar configs estáticas mínimas.
3. Criar script que lê DB/seed e gera:

   * pjsip.generated.conf
   * extensions.generated.conf
4. Criar comando de reload.
5. Testar com dois softphones externos antes do Android.

### Fase D — Painel parental

1. Login dev.
2. Dashboard.
3. Lista de membros.
4. Criar/editar membro.
5. Matriz de permissões.
6. Gerar pairing code.
7. Botão regenerar Asterisk config.
8. Histórico mínimo, mesmo que mockado no início.

### Fase E — Android sem VoIP real

1. Tela de pareamento.
2. Chamada API `/pairing/claim`.
3. Salvar config local.
4. Home com contatos.
5. Estados visuais fake:

   * calling
   * incoming
   * in call
6. Design 8-bit básico.

### Fase F — Android com Liblinphone

1. Adicionar SDK.
2. Criar `VoipEngine`.
3. Configurar conta SIP.
4. Registrar conta.
5. Fazer chamada.
6. Receber chamada com app aberto.
7. Atender/desligar.
8. Exibir estados reais na UI.

### Fase G — Polimento

1. Melhorar erros.
2. Melhorar status de rede/SIP.
3. Esconder debug em release.
4. Adicionar tela de privacidade.
5. Adicionar reset parental protegido por gesto/código.
6. Documentar limitações do MVP.

## 17. Prompt interno para a IA codadora

Use este projeto como um MVP funcional, não como uma arquitetura abstrata.

Prioridades:

1. Fazer chamadas SIP funcionarem entre app Android e Asterisk.
2. Garantir que allowlist seja aplicada no Asterisk.
3. Manter UX infantil extremamente simples.
4. Evitar features extras.
5. Evitar chat, vídeo, feed, busca e teclado numérico.
6. Documentar limitações claramente.

Sempre que houver dúvida, escolha a opção mais simples que preserve segurança e testabilidade.

Não crie dependências pagas.
Não adicione analytics.
Não adicione SDK de ads.
Não peça permissões Android desnecessárias.
Não implemente IA.
Não grave áudio.
Não implemente contato público.

Ao final de cada fase, atualizar o README com:

* o que foi implementado;
* como rodar;
* como testar;
* limitações conhecidas;
* próximo passo recomendado.

## 18. Bugs esperados / armadilhas

### 18.1 NAT e rede local

SIP/RTP pode falhar em rede local dependendo de IPs e NAT. Para MVP, testar tudo na mesma rede Wi-Fi e configurar explicitamente o IP local do servidor.

### 18.2 Emulador Android

Áudio e rede SIP podem ser chatos no emulador. Priorizar teste em aparelho Android real.

### 18.3 Background

Não prometer recebimento confiável com app fechado no MVP.

### 18.4 Permissões

Android moderno pode bloquear notificações/telas fullscreen se permissões e foreground service estiverem errados. MVP deve funcionar primeiro com app aberto.

### 18.5 Segurança falsa

Não confiar só no app. O dialplan precisa bloquear chamadas não permitidas.

### 18.6 Produto infantil

Não deixar a IA transformar isso em messenger. O app é um telefone, não uma rede social.

## 19. Roadmap pós-MVP

### Fase 2

* Push com Flexisip + FCM.
* Android Core-Telecom completo.
* TLS/SRTP.
* Melhor gerenciamento de bateria.
* Histórico real via AMI/ARI/CDR.
* Reset seguro de credenciais.
* QR code real.
* App parental mobile ou PWA.

### Fase 3

* iOS.
* CallKit/PushKit.
* Modo hardware dedicado.
* Integração com smartwatch.
* Contatos temporários.
* Modo escola.
* Modo “só recebe”.
* Botão emergência familiar.
* Auditoria de privacidade.

### Fase 4

* Distribuição para múltiplas famílias.
* Multi-tenant real.
* Billing.
* Painel de conformidade.
* Logs com retenção configurável.
* Export/delete de dados.
* Infra produção.

