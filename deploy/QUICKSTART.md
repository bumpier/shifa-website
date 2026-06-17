# Shifa VPS — step-by-step setup

Run top to bottom on a fresh Ubuntu 22.04/24.04 server.
Copy-paste each numbered block. Lines marked **⏸ BY HAND** are things only you
can do (set DNS, paste secrets, click in a web UI). Values are already filled in
for this deployment:

- Storefront: **shifalabsasia.com** (+ www)
- Mail: **mail.shifaops.com** · email from **shifaops.com**
- Server IP: **217.60.195.165**

---

## ⏸ 0. Set DNS first (do this before step 7; it can take up to an hour)

At your domain registrar / DNS host, add:

| Type | Name | Value |
|---|---|---|
| A | `shifalabsasia.com` | `217.60.195.165` |
| A | `www.shifalabsasia.com` | `217.60.195.165` |
| A | `mail.shifaops.com` | `217.60.195.165` |

And ask your VPS provider to set **reverse DNS (PTR)** for `217.60.195.165` → `mail.shifaops.com`.

Check it resolves: `dig +short shifalabsasia.com` should print `217.60.195.165`.

---

## 1. Harden the server — run as **root**

⏸ BY HAND: replace the `PUBKEY` value with **your** SSH public key
(`cat ~/.ssh/id_ed25519.pub` on your laptop).

```bash
apt-get update && apt-get install -y git
git clone https://github.com/bumpier/shifa-website.git /srv/shifa
APP_USER=shifa \
PUBKEY="ssh-ed25519 AAAA...PASTE-YOUR-PUBLIC-KEY..." \
bash /srv/shifa/deploy/scripts/provision-base.sh
chown -R shifa:shifa /srv/shifa
```

Now **open a new SSH session as `shifa`** (key login). Do everything below as `shifa`.
Root password login is now disabled, so keep this session open until the new one works.

## 2. Install Node, nginx, tools — as **shifa**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential nginx certbot python3-certbot-nginx sqlite3
node -v   # expect v20.x
```

## 3. Create the config + secrets — as **shifa**

```bash
cd /srv/shifa
printf 'DATABASE_URL="file:../data/shifa.db"\n' > .env

cat > .env.local <<'EOF'
DATABASE_URL="file:../data/shifa.db"
NEXT_PUBLIC_SITE_URL=https://shifalabsasia.com
HELEKET_MERCHANT_ID=
HELEKET_PAYMENT_API_KEY=
JWT_SECRET=PASTE_SECRET_1
ADMIN_PASSWORD=PICK_A_STRONG_PASSWORD
AFFILIATE_DEFAULT_COMMISSION=10
AFFILIATE_MIN_PAYOUT_USDT=25
MASTER_OVERRIDE_PERCENT=2.5
MASTER_SALES_THRESHOLD=10
POSTAL_URL=
POSTAL_API_KEY=
EMAIL_FROM="Shifa <noreply@shifaops.com>"
ENCRYPTION_KEY=PASTE_SECRET_2
CRON_SECRET=PASTE_SECRET_3
EOF
chmod 600 .env.local

# Generate three secrets:
openssl rand -hex 32   # -> paste as JWT_SECRET (PASTE_SECRET_1)
openssl rand -hex 32   # -> paste as ENCRYPTION_KEY (PASTE_SECRET_2)
openssl rand -hex 32   # -> paste as CRON_SECRET (PASTE_SECRET_3)
```

⏸ BY HAND: `nano .env.local` and fill in:
- the three `PASTE_SECRET_*` with the generated values,
- `ADMIN_PASSWORD` (your admin login),
- `HELEKET_MERCHANT_ID` + `HELEKET_PAYMENT_API_KEY` from your Heleket dashboard
  (leave `HELEKET_MERCHANT_ID` empty only if you want the local test simulator;
  `HELEKET_PAYMENT_API_KEY` must be non-empty either way).

## 4. Build the app + database — as **shifa**

```bash
cd /srv/shifa
npm ci
npm run build
npx prisma migrate deploy
npx prisma db seed     # optional: 4 sample products
```

## 5. Run the app as a service — as **shifa**

```bash
sudo cp /srv/shifa/deploy/systemd/shifa.service /etc/systemd/system/shifa.service
sudo systemctl daemon-reload
sudo systemctl enable --now shifa
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000   # expect 200
```

## 6. Confirm DNS resolves (from step 0)

```bash
dig +short shifalabsasia.com        # expect 217.60.195.165
```
If it doesn't yet, wait before step 7 (certbot needs it).

## 7. nginx + HTTPS — as **shifa**

The primary domain is already set in the config; just install and get a cert.

```bash
sudo cp /srv/shifa/deploy/nginx/shifa.conf /etc/nginx/sites-available/shifa.conf
sudo ln -sf /etc/nginx/sites-available/shifa.conf /etc/nginx/sites-enabled/shifa.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx --cert-name shifa --redirect --non-interactive \
  --agree-tos -m admin@shifaops.com \
  -d shifalabsasia.com -d www.shifalabsasia.com

sudo systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://shifalabsasia.com   # expect 200
```

Your site is now live at **https://shifalabsasia.com**.

## 8. Backups + scheduled jobs — as **shifa**

```bash
sudo apt-get install -y rclone
rclone config        # ⏸ BY HAND: create a remote named exactly: offsite (S3/B2/etc.)
crontab -e           # ⏸ BY HAND: paste the two lines below
```

```cron
30 3 * * * /usr/bin/bash /srv/shifa/deploy/scripts/backup.sh >> /var/log/shifa-backup.log 2>&1
15 9 * * * curl -fsS -H "Authorization: Bearer $(grep -m1 '^CRON_SECRET=' /srv/shifa/.env.local | cut -d= -f2)" https://shifalabsasia.com/api/cron/nudges
```

Test the backup once: `bash /srv/shifa/deploy/scripts/backup.sh`

## 9. Email (Postal) — when you're ready

Follow [`postal/README.md`](postal/README.md) with these values:
`MAIL_DOMAIN=mail.shifaops.com`, `SENDING_DOMAIN=shifaops.com`, `ADMIN_EMAIL=admin@shifaops.com`.
Then set `POSTAL_URL=https://mail.shifaops.com` and `POSTAL_API_KEY=...` in
`/srv/shifa/.env.local` and run `sudo systemctl restart shifa`.

---

## Everyday operations

**Add a spare/backup domain** (point its DNS at `217.60.195.165` first):
```bash
sudo ADMIN_EMAIL=admin@shifaops.com bash /srv/shifa/deploy/scripts/add-domain.sh NEWDOMAIN.com
```

**Deploy a code update:**
```bash
bash /srv/shifa/deploy/scripts/deploy.sh
```

**Restart the app:** `sudo systemctl restart shifa`
**Check logs:** `journalctl -u shifa -f`
