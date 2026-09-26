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
- The app and runner images are built in GitHub Actions, for x86 and Arm, and
  pushed to `ghcr.io/julio-am/flashcode-app` and `flashcode-runner`. The
  server only pulls and runs them, so building never competes with the site
  for its memory.

Files here: `compose.yml` (the stack), `Caddyfile`, `setup-server.sh`
(one-time server setup), `deploy.sh` (runs on the server for each deploy),
`smoke-test.sh` (grades one real submission through a live site) and
`production.env.example` (every setting).

CI's `deploy` job brings this exact stack up under gVisor on every PR, on
both x86 and Arm, and grades a submission through it, so a green PR means the
config works.

## First deploy

You'll need about an hour. Steps 1, 2 and 5 happen in web consoles; the rest
is copy-paste in a terminal on your own computer. No secret ever needs to be
pasted anywhere but the server and GitHub's secret settings.

The steps use **Oracle Cloud's Always Free tier**, which costs nothing. If
Oracle has no free capacity, use [Google Cloud's free e2-micro](#1-alternative-google-cloud-free-e2-micro)
for step 1 instead. Any other Ubuntu 24.04 server works the same way too (see
[Other providers](#other-providers)).

### 1. Create the server (Oracle Cloud)

If you don't have an SSH key yet, make one on your computer first:
`ssh-keygen -t ed25519` (press Enter at each question). Your public key is then
in `~/.ssh/id_ed25519.pub`.

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
   It asks for a card to verify you, but Always Free resources are never
   charged. The **home region** you pick is permanent and it's where the server
   lives, so choose one in the US near you.
2. In the console: **☰ menu** → **Compute** → **Instances** → **Create
   instance**. (Oracle renames things now and then; the choices below are what
   matters.)
   - **Image**: *Change image* → **Canonical Ubuntu** → **24.04** (the regular
     one, not *Minimal*).
   - **Shape**: *Change shape* → **Ampere** → **VM.Standard.A1.Flex**, with
     **2 OCPUs and 12 GB memory**. It's marked *Always Free-eligible*; the
     free allowance is 4 OCPUs and 24 GB in total.
   - **Networking**: keep *Create new virtual cloud network* and *public
     subnet*, and make sure **Assign a public IPv4 address** is on.
   - **Add SSH keys**: *Paste public keys*, and paste the contents of
     `~/.ssh/id_ed25519.pub`.
   - Leave the boot volume at its default size, then **Create**.

   If it says **Out of capacity** for the shape, pick another *availability
   domain* on the same page, or try again in a few hours. Free Arm capacity
   comes and goes.
3. When the instance is *Running*, note its **Public IP address**. Below it's
   `203.0.113.10`; use yours. You log in as `ubuntu`, not root.
4. Open the web ports in Oracle's cloud firewall. On the instance's page,
   click its **subnet** → **Security** (or *Security Lists*) → the **Default
   Security List** → **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, IP protocol **TCP**, destination port range
     `80,443`.

   Without this, nothing reaches the server except SSH, whatever the server
   itself allows.

**Idle servers.** Oracle may reclaim an Always Free server whose CPU, network
and memory use all stay very low for a week. A site with regular visitors
usually clears that bar. To rule it out, upgrade the account to *Pay As You
Go* (Billing → Upgrade): Always Free resources stay free, but anything you
create beyond the free allowance would then be billed, so only do it if
you're comfortable watching that.

### 1 (alternative). Google Cloud free e2-micro

Google Cloud gives one small x86 server free every month. It has only 1 GB of
RAM, which is enough because the images are built in GitHub Actions and the
server just runs them. Idle, the whole stack uses about 350 MB, and about
650 MB while grading a submission, and the setup script adds 2 GB of swap on
top. Expect it to feel slower than a bigger server, and it grades one
submission at a time.

The free tier has conditions, and anything outside them is billed, so match
these exactly. Check [Google's free tier page](https://cloud.google.com/free/docs/free-cloud-features#compute)
when you sign up, since the terms can change.

1. Sign up at [cloud.google.com/free](https://cloud.google.com/free). It asks
   for a card; new accounts also get trial credit. Create a project (for
   example `litecode`) and enable the **Compute Engine API** when asked.
2. **☰ menu** → **Compute Engine** → **VM instances** → **Create instance**:
   - **Region**: `us-west1` (Oregon), `us-central1` (Iowa) or `us-east1`
     (South Carolina). Only these three are free.
   - **Machine type**: series **E2**, type **e2-micro** (2 shared vCPUs, 1 GB).
   - **Boot disk**: *Change* → **Ubuntu** → **Ubuntu 24.04 LTS** (x86/64,
     not Arm or *Minimal*). Disk type **Standard persistent disk** (the
     default, *Balanced*, is not free), size **30 GB**.
   - **Firewall**: tick **Allow HTTP traffic** and **Allow HTTPS traffic**.
     That opens ports 80 and 443; there's nothing else to open.
   - **Security** → **Manage access** → **Add manually generated SSH keys**:
     paste the contents of `~/.ssh/id_ed25519.pub` (make one with
     `ssh-keygen -t ed25519` if you don't have it). The word at the end of
     that line, after the key, is the username you'll log in with.
   - **Create**.
3. Note the **External IP** on the instances list; below it's `203.0.113.10`.
   To keep it from changing when the server restarts, click the instance's
   network interface → **IP addresses** → promote the external IP to
   **Static**. (Google has started charging for some external IPs, so look
   at **Billing** a day later to confirm the total is $0.)
4. The free tier includes only 1 GB of outgoing traffic a month to most of
   the world. A lightly used site stays under that; downloading images onto
   the server is incoming traffic and doesn't count.

Then continue with step 2. In steps 4 and 7, log in with your username from
above instead of `ubuntu`, and **before step 6**, set the small-server sizes:

```sh
ssh <username>@$IP
sudo nano /opt/flashcode/.env
# change these three lines:
WORKER_CONCURRENCY=1
RUNNER_SLOTS=1
RUNNER_MEMORY=768m
```

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
scp deploy/setup-server.sh ubuntu@$IP:
ssh ubuntu@$IP sudo bash setup-server.sh "\"$(cat ~/.ssh/flashcode_deploy.pub)\""
```

It installs Docker and gVisor, turns on a firewall that allows only SSH, HTTP
and HTTPS (including Oracle's own server rules), adds 2 GB of swap, creates a `deploy` user that accepts the key from
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
`main` deploys by itself once CI passes on it. Each run builds the images in
GitHub Actions (the first time takes several minutes, later runs reuse the
cache), then the server pulls them and restarts what changed.

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
ssh ubuntu@$IP
sudo nano /opt/flashcode/.env   # fill GITHUB_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET
sudo -u deploy /opt/flashcode/current/deploy/deploy.sh
```

A button appears once both halves of its pair are set.

## Running it

Run these on the server with `sudo` in front (or as `deploy`, which needs no sudo).

| Task | Command |
| --- | --- |
| Status | `docker compose -p flashcode ps` |
| Logs | `docker compose -p flashcode logs -f --tail 100 web worker runner` |
| Redeploy the current release (after editing `.env`) | `sudo -u deploy /opt/flashcode/current/deploy/deploy.sh` |
| Roll back | `ls -t /opt/flashcode/releases/` then run `sudo -u deploy /opt/flashcode/releases/<commit>/deploy/deploy.sh` for an older one |
| Database shell | `docker exec -it flashcode-postgres-1 psql -U flashcode` |

Every release lives in `/opt/flashcode/releases/<commit>/` (the last five are
kept, with the images they ran, so a rollback needs no download) and
`/opt/flashcode/current` points at the live one. Settings live only
in `/opt/flashcode/.env`.

**Backups.** Turn on your provider's automatic server backups (Hetzner and
DigitalOcean both offer them). For a database dump you can copy off the
machine, add a nightly cron job (from `sudo -i`):

```sh
mkdir -p /opt/flashcode/backups
echo '15 3 * * * root docker exec flashcode-postgres-1 pg_dump -U flashcode flashcode | gzip > /opt/flashcode/backups/$(date +\%F).sql.gz && find /opt/flashcode/backups -mtime +14 -delete' \
  > /etc/cron.d/flashcode-backup
```

**Sizing.** The defaults suit 2 CPUs and 4 GB or more, which covers the
Oracle server above. On a bigger machine, raise `RUNNER_SLOTS` (jobs graded at
once), `WORKER_CONCURRENCY` (keep it equal) and `RUNNER_MEMORY` together in
`.env`, then redeploy. On a 1 or 2 GB machine, set all three lower before the
first deploy: `WORKER_CONCURRENCY=1`, `RUNNER_SLOTS=1`, and `RUNNER_MEMORY=768m`
(1 GB) or `1g` (2 GB).

## Other providers

Any VM with **Ubuntu 24.04** (x86-64 or Arm), **2 GB of RAM or more** and a
public IP works: DigitalOcean (a Basic *Regular* droplet), Vultr, Linode,
Hetzner and so on. Pick the plain Ubuntu 24.04 image, not a "Docker"
marketplace one, since the setup script installs Docker itself. Then follow
steps 2 to 7 above, logging in as `root` instead of `ubuntu` if that's what
the provider gives you. Most of them have no separate cloud firewall to open,
unlike Oracle.

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
