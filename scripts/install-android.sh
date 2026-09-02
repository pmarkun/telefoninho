#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Build & Install Android App ==="
cd "$ROOT/apps/child-android"

echo "[1/2] Compilando..."
./gradlew assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"

echo "[2/2] Instalando via ADB em todos os dispositivos detectados..."
if ! command -v adb >/dev/null 2>&1; then
  echo "  ADB não encontrado."
  echo "  APK disponível em: $APK"
  exit 1
fi

mapfile -t DEVICES < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')

if [ "${#DEVICES[@]}" -eq 0 ]; then
  echo "  Nenhum dispositivo ADB conectado/autorizado."
  echo "  APK disponível em: $APK"
  exit 1
fi

for DEVICE in "${DEVICES[@]}"; do
  echo "  Instalando em ${DEVICE}..."
  adb -s "$DEVICE" install -r "$APK"
done

echo "  OK - App instalada em ${#DEVICES[@]} dispositivo(s)"
