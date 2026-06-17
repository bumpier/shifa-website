# Shifa VPS provisioning runbook

Stand up one fresh Ubuntu 22.04/24.04 LTS VPS that serves the Shifa storefront
under **many domains at once**, so a blocked domain is replaced instantly by an
already-live spare. Email runs on a self-hosted Postal under a separate stable
mail domain. Design: `docs/superpowers/specs/2026-06-17-ubuntu-vps-multi-domain-hosting-design.md`.

Run the numbered sections below **in order** on the VPS, substituting the
Operator Inputs.

---

## Operator inputs (this deployment)

The command blocks below use the token names; substitute these values.

| Token | Meaning | Value |
|---|---|---|
| `PRIMARY_DOMAIN` | Main storefront domain you advertise | `shifalabsasia.com` |
| `SPARE_DOMAINS` | 3–5 spare storefront domains (all kept live) | _none yet — register a few, add each via `add-domain.sh`_ |
| `MAIL_DOMAIN` | Stable Postal admin/sending host (NOT a storefront domain) | `mail.shifaops.com` |
| `SENDING_DOMAIN` | From/envelope domain for emails | `shifaops.com` |
| `ADMIN_EMAIL` | Address on `SENDING_DOMAIN` (certbot + DMARC) | `admin@shifaops.com` |
| `VPS_IP` | Server public IP | `217.60.195.165` |
| `APP_USER` | Non-root Linux user that runs the app | `shifa` |
| `APP_DIR` | Where the app lives | `/srv/shifa` |

> Note: the public DNS A record for `shifalabsasia.com` exposes `217.60.195.165`
> regardless — that's the accepted IP-block risk below. If you later hide the
> origin behind Cloudflare, scrub the IP from any committed files first.

