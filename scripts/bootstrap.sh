#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Telefoninho bootstrap ==="

if [ ! -f .env ]; then
  echo "[1/6] Criando .env a partir de .env.example..."
  cp .env.example .env
  echo "       Edite .env se necessário (JWT_SECRET, etc.)"
else
  echo "[1/6] .env já existe, pulando"
fi

echo "[2/6] Instalando dependências..."
pnpm install

echo "[3/6] Rodando migrações do banco..."
pnpm db:migrate

echo "[4/6] Populando banco com dados de exemplo..."
pnpm seed

echo "[5/6] Subindo Asterisk (Docker)..."
docker compose up -d asterisk

echo "[6/6] Gerando configurações do Asterisk..."
pnpm infra:generate-asterisk

echo ""
echo "=== Pronto! Iniciando servidores de desenvolvimento ==="
echo "  API:       http://localhost:3001"
echo "  Painel:    http://localhost:3000"
echo "  Asterisk:  udp://localhost:5060"
echo ""
pnpm dev
