#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-vps68379.publiccloud.com.br}"
VPS_USER="${VPS_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/telefoninho}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RESET_DB=false

usage() {
  cat <<EOF
Usage: $0 [--reset-db] [--host HOST] [--user USER] [--dir REMOTE_DIR]

Deploys the current workspace to the Telefoninho VPS, rebuilds containers,
regenerates Asterisk config, and restarts Asterisk.

Options:
  --reset-db   Backup and remove /data/telefoninho.db* before starting the API.
  --host       VPS hostname. Default: ${VPS_HOST}
  --user       SSH user. Default: ${VPS_USER}
  --dir        Remote app directory. Default: ${REMOTE_DIR}
  -h, --help   Show this help.

Environment overrides:
  VPS_HOST, VPS_USER, REMOTE_DIR, ENV_FILE, COMPOSE_FILE
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --reset-db)
      RESET_DB=true
      shift
      ;;
    --host)
      VPS_HOST="${2:?Missing value for --host}"
      shift 2
      ;;
    --user)
      VPS_USER="${2:?Missing value for --user}"
      shift 2
      ;;
    --dir)
      REMOTE_DIR="${2:?Missing value for --dir}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

REMOTE="${VPS_USER}@${VPS_HOST}"
COMPOSE="docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE}"

remote() {
  ssh "$REMOTE" "cd '$REMOTE_DIR' && $*"
}

echo "==> Deploy target: ${REMOTE}:${REMOTE_DIR}"
if [ "$RESET_DB" = true ]; then
  echo "==> Database reset requested. A timestamped backup will be kept in the api-data volume."
fi

echo "==> Syncing workspace"
rsync -az --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.demo' \
  --exclude='.env.production' \
  --exclude='node_modules' \
  --exclude='**/node_modules' \
  --exclude='**/.next' \
  --exclude='**/build' \
  --exclude='services/api/dev.db*' \
  --exclude='infra/caddy/Caddyfile' \
  --exclude='infra/asterisk/config/*.generated.conf' \
  --exclude='infra/asterisk/config/pjsip.transport.local.conf' \
  ./ "$REMOTE:$REMOTE_DIR/"

echo "==> Building images"
remote "$COMPOSE build"

if [ "$RESET_DB" = true ]; then
  echo "==> Resetting production database"
  remote "$COMPOSE stop api || true"
  remote "$COMPOSE run --rm --no-deps --entrypoint sh api -lc 'set -eu; ts=\$(date +%Y%m%d-%H%M%S); mkdir -p /data/backups; cd /data; if ls telefoninho.db* >/dev/null 2>&1; then tar -czf backups/telefoninho.\$ts.tgz telefoninho.db*; fi; rm -f telefoninho.db telefoninho.db-*'"
  remote "rm -f infra/asterisk/config/pjsip.generated.conf infra/asterisk/config/extensions.generated.conf"
fi

echo "==> Starting services"
remote "$COMPOSE up -d"

echo "==> Waiting for API health"
remote "for i in \$(seq 1 30); do if $COMPOSE exec -T api node -e \"fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\" >/dev/null 2>&1; then exit 0; fi; sleep 2; done; echo 'API did not become healthy in time' >&2; exit 1"

echo "==> Regenerating Asterisk config"
remote "$COMPOSE run --rm api pnpm --filter @telefoninho/api generate:asterisk"

echo "==> Restarting Asterisk"
remote "$COMPOSE restart asterisk"

echo "==> Checking containers"
remote "$COMPOSE ps"

echo "==> Done"
