# Desenvolvimento Local

1. `cp .env.example .env`
2. `nix develop`
3. `pnpm install`
4. `docker compose up -d`
5. `pnpm dev`

Scripts úteis:
- `./scripts/dev.sh` (bootstrap inicial)
- `./scripts/reset-db.sh`
- `pnpm seed`

## Android

O shell padrao do Nix inclui JDK e Gradle. Ele usa `ANDROID_HOME` quando ja estiver definido; caso contrario, assume `~/Android/Sdk`.

Para compilar o app Android:

```bash
nix develop
cd apps/child-android
./gradlew assembleDebug
```
