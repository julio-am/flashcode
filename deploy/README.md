# Deploying FlashCode

Everything runs on one Linux server with Docker Compose:

```
internet ──443──▶ caddy ──▶ web ──┐
                                  ├──▶ postgres
                          worker ─┘
                            │  sandbox network (internal: no way out)
                            ▼
                          runner  (gVisor, nsjail per step)
```

- **caddy** gets and renews the HTTPS certificate for `SITE_DOMAIN` by itself.
- **web** is the Next.js site; **worker** grades attempts off the pg-boss queue;
  **migrate** applies database migrations before either starts.
- **runner** compiles and runs submissions under gVisor (`runtime: runsc`). It
  sits alone with the worker on an `internal` Docker network: no internet, no
  host, no Postgres. It gets only its token.
- Postgres data and Caddy's certificates live in named volumes and survive
  every deploy.

Files here: `compose.yml` (the stack), `Caddyfile`, `setup-server.sh`
(one-time server setup), `deploy.sh` (runs on the server for each deploy),
`smoke-test.sh` (grades one real submission through a live site) and
`production.env.example` (every setting).

CI's `deploy` job brings this exact stack up under gVisor on every PR and
grades a submission through it, so a green PR means the config works.

## First deploy

You'll need about half an hour. Steps 1, 2 and 5 happen in web consoles; the
rest is copy-paste in a terminal on your own computer. No secret ever needs to
be pasted anywhere but the server and GitHub's secret settings.

### 1. Create the server

Any provider works. Hetzner Cloud is the cheapest good option; DigitalOcean or
Vultr are fine too.

- Image **Ubuntu 24.04**, **x86** (not Arm).
- At least **2 vCPU and 4 GB RAM** (on Hetzner, the smallest shared x86 plan
  with 4 GB). The runner needs a real VM for gVisor, which every plan above is.
- Add **your own SSH public key** when asked, so you can log in as root.
- Note the server's **IPv4 address**. Below it's `203.0.113.10`; use yours.

### 2. Point litecode.io at it (Squarespace)

In Squarespace: **Domains** → **litecode.io** → **DNS** (DNS Settings).

1. Delete the **Squarespace Defaults** records (the preset `A` records for `@`
   and the `www` `CNAME`). They point at Squarespace's own servers and would
   fight with yours.
2. Under **Custom records**, add:

   | Host | Type | Data |
   | --- | --- | --- |
   | `@` | A | `203.0.113.10` |
   | `www` | A | `203.0.113.10` |

Changes usually show up within minutes, sometimes an hour. Check with
`dig +short litecode.io` (it should print your IP). Caddy can't get a
certificate until this resolves.

### 3. Make a deploy key (on your computer)

GitHub Actions logs in to the server with its own key, separate from yours:

```sh
ssh-keygen -t ed25519 -N "" -C flashcode-deploy -f ~/.ssh/flashcode_deploy
```

### 4. Set up the server

From your clone of the repo:

```sh
IP=203.0.113.10
scp deploy/setup-server.sh root@$IP:
ssh root@$IP bash setup-server.sh "\"$(cat ~/.ssh/flashcode_deploy.pub)\""
```

It installs Docker and gVisor, turns on a firewall that allows only SSH, HTTP
and HTTPS, adds 2 GB of swap, creates a `deploy` user that accepts the key from
step 3, and writes `/opt/flashcode/.env` with freshly generated database,
session, auth and runner secrets. It ends by printing `gVisor works.`

### 5. Give GitHub the deploy settings

In the repo on GitHub: **Settings** → **Secrets and variables** → **Actions**.

- **Variables** tab → New repository variable: `DEPLOY_HOST` = your server's IP.
- **Secrets** tab → New repository secret, twice:
  - `DEPLOY_SSH_KEY`: the whole private key. Copy it with
    `pbcopy < ~/.ssh/flashcode_deploy` (macOS) or
    `cat ~/.ssh/flashcode_deploy`, and paste it into the secret's value box.
  - `DEPLOY_KNOWN_HOSTS`: the output of `ssh-keyscan -t ed25519 $IP`, so the
    workflow can tell it's talking to your server.

