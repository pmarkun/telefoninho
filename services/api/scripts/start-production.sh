#!/usr/bin/env sh
set -eu

mkdir -p "$(dirname "${DATABASE_URL#file:}")"

pnpm --filter @telefoninho/api db:push

if [ "${SEED_DEMO:-false}" = "true" ]; then
  pnpm --filter @telefoninho/api seed
fi

exec pnpm --filter @telefoninho/api start

