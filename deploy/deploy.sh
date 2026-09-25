#!/usr/bin/env bash
# Brings the stack up from an unpacked release. The Deploy workflow copies the
# commit to /opt/flashcode/releases/<sha>/ and runs this from there as "deploy".
#
#   /opt/flashcode/releases/<sha>/deploy/deploy.sh
#
# Images are built here, on the server, so it needs no registry. Postgres data
# and Caddy's certificates live in named volumes and survive every deploy.
set -euo pipefail

ROOT="${FLASHCODE_ROOT:-/opt/flashcode}"
RELEASE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is missing; run deploy/setup-server.sh first" >&2; exit 1; }
compose() { docker compose -f "$RELEASE/deploy/compose.yml" --env-file "$ENV_FILE" "$@"; }

compose build
compose up -d --remove-orphans --wait --wait-timeout 300
ln -sfn "$RELEASE" "$ROOT/current"

# Check the site through Caddy, the way a visitor reaches it.
domain="$(sed -n 's/^SITE_DOMAIN=//p' "$ENV_FILE")"
# DEPLOY_CHECK_INSECURE=1 skips certificate checks (CI, where the domain is
# localhost and Caddy signs with its own local CA).
insecure=(); [ "${DEPLOY_CHECK_INSECURE:-}" = 1 ] && insecure=(-k)
for i in $(seq 30); do
  if curl -fsS "${insecure[@]}" -o /dev/null --resolve "$domain:443:127.0.0.1" "https://$domain/"; then
    echo "https://$domain is up."
    break
  fi
  [ "$i" = 30 ] && { echo "https://$domain did not answer; see: docker compose -p flashcode logs caddy web" >&2; exit 1; }
  sleep 5
done

# Keep the last five releases and drop dangling images.
if [ -d "$ROOT/releases" ]; then
  ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
fi
docker image prune -f >/dev/null
