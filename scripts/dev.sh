#!/usr/bin/env sh
set -eu

cp -n .env.example .env >/dev/null 2>&1 || true
pnpm install
docker compose up -d
pnpm dev

