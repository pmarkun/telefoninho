#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Build & Install Android App ==="
cd "$ROOT/apps/child-android"

echo "[1/2] Compilando..."
./gradlew assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"

echo "[2/2] Instalando via ADB..."
if adb install -r "$APK"; then
  echo "  OK - App instalada no dispositivo"
else
  echo "  ADB não encontrado ou sem dispositivo conectado."
  echo "  APK disponível em: $APK"
  exit 1
fi