**Architecture invariants** (don't break these):
- ONE app + ONE SQLite DB; every domain is an nginx `server_name` alias.
- App binds `127.0.0.1:3000` only — reachable solely via nginx.
- `ufw` allows 22, 80, 443, 25 — nothing else.
- Migrations via `prisma migrate deploy` (never `migrate dev`) on the server.
- Postal mail domain is never one of the burnable storefront domains.
- Security headers come from the app (`next.config.js`) — don't duplicate in nginx.

> ⚠️ Residual risk (accepted): all domains resolve directly to one IP. Blocking
> the **IP** (not just a domain) takes everything down at once. Putting
> Cloudflare or a front-proxy in front later closes this and needs **no** change
> to this build.

---

## 1. Base hardening & firewall

As **root** on the fresh VPS:

```bash
# Pull this repo's deploy kit (or scp it up); then:
APP_USER=shifa \
PUBKEY="ssh-ed25519 AAAA...your-key..." \
bash deploy/scripts/provision-base.sh
```

Verify: `ufw status verbose` shows 22/80/443/25 ALLOW and `Default: deny (incoming)`.
Open a **second** SSH session as `shifa` over your key before closing root
(password + root login are now disabled).

## 2. Install runtime

As the `shifa` user:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential nginx \
  certbot python3-certbot-nginx sqlite3

node -v    # expect v20.x
nginx -v   # expect nginx/1.2x
```

## 3. Clone app, env, build, migrate

```bash
sudo install -d -o shifa -g shifa /srv
git clone https://github.com/bumpier/shifa-website.git /srv/shifa
cd /srv/shifa

# Prisma CLI reads .env; the app runtime reads .env.local
printf 'DATABASE_URL="file:../data/shifa.db"\n' > .env

cat > .env.local <<'EOF'
DATABASE_URL="file:../data/shifa.db"
NEXT_PUBLIC_SITE_URL=https://PRIMARY_DOMAIN
HELEKET_MERCHANT_ID=
HELEKET_PAYMENT_API_KEY=
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

# Generate secrets and paste them into .env.local:
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # CRON_SECRET
# Also set ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL, SENDING_DOMAIN.
# Leave HELEKET_* / POSTAL_* until their sections.

npm ci
npm run build
npx prisma migrate deploy
npx prisma db seed     # optional: 4 sample products
```

Verify: `ls -l data/shifa.db` shows the DB; the build ends with `✓ Compiled successfully`.

Future code updates: `bash deploy/scripts/deploy.sh` (pull → build → migrate → restart).

## 4. systemd service

```bash
sudo cp /srv/shifa/deploy/systemd/shifa.service /etc/systemd/system/shifa.service
which npm    # confirm it matches the unit's ExecStart path (NodeSource = /usr/bin/npm)
sudo systemctl daemon-reload
sudo systemctl enable --now shifa
sudo systemctl status shifa --no-pager | head -n 6
```

Verify the app answers locally but not publicly:
```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000   # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' http://VPS_IP:3000       # expect refused/timeout
```

## 5. nginx multi-domain + TLS

First point DNS: A records for `PRIMARY_DOMAIN`, `www.PRIMARY_DOMAIN`, and each
spare (apex + www) → `VPS_IP`. Confirm with `dig +short DOMAIN`.

```bash
sudo cp /srv/shifa/deploy/nginx/shifa.conf /etc/nginx/sites-available/shifa.conf
sudo ln -sf /etc/nginx/sites-available/shifa.conf /etc/nginx/sites-enabled/shifa.conf
sudo rm -f /etc/nginx/sites-enabled/default

# Put ALL real storefront domains on the server_name line:
sudoedit /etc/nginx/sites-available/shifa.conf
sudo nginx -t && sudo systemctl reload nginx

# One cert named "shifa" covering every domain (repeat -d per name):
sudo certbot --nginx --cert-name shifa --redirect --non-interactive \
  --agree-tos -m ADMIN_EMAIL \
  -d PRIMARY_DOMAIN -d www.PRIMARY_DOMAIN \
  -d SPARE1 -d www.SPARE1 -d SPARE2 -d www.SPARE2

sudo nginx -t && sudo systemctl reload nginx
systemctl list-timers | grep certbot     # auto-renewal timer present
```

Verify: `curl -sS -o /dev/null -w '%{http_code}\n' https://PRIMARY_DOMAIN` → `200`
(and each spare).

## 6. Add / retire a storefront domain (failover)

Pre-provision spares ahead of need so switching is instant. To add one
(its DNS A records for apex + www must already point at `VPS_IP`):

```bash
sudo ADMIN_EMAIL=admin@shifa-ops.com bash /srv/shifa/deploy/scripts/add-domain.sh newshop.com
curl -sS -o /dev/null -w '%{http_code}\n' https://newshop.com    # expect 200
```

To **retire** a blocked domain: remove its names from the `server_name` line in
`/etc/nginx/sites-available/shifa.conf`, then `sudo nginx -t && sudo systemctl
reload nginx`. A domain blocked at DNS/registrar level is unreachable, so you
can't redirect *from* it — move users to a live spare via out-of-band comms
(Postal email, Telegram) and, optionally, a hard-to-kill "gateway redirector"
domain whose only job is to 302 to the current live storefront (spec §8).

## 7. Backups & cron

```bash
sudo apt-get install -y rclone
rclone config        # create a remote named exactly: offsite (S3 / B2 / etc.)
```

Install cron jobs as the app user (`crontab -e`):
```cron
# Nightly backup at 03:30
30 3 * * * /usr/bin/bash /srv/shifa/deploy/scripts/backup.sh >> /var/log/shifa-backup.log 2>&1
# Daily repurchase-nudge job (reads CRON_SECRET from the app env)
15 9 * * * curl -fsS -H "Authorization: Bearer $(grep -m1 '^CRON_SECRET=' /srv/shifa/.env.local | cut -d= -f2)" https://PRIMARY_DOMAIN/api/cron/nudges
```

Verify: `bash /srv/shifa/deploy/scripts/backup.sh` then
`rclone ls offsite:shifa-backups/` lists today's three files (db, uploads, env).
certbot renewal already runs via its own systemd timer (`systemctl list-timers | grep certbot`).

## 8. Postal email

Full steps in [`postal/README.md`](postal/README.md). Summary: set the
`MAIL_DOMAIN` A record + reverse DNS (PTR), install Postal via the official
installer, add `SENDING_DOMAIN` with SPF/DKIM/DMARC records, create an API
credential, then wire `/srv/shifa/.env.local`:

```
POSTAL_URL=https://MAIL_DOMAIN
POSTAL_API_KEY=<api credential>
EMAIL_FROM="Shifa <noreply@SENDING_DOMAIN>"
```
`sudo systemctl restart shifa`. Front the Postal web UI with TLS on `MAIL_DOMAIN`
using a **separate** cert named `postal` (see `postal/README.md` §G).

Verify: `https://MAIL_DOMAIN` loads the Postal login; a triggered email lands and
scores SPF/DKIM/DMARC = pass on https://www.mail-tester.com.

## 9. End-to-end verification (go-live)

- [ ] Each storefront domain (primary + every spare) returns 200 over HTTPS with a valid cert.
- [ ] `curl http://VPS_IP:3000` from off-box is refused (app only reachable via nginx).
- [ ] `add-domain.sh` brings a new domain live without restarting the app.
- [ ] Order → payment webhook → paid order → affiliate commission works. Smoke scripts pass:
      `cd /srv/shifa && npx tsx scripts/smoke-pyramid.ts && npx tsx scripts/smoke-nudge.ts`
- [ ] Postal: a triggered email lands; SPF/DKIM/DMARC pass.
- [ ] `backup.sh` produces local + offsite copies; a copied DB opens with `sqlite3 <copy> '.tables'`.
- [ ] `securityheaders.com` shows the app's headers intact through nginx.

---

## Multi-domain URL behavior (built in)

The app derives URLs per request via `lib/site-url.ts`, so this works across all
storefront domains automatically:

- **Referral/recruit links and payment success/cancel redirects** use the domain
  the visitor is actually on (`X-Forwarded-Host`, forwarded by nginx in §5). An
  affiliate signed in on any live domain copies a link for *that* domain.
- **Transactional emails and the payment IPN webhook callback** use the stable
  `NEXT_PUBLIC_SITE_URL` — they travel out-of-band and must survive a storefront
  domain being blocked.

> Operational requirement: keep `NEXT_PUBLIC_SITE_URL` pointed at a domain you
> keep alive (your most stable storefront domain, or a dedicated one). If that
> domain is ever blocked, update it in `.env.local` and `systemctl restart shifa`
> so email links and the payment webhook keep resolving.
