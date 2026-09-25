#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for FlashCode. Run as root:
#
#   bash setup-server.sh "<public key GitHub Actions deploys with>"
#
# Installs Docker and gVisor, opens only SSH/HTTP/HTTPS, adds 2 GB of swap,
# creates a "deploy" user for GitHub Actions, and writes /opt/flashcode/.env
# with freshly generated secrets. Safe to re-run: it never overwrites .env.
set -euo pipefail

DEPLOY_KEY="${1:?usage: setup-server.sh \"ssh-ed25519 AAAA... flashcode-deploy\"}"
ROOT=/opt/flashcode
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades

# Docker Engine + Compose plugin (https://docs.docker.com/engine/install/ubuntu/)
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# gVisor, registered with Docker as the "runsc" runtime (https://gvisor.dev/docs/user_guide/install/)
if ! command -v runsc >/dev/null; then
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
    > /etc/apt/sources.list.d/gvisor.list
  apt-get update
  apt-get install -y runsc
fi
runsc install
systemctl restart docker

# Firewall: SSH, HTTP (certificate challenges and the redirect) and HTTPS only.
# Postgres and the runner publish no ports, so Docker's own rules open nothing else.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Swap, so `next build` during a deploy doesn't run a 4 GB machine out of memory.
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The user GitHub Actions logs in as. Being in the docker group makes it
# root-equivalent on this machine, so its key lives only in GitHub's secrets.
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys 2>/dev/null \
  || echo "$DEPLOY_KEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

install -d -m 750 -o deploy -g deploy "$ROOT" "$ROOT/releases"
if [ ! -f "$ROOT/.env" ]; then
  gen() { openssl rand -hex 32; }
  cat > "$ROOT/.env" <<ENV
# FlashCode production settings (template: deploy/production.env.example).
SITE_DOMAIN=litecode.io

POSTGRES_PASSWORD=$(gen)
SESSION_SECRET=$(gen)
BETTER_AUTH_SECRET=$(gen)
RUNNER_TOKEN=$(gen)

# Sign-in. Leave a pair empty to hide that button.
# GitHub callback: https://<SITE_DOMAIN>/api/auth/callback/github
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
# Google callback: https://<SITE_DOMAIN>/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

WORKER_CONCURRENCY=2
RUNNER_SLOTS=2
RUNNER_MEMORY=2g
ENV
  chown deploy:deploy "$ROOT/.env"
  chmod 600 "$ROOT/.env"
  echo "Wrote $ROOT/.env with generated secrets."
fi

echo
docker run --rm --runtime=runsc hello-world >/dev/null && echo "gVisor works."
echo "Server ready. Next: add the GitHub secrets and run the Deploy workflow (deploy/README.md)."
