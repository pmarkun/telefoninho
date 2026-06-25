# Android Child App

Leia este arquivo quando mexer em `apps/child-android`, UI Compose, ViewModel, DataStore, QR, ADB ou testes reais em aparelhos.

## Produto e UX

- A estética padrão do app infantil é sempre 8-bit/pixel.
- Use `PixelTheme`, `TelefoninhoFrame`, `PixelButton`, `PixelCard` e componentes compatíveis.
- O app deve parecer um telefone de brinquedo, não messenger. Evite chat, feed, rede social ou teclado numérico fora de feature explicitamente pedida.
- Prefira telas inteiras simples a menus flutuantes complexos quando a interação for infantil.
- Ícones podem ser símbolos/labels curtos em botões pixelados. Não adicione biblioteca pesada de ícones sem necessidade clara.

## Kotlin/Compose

- State hoisting: estado no ViewModel; Compose renderiza.
- Use `remember` só para estado local de UI.
- Sem hardcoded strings novas quando a tela já usa recursos ou quando o texto for reutilizável.
- Corrotinas: `viewModelScope.launch` para async e `StateFlow` para expor estado.

## API e QR

- Servidor padrão atual do Android: `https://vps68379.publiccloud.com.br`.
- Para gerar “Meu QR”, envie `POST` JSON com `Content-Type: application/json`, mesmo que o body seja `{}`.
- Para atualizar contatos, use `/child/config` com `Authorization: Bearer <token>` salvo no pareamento.

## ADB e Aparelhos Reais

- Para instalar APK nos celulares conectados, use da raiz:
  - `nix develop --command scripts/install-android.sh`
- O script deve instalar em todos os devices `adb` com status `device`.
- Devices usados nos testes reais:
  - `RQCW702390V`: Pedro, SIP `1001`, tela 1080x2640.
  - `RQCX702YHWM`: Maria, SIP `1004`, tela 1080x2340.
- Logs VoIP úteis:
  - `adb -s RQCW702390V logcat -d -v time TelefoninhoVoip:I '*:S'`
  - `adb -s RQCX702YHWM logcat -d -v time TelefoninhoVoip:I '*:S'`
- Coordenadas e comandos manuais de debug ADB ficam em `docs/android-adb-debug.md`. Re-dump da UI antes de confiar em coordenadas antigas.

## Validação

- Dentro de `apps/child-android`:
  - `nix develop --command ./gradlew assembleDebug`
  - `nix develop --command ./gradlew assembleDebug testDebugUnitTest`
- Teste real quando houver celulares conectados:
  - `nix develop --command scripts/install-android.sh`
  - testar chamadas Pedro -> Maria e Maria -> Pedro;
  - verificar tocar, atender e áudio bidirecional.

