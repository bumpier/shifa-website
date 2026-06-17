# Ubuntu VPS Multi-Domain Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision one fresh Ubuntu VPS to serve the Shifa storefront under many domains at once (so a blocked domain is replaced by an already-live spare), with self-hosted Postal email, TLS, hardening, and off-box backups.

**Architecture:** A single `next start` process bound to `127.0.0.1:3000` under systemd; nginx terminates TLS and reverse-proxies every storefront domain (server_name aliases) to that one app and its one SQLite DB. Postal runs co-located on a separate stable mail domain. "Failover" = pre-provisioned spare domains, all live; you stop advertising a dead one and point users at a live one via `add-domain.sh` and out-of-band comms.

**Tech Stack:** Ubuntu 22.04/24.04 LTS · Node 20 LTS · Next.js 15 (`next start`) · Prisma + SQLite · nginx · certbot (Let's Encrypt) · systemd · ufw · fail2ban · Postal (Docker) · sqlite3 + rclone for backups.

## Global Constraints

These apply to **every** task. Values copied from the design spec (`docs/superpowers/specs/2026-06-17-ubuntu-vps-multi-domain-hosting-design.md`).

- ONE Next.js app + ONE SQLite DB; all domains are nginx `server_name` aliases (shared backend, same brand).
- App binds **`127.0.0.1:3000` only** — never `0.0.0.0`; reachable solely via nginx.
- DB lives at `<app>/data/shifa.db`; uploads at `<app>/public/uploads/`. Both must persist and be backed up off-box. The DB is never web-served.
- Apply migrations with **`prisma migrate deploy`** on the server — never `migrate dev`.
- `ufw` allows **22, 80, 443, 25** (plus 587/465 if Postal needs submission); everything else denied.
- **Node 20 LTS.** RAM is ~10 GB (confirmed) — no swap needed.
- Postal sends from a **separate stable mail domain**, never one of the burnable storefront domains.
- Security headers are already emitted by the app (`next.config.js`) — do **not** duplicate them in nginx.
- Off-box backups must include `.env.local` (holds `ENCRYPTION_KEY` + `JWT_SECRET`; without `ENCRYPTION_KEY`, encrypted affiliate wallet addresses are unrecoverable).
- App origin: `https://github.com/bumpier/shifa-website.git`.

## Operator Inputs (substitute once, used throughout)

These are deployment-specific values, not plan gaps. Decide them before Task 1 and use consistently:

| Token | Meaning | Example |
|---|---|---|
| `PRIMARY_DOMAIN` | Main storefront domain you advertise | `shifa-shop.com` |
| `SPARE_DOMAINS` | 3–5 spare storefront domains (pre-provisioned, all live) | `shifa-eu.com shifa-care.net …` |
| `MAIL_DOMAIN` | Stable sending+admin domain for Postal (NOT a storefront domain) | `mail.shifa-ops.com` |
| `SENDING_DOMAIN` | Envelope/From domain for emails (can equal `MAIL_DOMAIN`'s base) | `shifa-ops.com` |
| `ADMIN_EMAIL` | Address on `SENDING_DOMAIN` for certbot + DMARC reports | `admin@shifa-ops.com` |
| `VPS_IP` | The server's public IP | `203.0.113.10` |
| `APP_USER` | Non-root Linux user that owns/runs the app | `shifa` |
| `APP_DIR` | Where the app is cloned | `/srv/shifa` |

---

## File Structure (repo artifacts created by this plan)

All committable artifacts live under a new `deploy/` directory:

```
deploy/
├── README.md                  # Top-to-bottom provisioning runbook (the index)
├── nginx/
│   └── shifa.conf             # Multi-domain reverse-proxy server block
├── systemd/
│   └── shifa.service          # systemd unit for `next start`
├── scripts/
│   ├── provision-base.sh      # Base hardening: user, ufw, fail2ban, auto-upgrades
│   ├── deploy.sh              # pull → build → migrate → restart
│   ├── add-domain.sh          # Add a storefront domain to nginx + cert (failover)
│   └── backup.sh             # SQLite .backup + uploads + env, rotate, off-box copy
└── postal/
    └── README.md              # Postal install + DNS (SPF/DKIM/DMARC/PTR) runbook
```

Each task creates one focused artifact, verifies it locally where possible (`bash -n`), commits it, and documents the live server execution + expected output. `shellcheck` is not installed on the dev machine, so local verification is `bash -n` (syntax) only; full validation (`nginx -t`, `systemd-analyze verify`) happens on the VPS as the task's real gate.

---

### Task 1: Repo scaffold + provisioning runbook index

**Files:**
- Create: `deploy/README.md`

**Interfaces:**
- Produces: the `deploy/` directory and the runbook index that later tasks append their server-execution sections to.

- [ ] **Step 1: Create the runbook index**

Create `deploy/README.md`:

```markdown
# Shifa VPS provisioning runbook

Run these on a fresh Ubuntu 22.04/24.04 LTS VPS, in order. Substitute the
Operator Inputs from `docs/superpowers/plans/2026-06-17-ubuntu-vps-multi-domain-hosting.md`.

1. Base hardening & firewall — `scripts/provision-base.sh`
2. Install runtime (Node 20, nginx, certbot, sqlite3, Docker)
3. Clone app, create env, build, migrate — to `/srv/shifa`
4. systemd service — `systemd/shifa.service`
5. nginx multi-domain + TLS — `nginx/shifa.conf` + certbot
6. Add-domain workflow (failover) — `scripts/add-domain.sh`
7. Backups & cron — `scripts/backup.sh`
8. Postal email — `postal/README.md`
9. End-to-end verification

Each numbered section below is filled in by its task.
```

- [ ] **Step 2: Verify the file exists**

Run: `test -f deploy/README.md && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add deploy/README.md
git commit -m "deploy: add VPS provisioning runbook scaffold"
```

---

### Task 2: Base hardening + firewall script

**Files:**
- Create: `deploy/scripts/provision-base.sh`
- Modify: `deploy/README.md` (fill section 1)

**Interfaces:**
- Consumes: Operator Inputs `APP_USER`.
- Produces: a non-root sudo user `APP_USER`, SSH key-only auth, `ufw` allowing 22/80/443/25, `fail2ban`, `unattended-upgrades`.

- [ ] **Step 1: Write the script**

Create `deploy/scripts/provision-base.sh`:

```bash
#!/usr/bin/env bash
# Base hardening for a fresh Ubuntu VPS. Run as root.
# Usage: APP_USER=shifa PUBKEY="ssh-ed25519 AAAA..." bash provision-base.sh
set -euo pipefail

: "${APP_USER:?set APP_USER (e.g. shifa)}"
: "${PUBKEY:?set PUBKEY to your SSH public key}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg

# Non-root sudo user with your SSH key
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
  usermod -aG sudo "$APP_USER"
fi
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
echo "$PUBKEY" > "/home/$APP_USER/.ssh/authorized_keys"
chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"

# SSH: key-only, no root login
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd

# Firewall: SSH, HTTP, HTTPS, SMTP only
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
ufw --force enable

# fail2ban on SSH (defaults are fine) + enable auto security updates
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Base hardening complete. ufw status:"
ufw status verbose
```

- [ ] **Step 2: Syntax-check locally**

Run: `bash -n deploy/scripts/provision-base.sh && echo OK`
Expected: `OK`

- [ ] **Step 3: Document execution in the runbook**

Append to `deploy/README.md` under section 1:

````markdown
## 1. Base hardening & firewall

As root on the fresh VPS:

```bash
APP_USER=shifa \
PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" \   # your local public key
bash deploy/scripts/provision-base.sh
```

Verify: `ufw status verbose` shows 22, 80, 443, 25 ALLOW and default deny incoming.
Then re-login as the new user over your key before closing the root session.
````

- [ ] **Step 4: Commit**

```bash
git add deploy/scripts/provision-base.sh deploy/README.md
git commit -m "deploy: base VPS hardening + firewall script"
```

- [ ] **Step 5: [Server] Execute & verify**

Run on the VPS (as root): the command from the runbook.
Expected: `ufw status verbose` lists `22/tcp ALLOW`, `80/tcp ALLOW`, `443/tcp ALLOW`, `25/tcp ALLOW`, and `Default: deny (incoming)`. A second SSH session authenticates with the key (password auth refused).

---

### Task 3: Install runtime (Node 20, nginx, certbot, sqlite3)

**Files:**
- Modify: `deploy/README.md` (fill section 2)

**Interfaces:**
- Produces: `node` 20.x, `npm`, `nginx`, `certbot` + `python3-certbot-nginx`, `sqlite3`, `git`, `build-essential` installed.

- [ ] **Step 1: Document the install commands**

Append to `deploy/README.md` under section 2:

````markdown
## 2. Install runtime

As the sudo user:

```bash
# Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential nginx \
  certbot python3-certbot-nginx sqlite3

node -v   # expect v20.x
nginx -v  # expect nginx/1.2x
```
````

- [ ] **Step 2: Commit**

```bash
git add deploy/README.md
git commit -m "deploy: runtime install runbook (Node 20, nginx, certbot, sqlite3)"
```

- [ ] **Step 3: [Server] Execute & verify**

Run the section-2 commands on the VPS.
Expected: `node -v` prints `v20.` (a 20.x version); `nginx -v` prints a 1.2x version; `which certbot sqlite3` resolves both.

---

### Task 4: Clone app, create env, build, migrate (+ deploy.sh)

**Files:**
- Create: `deploy/scripts/deploy.sh`
- Modify: `deploy/README.md` (fill section 3)

**Interfaces:**
- Consumes: Operator Inputs `APP_DIR`, `APP_USER`, `PRIMARY_DOMAIN`; the app repo.
- Produces: a built app at `APP_DIR` with `data/shifa.db` created and seeded; `.env` (Prisma CLI) and `.env.local` (runtime) populated; a repeatable `deploy.sh` (pull → build → migrate → restart) for future updates.

- [ ] **Step 1: Document clone + env + build**

Append to `deploy/README.md` under section 3. The env var list mirrors `.env.example` exactly:

````markdown
## 3. Clone app, env, build, migrate

As the app user (`sudo -iu shifa`):

```bash
sudo install -d -o shifa -g shifa /srv
git clone https://github.com/bumpier/shifa-website.git /srv/shifa
cd /srv/shifa

# Prisma CLI reads .env; the app runtime reads .env.local
printf 'DATABASE_URL="file:../data/shifa.db"\n' > .env

cat > .env.local <<'EOF'
DATABASE_URL="file:../data/shifa.db"
NEXT_PUBLIC_SITE_URL=https://PRIMARY_DOMAIN
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
JWT_SECRET=REPLACE_WITH_openssl_rand_hex_32
ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD
AFFILIATE_DEFAULT_COMMISSION=10
AFFILIATE_MIN_PAYOUT_USDT=25
MASTER_OVERRIDE_PERCENT=2.5
MASTER_SALES_THRESHOLD=10
POSTAL_URL=
POSTAL_API_KEY=
EMAIL_FROM="Shifa <noreply@SENDING_DOMAIN>"
ENCRYPTION_KEY=REPLACE_WITH_openssl_rand_hex_32
CRON_SECRET=REPLACE_WITH_openssl_rand_hex_32
EOF
chmod 600 .env.local

# Generate the three secrets and paste them in:
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # CRON_SECRET
# Edit .env.local: set the three secrets, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL,
# and SENDING_DOMAIN. Leave NOWPAYMENTS_* / POSTAL_* until those tasks.

npm ci
npm run build
npx prisma migrate deploy
npx prisma db seed   # optional: 4 sample products
```

Verify: `ls -l data/shifa.db` shows the DB file; `npm run build` ends with
`✓ Compiled successfully`.
````

- [ ] **Step 2: Write the repeatable deploy script**

Create `deploy/scripts/deploy.sh`:

```bash
#!/usr/bin/env bash
# Update a live deploy: pull, install, build, migrate, restart.
set -euo pipefail
cd /srv/shifa
git pull --ff-only
npm ci
npm run build
npx prisma migrate deploy
sudo systemctl restart shifa
sudo systemctl status shifa --no-pager | head -n 6
```

- [ ] **Step 3: Syntax-check locally**

Run: `bash -n deploy/scripts/deploy.sh && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add deploy/scripts/deploy.sh deploy/README.md
git commit -m "deploy: app clone/env/build/migrate runbook + deploy.sh"
```

- [ ] **Step 5: [Server] Execute & verify**

Run section 3 on the VPS.
Expected: `data/shifa.db` exists; `prisma migrate deploy` reports migrations applied (or "No pending migrations"); the build completes without error. (`deploy.sh` is exercised later whenever code changes; it expects the systemd unit from Task 5.)

---

### Task 5: systemd service for the app

**Files:**
- Create: `deploy/systemd/shifa.service`
- Modify: `deploy/README.md` (fill section 4)

**Interfaces:**
- Consumes: `APP_DIR=/srv/shifa`, `APP_USER=shifa`, the built app from Task 4.
- Produces: a running `shifa.service` listening on `127.0.0.1:3000`, auto-restart, boot-enabled.

- [ ] **Step 1: Write the unit**

Create `deploy/systemd/shifa.service`:

```ini
[Unit]
Description=Shifa Next.js storefront
After=network.target

[Service]
Type=simple
User=shifa
Group=shifa
WorkingDirectory=/srv/shifa
EnvironmentFile=/srv/shifa/.env.local
Environment=NODE_ENV=production
# Bind to localhost only — nginx is the sole public entry point.
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Document install + verify**

Append to `deploy/README.md` under section 4:

````markdown
## 4. systemd service

```bash
sudo cp /srv/shifa/deploy/systemd/shifa.service /etc/systemd/system/shifa.service
# Confirm npm path matches the unit (NodeSource installs /usr/bin/npm):
which npm
sudo systemctl daemon-reload
sudo systemctl enable --now shifa
sudo systemctl status shifa --no-pager | head -n 6
```

Verify the app answers locally but NOT publicly:
```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000   # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://VPS_IP:3000       # expect timeout/refused
```
````

- [ ] **Step 3: Commit**

```bash
git add deploy/systemd/shifa.service deploy/README.md
git commit -m "deploy: systemd unit for the Next.js app (localhost-bound)"
```

- [ ] **Step 4: [Server] Execute & verify**

Run section 4 on the VPS.
Expected: `systemctl status shifa` shows `active (running)`; `curl 127.0.0.1:3000` returns `200`; `curl VPS_IP:3000` from outside is refused/times out (ufw + localhost bind).

---

### Task 6: nginx multi-domain reverse proxy + TLS

**Files:**
- Create: `deploy/nginx/shifa.conf`
- Modify: `deploy/README.md` (fill section 5)

**Interfaces:**
- Consumes: the running app on `127.0.0.1:3000`; Operator Inputs `PRIMARY_DOMAIN`, `SPARE_DOMAINS`, `ADMIN_EMAIL`.
- Produces: nginx serving all storefront domains over HTTPS from one cert named `shifa`; `X-Forwarded-Host` set (consumed later by the §9 app change).

- [ ] **Step 1: Write the server block**

Create `deploy/nginx/shifa.conf`. The single `server_name` line is the one place domains are added/removed. certbot will add the `:443` block and the http→https redirect on first run.

```nginx
# /etc/nginx/sites-available/shifa.conf
# All storefront domains share one upstream app + one DB.
# Add/remove domains on the server_name line below (or via add-domain.sh).

upstream shifa_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    # <-- storefront domains live here (apex + www). add-domain.sh edits THIS line.
    server_name PRIMARY_DOMAIN www.PRIMARY_DOMAIN;

    client_max_body_size 6m;   # product image uploads are capped at 5MB

    location / {
        proxy_pass http://shifa_app;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 300s;
    }
}
```

- [ ] **Step 2: Document enable + cert issue**

Append to `deploy/README.md` under section 5:

````markdown
## 5. nginx multi-domain + TLS

Point DNS first: add A records for PRIMARY_DOMAIN, www.PRIMARY_DOMAIN, and each
SPARE_DOMAIN (apex + www) → VPS_IP. Wait for propagation (`dig +short DOMAIN`).

```bash
# Put the real domains into the server_name line before issuing certs.
sudo cp /srv/shifa/deploy/nginx/shifa.conf /etc/nginx/sites-available/shifa.conf
sudo ln -sf /etc/nginx/sites-available/shifa.conf /etc/nginx/sites-enabled/shifa.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudoedit /etc/nginx/sites-available/shifa.conf   # add all spare domains to server_name
sudo nginx -t && sudo systemctl reload nginx

# One cert named "shifa" covering every domain (repeat -d per name):
sudo certbot --nginx --cert-name shifa --redirect --non-interactive \
  --agree-tos -m ADMIN_EMAIL \
  -d PRIMARY_DOMAIN -d www.PRIMARY_DOMAIN \
  -d SPARE1 -d www.SPARE1 -d SPARE2 -d www.SPARE2   # ...all spares

sudo nginx -t && sudo systemctl reload nginx
systemctl list-timers | grep certbot   # auto-renewal timer present
```

Verify each domain:
```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://PRIMARY_DOMAIN   # expect 200
```
````

- [ ] **Step 3: Commit**

```bash
git add deploy/nginx/shifa.conf deploy/README.md
git commit -m "deploy: nginx multi-domain reverse proxy + TLS runbook"
```

- [ ] **Step 4: [Server] Execute & verify**

Run section 5 on the VPS.
Expected: `nginx -t` reports `syntax is ok` / `test is successful`; `certbot` reports the certificate was issued for all names; `curl https://PRIMARY_DOMAIN` (and each spare) returns `200`; the certbot renew timer is listed.

---

### Task 7: add-domain.sh — the failover enabler

**Files:**
- Create: `deploy/scripts/add-domain.sh`
- Modify: `deploy/README.md` (fill section 6)

**Interfaces:**
- Consumes: the `shifa.conf` from Task 6 (single `:80` `server_name` line first in file), the `shifa` cert, `ADMIN_EMAIL`.
- Produces: a one-command way to bring a new storefront domain live (DNS must already point at the box).

- [ ] **Step 1: Write the script**

Create `deploy/scripts/add-domain.sh`:

```bash
#!/usr/bin/env bash
# Add a storefront domain (apex + www) to the shared nginx block and cert.
# DNS for the domain must already point at this server.
# Usage: sudo ADMIN_EMAIL=admin@shifa-ops.com bash add-domain.sh example.com
set -euo pipefail

DOMAIN="${1:?usage: add-domain.sh <domain>}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL}"
CONF=/etc/nginx/sites-available/shifa.conf
ESC="${DOMAIN//./\\.}"

if grep -qE "([[:space:]]|;|^)${ESC}([[:space:]]|;)" "$CONF"; then
  echo "${DOMAIN} already present; re-running certbot to ensure coverage."
else
  # Insert apex + www into the FIRST server_name line (the :80 block, top of file).
  sed -i "0,/server_name /s//server_name ${DOMAIN} www.${DOMAIN} /" "$CONF"
fi

nginx -t
systemctl reload nginx

# --expand adds the new names to the existing "shifa" certificate.
certbot --nginx --cert-name shifa --expand --redirect --non-interactive \
  --agree-tos -m "$ADMIN_EMAIL" \
  -d "$DOMAIN" -d "www.$DOMAIN"

nginx -t && systemctl reload nginx
echo "Live: https://${DOMAIN}"
```

- [ ] **Step 2: Syntax-check locally**

Run: `bash -n deploy/scripts/add-domain.sh && echo OK`
Expected: `OK`

- [ ] **Step 3: Document usage**

Append to `deploy/README.md` under section 6:

````markdown
## 6. Add / retire a storefront domain (failover)

Pre-provision spares ahead of need so switching is instant. To add one
(DNS A records for apex + www must already point at VPS_IP):

```bash
sudo ADMIN_EMAIL=admin@shifa-ops.com bash /srv/shifa/deploy/scripts/add-domain.sh newshop.com
curl -sS -o /dev/null -w '%{http_code}\n' https://newshop.com   # expect 200
```

To retire a blocked domain: remove its names from the `server_name` line in
`/etc/nginx/sites-available/shifa.conf`, then `sudo nginx -t && sudo systemctl
reload nginx`. A domain blocked at DNS/registrar level is unreachable, so you
cannot redirect *from* it — push users to a live spare via the gateway
redirector (optional, spec §8) and out-of-band comms (Postal email, etc.).
````

- [ ] **Step 4: Commit**

```bash
git add deploy/scripts/add-domain.sh deploy/README.md
git commit -m "deploy: add-domain.sh for instant storefront-domain failover"
```

- [ ] **Step 5: [Server] Execute & verify**

On the VPS, point a fresh test domain's DNS at `VPS_IP`, then run `add-domain.sh` for it.
Expected: script prints `Live: https://<domain>`; `curl https://<domain>` returns `200`; `sudo certbot certificates` shows the new names on the `shifa` cert; the app was **not** restarted.

---

### Task 8: Backups + cron

**Files:**
- Create: `deploy/scripts/backup.sh`
- Modify: `deploy/README.md` (fill section 7)

**Interfaces:**
- Consumes: `APP_DIR=/srv/shifa`, the DB at `data/shifa.db`, `.env.local`, uploads at `public/uploads/`.
- Produces: nightly consistent DB backup + uploads + env tarball, rotated locally, copied off-box via an rclone remote `offsite`. Adds the nudges cron.

- [ ] **Step 1: Write the backup script**

Create `deploy/scripts/backup.sh`:

```bash
#!/usr/bin/env bash
# Nightly backup: consistent SQLite snapshot + uploads + env, rotate, push off-box.
# Requires an rclone remote named "offsite" (see runbook).
set -euo pipefail

APP=/srv/shifa
DEST=/var/backups/shifa
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

# Consistent online snapshot (safe while the app is running)
sqlite3 "$APP/data/shifa.db" ".backup '$DEST/shifa-$STAMP.db'"

# Uploads + secrets (env holds ENCRYPTION_KEY/JWT_SECRET)
tar czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP/public" uploads
install -m 600 "$APP/.env.local" "$DEST/env-$STAMP.local"

# Keep the most recent 14 of each locally
for pat in 'shifa-*.db' 'uploads-*.tar.gz' 'env-*.local'; do
  ls -1t "$DEST"/$pat 2>/dev/null | tail -n +15 | xargs -r rm -f
done

# Push the night's three files off-box (encrypted remote recommended)
rclone copy "$DEST/shifa-$STAMP.db"      offsite:shifa-backups/
rclone copy "$DEST/uploads-$STAMP.tar.gz" offsite:shifa-backups/
rclone copy "$DEST/env-$STAMP.local"     offsite:shifa-backups/

echo "Backup complete: shifa-$STAMP.db (local + offsite)"
```

- [ ] **Step 2: Syntax-check locally**

Run: `bash -n deploy/scripts/backup.sh && echo OK`
Expected: `OK`

- [ ] **Step 3: Document rclone + cron**

Append to `deploy/README.md` under section 7:

````markdown
## 7. Backups & cron

Install rclone and configure an off-box remote named `offsite` (S3/B2/etc.):
```bash
sudo apt-get install -y rclone
rclone config   # create a remote named exactly: offsite
```

Install cron jobs (as the app user, `crontab -e`):
```cron
# Nightly backup at 03:30
30 3 * * * /usr/bin/bash /srv/shifa/deploy/scripts/backup.sh >> /var/log/shifa-backup.log 2>&1
# Daily repurchase-nudge job (reads CRON_SECRET from the app env)
15 9 * * * curl -fsS -H "Authorization: Bearer $(grep -m1 '^CRON_SECRET=' /srv/shifa/.env.local | cut -d= -f2)" https://PRIMARY_DOMAIN/api/cron/nudges
```

Verify: `bash /srv/shifa/deploy/scripts/backup.sh` then
`rclone ls offsite:shifa-backups/` lists today's three files.
````

- [ ] **Step 4: Commit**

```bash
git add deploy/scripts/backup.sh deploy/README.md
git commit -m "deploy: nightly off-box backups + nudges cron"
```

- [ ] **Step 5: [Server] Execute & verify**

On the VPS: configure the `offsite` rclone remote, install the cron lines, run `backup.sh` once.
Expected: `/var/backups/shifa/` contains `shifa-<stamp>.db`, `uploads-<stamp>.tar.gz`, `env-<stamp>.local`; `rclone ls offsite:shifa-backups/` lists those three; the restored DB opens (`sqlite3 <copy> '.tables'` lists app tables).

---

### Task 9: Postal email (self-hosted, separate mail domain)

**Files:**
- Create: `deploy/postal/README.md`
- Modify: `deploy/README.md` (fill section 8)

**Interfaces:**
- Consumes: Operator Inputs `MAIL_DOMAIN`, `SENDING_DOMAIN`, `ADMIN_EMAIL`, `VPS_IP`; port 25 open; Docker.
- Produces: a Postal install reachable at `https://MAIL_DOMAIN`, an API credential, and `.env.local` wired with `POSTAL_URL` / `POSTAL_API_KEY` / `EMAIL_FROM` so the app sends transactional email.

- [ ] **Step 1: Write the Postal runbook**

Create `deploy/postal/README.md`:

````markdown
# Postal email setup (self-hosted)

Postal sends from **SENDING_DOMAIN** via **MAIL_DOMAIN**, kept separate from the
burnable storefront domains so a blocked storefront never poisons mail reputation.

## A. Prerequisites
- DNS A record: `MAIL_DOMAIN` → `VPS_IP`.
- Reverse DNS (PTR): ask the VPS provider to set `VPS_IP` → `MAIL_DOMAIN`.
- Docker + compose:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  ```

## B. Install Postal
Follow the official installer (https://docs.postalserver.io/getting-started/installation):
```bash
sudo git clone https://github.com/postalserver/install /opt/postal/install
sudo ln -s /opt/postal/install/bin/postal /usr/bin/postal
sudo postal bootstrap MAIL_DOMAIN
sudo postal initialize
sudo postal make-user        # creates the admin login
sudo postal start
```

## C. DNS records (add at your DNS host for SENDING_DOMAIN)
Postal's web UI prints exact values when you add the domain. You will set:
- **SPF**  `TXT @  "v=spf1 a mx include:MAIL_DOMAIN ~all"`
- **DKIM** `TXT <selector>._domainkey  "v=DKIM1; t=s; h=sha256; p=<key from Postal>"`
- **DMARC** `TXT _dmarc  "v=DMARC1; p=quarantine; rua=mailto:ADMIN_EMAIL"`
- **Return-Path** `CNAME` as printed by Postal (custom-return-path).

## D. Create the mail server + API credential
In the Postal web UI: create an Organization → Mail Server → add SENDING_DOMAIN
(verify the DNS above) → Credentials → **API** → copy the key.

## E. Wire the app
Edit `/srv/shifa/.env.local`:
```
POSTAL_URL=https://MAIL_DOMAIN
POSTAL_API_KEY=<api credential from step D>
EMAIL_FROM="Shifa <noreply@SENDING_DOMAIN>"
```
Then `sudo systemctl restart shifa`.

## F. Verify deliverability
Trigger a real email (e.g. request an affiliate invite / password reset, or send
a test from Postal). Send to a https://www.mail-tester.com address and confirm
SPF, DKIM, and DMARC all PASS. Fresh-IP reputation is weak at first — warm up
volume gradually. If deliverability stays poor, point Postal at a smarthost
relay (Postal → Mail Server → SMTP settings).
````

- [ ] **Step 2: Document the nginx vhost for the mail domain**

Append to `deploy/README.md` under section 8 (Postal's UI runs on its own port; front it with TLS on `MAIL_DOMAIN`):

````markdown
## 8. Postal email

Full steps: `deploy/postal/README.md`. After `postal start`, expose the web UI
over HTTPS on MAIL_DOMAIN with its own cert (kept off the storefront `shifa` cert):

```bash
# Postal ships a web server on 127.0.0.1:5000 by default; reverse-proxy it.
sudo tee /etc/nginx/sites-available/postal.conf >/dev/null <<'NGINX'
server {
    listen 80;
    server_name MAIL_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/postal.conf /etc/nginx/sites-enabled/postal.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx --cert-name postal -d MAIL_DOMAIN --redirect \
  --non-interactive --agree-tos -m ADMIN_EMAIL
```

Verify: `https://MAIL_DOMAIN` loads the Postal login; a test email scores SPF/DKIM/DMARC = pass.
````

- [ ] **Step 3: Commit**

```bash
git add deploy/postal/README.md deploy/README.md
git commit -m "deploy: Postal self-hosted email runbook + mail-domain vhost"
```

- [ ] **Step 4: [Server] Execute & verify**

Work through `deploy/postal/README.md` then section 8 on the VPS.
Expected: `https://MAIL_DOMAIN` serves the Postal UI over valid TLS; the app restart picks up `POSTAL_URL`/`POSTAL_API_KEY`; a triggered email arrives and mail-tester reports SPF, DKIM, DMARC all pass.

---

### Task 10: End-to-end verification

**Files:**
- Modify: `deploy/README.md` (fill section 9)

**Interfaces:**
- Consumes: everything above.
- Produces: a signed-off go-live checklist (spec §7).

- [ ] **Step 1: Document the E2E checklist**

Append to `deploy/README.md` under section 9:

````markdown
## 9. End-to-end verification (go-live)

- [ ] Each storefront domain (primary + every spare) returns 200 over HTTPS with a valid cert.
- [ ] `curl http://VPS_IP:3000` from off-box is refused (app only reachable via nginx).
- [ ] `add-domain.sh` brings a new domain live without restarting the app.
- [ ] Order → payment webhook → paid order → affiliate commission works.
      With NOWPAYMENTS_API_KEY unset you can exercise the flow via the local
      simulator; the repo smoke scripts also pass:
      `cd /srv/shifa && npx tsx scripts/smoke-pyramid.ts && npx tsx scripts/smoke-nudge.ts`
- [ ] Postal: a triggered email lands; SPF/DKIM/DMARC pass.
- [ ] `backup.sh` produces local + offsite copies; a copied DB opens with `.tables`.
- [ ] `securityheaders.com` shows the app's headers (from next.config.js) intact through nginx.
````

- [ ] **Step 2: Commit**

```bash
git add deploy/README.md
git commit -m "deploy: end-to-end go-live verification checklist"
```

- [ ] **Step 3: [Server] Execute & verify**

Walk the section-9 checklist on the VPS.
Expected: every box checks; the two smoke scripts exit 0; off-box backup present.

---

## Follow-up (separate plan, not in scope here)

**Spec §9 — multi-host correctness in the app code.** Today referral links,
payment callbacks, and email links derive from build-time `NEXT_PUBLIC_SITE_URL`;
with many domains an affiliate on a spare domain would be handed primary-domain
links (dead if the primary is blocked). This is a Next.js code change (read
`x-forwarded-host`, forwarded by nginx in Task 6) with real unit tests, and the
payment webhook callback must target one always-reachable domain. Write it as its
own TDD plan after the box is live. The VPS build above works without it as long
as only one primary domain is advertised at a time.

## Self-Review notes

- **Spec coverage:** §5A nginx multi-domain → Task 6; §5B runtime/systemd → Tasks 3–5; §5C deploy → Task 4 (`deploy.sh`); §5D failover/add-domain → Task 7; §5E Postal → Task 9; §5F hardening/ufw → Task 2; §5G backups/cron → Task 8; §6 artifacts → all tasks; §7 verification → Task 10; §8 optional gateway → documented in Task 7 runbook as optional; §9 follow-up → separate plan section above. No gaps.
- **Placeholder scan:** no TBD/TODO. Operator-supplied values (`PRIMARY_DOMAIN`, `VPS_IP`, etc.) are defined once in the Operator Inputs table and substituted throughout — these are runtime inputs, not plan gaps.
- **Type/name consistency:** the nginx cert is named `shifa` in both Task 6 (issue) and Task 7 (`--expand`); the `server_name` line edited by `add-domain.sh` is the first `:80` block defined in Task 6; the app binds `127.0.0.1:3000` in both Task 5 (systemd) and Task 6 (`upstream shifa_app`); the rclone remote is named `offsite` in both `backup.sh` and the Task 8 runbook.