With the GitHub CLI instead: `gh variable set DEPLOY_HOST -b $IP`,
`gh secret set DEPLOY_SSH_KEY < ~/.ssh/flashcode_deploy`,
`ssh-keyscan -t ed25519 $IP | gh secret set DEPLOY_KNOWN_HOSTS`.

### 6. Deploy

**Actions** → **Deploy** → **Run workflow** on `main`. From now on every push to
`main` deploys by itself once CI passes on it. The first run builds both images
on the server, which takes several minutes; later runs reuse the cache.

The workflow finishes by fetching `https://litecode.io` through Caddy, so a
green run means the site is live with a valid certificate. To check grading end
to end from your computer:

```sh
deploy/smoke-test.sh https://litecode.io   # prints "graded: passed"
```

### 7. Turn on sign-in

Guests can use the site without this. For the GitHub and Google buttons:

- **GitHub**: github.com → Settings → Developer settings → OAuth Apps → New.
  Homepage `https://litecode.io`, callback
  `https://litecode.io/api/auth/callback/github`.
- **Google**: Google Cloud Console → APIs & Services → Credentials → Create
  OAuth client ID → Web application. Authorized JavaScript origin
  `https://litecode.io`, redirect URI
  `https://litecode.io/api/auth/callback/google`. (Configure the consent
  screen first if it asks.)

Put the ids and secrets on the server, then redeploy:

```sh
ssh root@$IP
nano /opt/flashcode/.env        # fill GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET
sudo -u deploy /opt/flashcode/current/deploy/deploy.sh
```

A button appears once both halves of its pair are set.

## Running it

Run these on the server (as root or `deploy`).

| Task | Command |
| --- | --- |
| Status | `docker compose -p flashcode ps` |
| Logs | `docker compose -p flashcode logs -f --tail 100 web worker runner` |
| Redeploy the current release (after editing `.env`) | `sudo -u deploy /opt/flashcode/current/deploy/deploy.sh` |
| Roll back | `ls -t /opt/flashcode/releases/` then run `deploy/deploy.sh` inside an older one |
| Database shell | `docker exec -it flashcode-postgres-1 psql -U flashcode` |

Every release lives in `/opt/flashcode/releases/<commit>/` (the last five are
kept) and `/opt/flashcode/current` points at the live one. Settings live only
in `/opt/flashcode/.env`.

**Backups.** Turn on your provider's automatic server backups (Hetzner and
DigitalOcean both offer them). For a database dump you can copy off the
machine, add a nightly cron job as root:

```sh
mkdir -p /opt/flashcode/backups
echo '15 3 * * * root docker exec flashcode-postgres-1 pg_dump -U flashcode flashcode | gzip > /opt/flashcode/backups/$(date +\%F).sql.gz && find /opt/flashcode/backups -mtime +14 -delete' \
  > /etc/cron.d/flashcode-backup
```

**Sizing.** The defaults suit 2 vCPU / 4 GB. On a bigger machine, raise
`RUNNER_SLOTS` (jobs graded at once), `WORKER_CONCURRENCY` (keep it equal) and
`RUNNER_MEMORY` together in `.env`, then redeploy.

**Changing the domain.** Set `SITE_DOMAIN` in `.env` and the Actions variable
`SITE_DOMAIN` (only used for the link on the deployment), point DNS at the
server, update the OAuth callback URLs, and redeploy.

## Security notes

- Only Caddy publishes ports (80 and 443). Postgres and the runner are reachable
  only inside Docker's networks, and the firewall drops everything else but SSH.
- The runner shares a machine with the database here, which is the cheap
  option. The layers between a submission and the host are nsjail, then
  gVisor, then a network with no route anywhere but the worker. Moving the
  runner to its own VM later (runner/README.md) only changes
  `FLASH_SANDBOX_URL`.
- The `deploy` user is in the `docker` group, which is root-equivalent on this
  server. Its private key exists only in GitHub's secrets and on your computer.
- Don't add `pids_limit` to the runner: gVisor crashes when it hits one.
