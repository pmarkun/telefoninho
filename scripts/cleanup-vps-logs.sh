#!/usr/bin/env bash
set -euo pipefail

APPLY=false
case "${1:-}" in
  --apply) APPLY=true ;;
  "") ;;
  --help|-h)
    echo "Usage: sudo bash $0 [--apply]"
    echo "Run on the VPS. Default: report only. --apply clears json-file logs over 100 MiB."
    echo "Affected containers briefly stop; last 200 lines are saved under /run."
    exit 0 ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { echo "Too many arguments" >&2; exit 2; }
[[ $EUID -eq 0 ]] || { echo "Run as root on the VPS." >&2; exit 1; }

restart_container=""
trap 'if [[ -n "$restart_container" ]]; then docker start "$restart_container" >/dev/null; fi' EXIT

for container in telefoninho-asterisk telefoninho-api telefoninho-parent-web telefoninho-caddy; do
  docker inspect "$container" >/dev/null
  driver=$(docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$container")
  [[ "$driver" == json-file ]] || continue
  log=$(docker inspect --format '{{.LogPath}}' "$container")
  [[ -f "$log" && ! -L "$log" && "$log" == /*/*-json.log ]] || {
    echo "Invalid log path for $container" >&2; exit 1;
  }
  bytes=$(stat -c %s "$log")
  echo "$container: $bytes bytes"
  (( bytes > 100 * 1024 * 1024 )) || continue
  if [[ "$APPLY" == false ]]; then
    echo "Would clear oversized log (use --apply)."
    continue
  fi
  running=$(docker inspect --format '{{.State.Running}}' "$container")
  if [[ "$running" == true ]]; then
    restart_container="$container"
    docker stop --time 30 "$container" >/dev/null
  fi
  snapshot=$(mktemp "/run/telefoninho-${container}-log.XXXXXX")
  chmod 600 "$snapshot"
  tail -n 200 "$log" > "$snapshot"
  truncate -s 0 "$log"
  if [[ -n "$restart_container" ]]; then
    docker start "$restart_container" >/dev/null
    restart_container=""
  fi
  echo "Cleared $container; recent lines: $snapshot (temporary, until VPS reboot)."
done
df -h /
