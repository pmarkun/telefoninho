#!/usr/bin/env sh
set -eu

rm -f services/api/dev.db
mkdir -p services/api
echo "Banco resetado em services/api/dev.db"

