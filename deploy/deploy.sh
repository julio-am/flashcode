#!/usr/bin/env bash
# Brings the stack up from an unpacked release. The Deploy workflow copies the
# commit to /opt/flashcode/releases/<sha>/ and runs this from there as "deploy".
#
#   /opt/flashcode/releases/<sha>/deploy/deploy.sh
#
# With APP_IMAGE and RUNNER_IMAGE set (the workflow passes ghcr.io tags built
# in GitHub Actions), images are pulled; otherwise they're built here from the
# Dockerfiles. Postgres data and Caddy's certificates live in named volumes
# and survive every deploy.
set -euo pipefail

ROOT="${FLASHCODE_ROOT:-/opt/flashcode}"
RELEASE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE is missing; run deploy/setup-server.sh first" >&2; exit 1; }
compose() { docker compose -f "$RELEASE/deploy/compose.yml" --env-file "$ENV_FILE" "$@"; }

# Re-running a release (after editing .env, or to roll back) reuses the images
# it was deployed with, which are still on this machine.
if [ -z "${APP_IMAGE:-}" ] && [ -f "$RELEASE/deploy/images.env" ]; then
  # shellcheck disable=SC1091
  . "$RELEASE/deploy/images.env"
  export APP_IMAGE RUNNER_IMAGE
fi
if [ -n "${APP_IMAGE:-}" ] && [ -n "${RUNNER_IMAGE:-}" ]; then
  docker image inspect "$APP_IMAGE" "$RUNNER_IMAGE" >/dev/null 2>&1 || compose pull --quiet
else
  compose build
fi
compose up -d --no-build --remove-orphans --wait --wait-timeout 300
if [ -n "${APP_IMAGE:-}" ]; then
  printf 'APP_IMAGE=%s\nRUNNER_IMAGE=%s\n' "$APP_IMAGE" "$RUNNER_IMAGE" > "$RELEASE/deploy/images.env"
fi
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

# Keep the last five releases, with the images they ran, for rollbacks; drop
# older ones and dangling images.
if [ -d "$ROOT/releases" ]; then
  ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +6 | while read -r old; do
    if [ -f "$old/deploy/images.env" ]; then
      # shellcheck disable=SC2046
      docker rmi $(sed -n 's/^[A-Z_]*=//p' "$old/deploy/images.env") >/dev/null 2>&1 || true
    fi
    rm -rf "$old"
  done
fi
docker image prune -f >/dev/null
