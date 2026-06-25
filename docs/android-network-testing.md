# Teste Android contra API local

O Docker Compose local publica a API no host:

```txt
0.0.0.0:3001 -> telefoninho-api:3001
```

Entao existem tres caminhos praticos para o app Android falar com a API.

O app tambem tem uma tela `SERVIDOR` no pareamento e na home. Use ela para trocar a API sem recompilar o APK.

## Opcao A — Emulador Android

Use o alias do emulador na tela `SERVIDOR`:

```env
ANDROID_API_BASE_URL=http://10.0.2.2:3001
```

Se preferir configurar em build time, edite `.env` e recompile:

```bash
cd apps/child-android
./gradlew assembleDebug
```

## Opcao B — Celular fisico na mesma rede

Use o IP da maquina na rede Wi-Fi:

```bash
ip -4 addr
```

Procure algo como `192.168.0.x` ou `10.0.0.x`, coloque na tela `SERVIDOR`:

```env
ANDROID_API_BASE_URL=http://192.168.0.x:3001
```

Teste pelo navegador do celular:

```txt
http://192.168.0.x:3001/health
```

Se nao abrir, normalmente e firewall, isolamento de clientes no Wi-Fi, VPN, ou a maquina e celular em redes diferentes.

## Opcao C — Celular fisico via bore

Use quando a rede local atrapalhar.

Em um terminal, suba a API:

```bash
pnpm dev:api
```

Em outro terminal:

```bash
bore local 3001 --to bore.pub
```

O bore vai mostrar uma porta publica. Configure na tela `SERVIDOR`:

```env
ANDROID_API_BASE_URL=http://bore.pub:<porta>
```

Se voce ainda nao instalou o APK, compile e instale:

```bash
cd apps/child-android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Importante

- O app Android usa `ANDROID_API_BASE_URL` como valor padrao de build, mas a tela `SERVIDOR` salva uma sobrescrita local no aparelho.
- HTTP ja esta liberado no app para desenvolvimento com `android:usesCleartextTraffic="true"`.
- Bore serve bem para API HTTP.
- Bore nao resolve Asterisk/SIP/RTP, porque as chamadas usam UDP. Para chamada real, teste na mesma rede local ou em VPS.
