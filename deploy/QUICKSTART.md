# Shifa — full server setup, step by step

Do these in order on a **fresh Ubuntu 22.04 / 24.04 server**. You log in over
SSH (e.g. with **Terminus**) as **root**, using your password — and you run
**everything in this guide as root**. Just copy-paste each numbered block.

Lines marked **⏸ BY HAND** are the only ones you do yourself (set DNS, paste
secrets, click in a web UI). Everything else is paste-and-go.

The website runs under a locked-down **`shifa`** user that the setup creates for
you — it can't be logged into from outside, and you never switch to it.

Values are already filled in for this deployment:

- Website: **shifalabsasia.com** (+ www)
- Email host: **mail.shifaops.com** · sends from **shifaops.com**
- Admin email: **admin@shifaops.com**
- Server IP: **217.60.195.165**

Three parts: **A) the website**, **B) email (Postal)**, **C) backups & day-to-day**.
Part A is enough to go live; email can come after.

---

# PART A — The website

## ⏸ 0. Set DNS first (do this now; it can take up to an hour to take effect)

At your domain registrar / DNS host, add these records:

| Type | Name | Value |
|---|---|---|
| A | `shifalabsasia.com` | `217.60.195.165` |
| A | `www.shifalabsasia.com` | `217.60.195.165` |
| A | `mail.shifaops.com` | `217.60.195.165` |

Then ask your VPS provider to set **reverse DNS (PTR)** for `217.60.195.165` →
`mail.shifaops.com` (needed for email later).

Check it worked: `dig +short shifalabsasia.com` should print `217.60.195.165`.

## 1. Harden the server + create the app user

```bash
apt-get update && apt-get install -y git
git clone https://github.com/bumpier/shifa-website.git /srv/shifa
APP_USER=shifa bash /srv/shifa/deploy/scripts/provision-base.sh
```

This turns on the firewall (ports 22, 80, 443, 25), enables fail2ban + automatic
security updates, and creates the locked-down `shifa` user. Your SSH/Terminus
login is left exactly as it is — you stay logged in as root.

⏸ BY HAND: make sure root has a **strong password** (it's your only way in):
```bash
passwd
```

## 2. Install Node, nginx, and tools

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential nginx certbot python3-certbot-nginx sqlite3
node -v   # expect v20.x
```

## 3. Create the config + secrets

```bash
cd /srv/shifa
printf 'DATABASE_URL="file:../data/shifa.db"\n' > .env

cat > .env.local <<'EOF'
DATABASE_URL="file:../data/shifa.db"
NEXT_PUBLIC_SITE_URL=https://shifalabsasia.com
HELEKET_MERCHANT_ID=04cfc4f1-a74a-4a07-b368-7a2f00f1ed66
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

# Generate three random secrets:
openssl rand -hex 32   # -> JWT_SECRET     (PASTE_SECRET_1)
openssl rand -hex 32   # -> ENCRYPTION_KEY (PASTE_SECRET_2)
openssl rand -hex 32   # -> CRON_SECRET    (PASTE_SECRET_3)
```

⏸ BY HAND: `nano .env.local` and fill in:
- the three `PASTE_SECRET_*` with the values you just generated,
- `ADMIN_PASSWORD` — your admin login password,
- `HELEKET_PAYMENT_API_KEY` — the Payment API key from your Heleket dashboard
  (the merchant ID is already filled in).
- (`POSTAL_URL` / `POSTAL_API_KEY` stay empty until Part B.)

## 4. Set up the database, then build

The build reads the database (the sitemap lists products), so create it **first**:

```bash
cd /srv/shifa
npm ci
npx prisma migrate deploy          # create the database FIRST
npx prisma db seed                 # loads your 12-product catalog (run ONCE — it resets the products table)
npm run build                      # build after the DB exists
chown -R shifa:shifa /srv/shifa    # hand the files to the app user
```

## 5. Run the app as a service

```bash
cp /srv/shifa/deploy/systemd/shifa.service /etc/systemd/system/shifa.service
systemctl daemon-reload
systemctl enable --now shifa
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000   # expect 200
```

## 6. Check DNS has propagated

Both must print `217.60.195.165` before step 7 — certbot fails if **either** is missing:
```bash
dig +short shifalabsasia.com
dig +short www.shifalabsasia.com
```

## 7. Turn on nginx + HTTPS

The website domain is already set in the config; just install it and get a certificate.

```bash
cp /srv/shifa/deploy/nginx/shifa.conf /etc/nginx/sites-available/shifa.conf
ln -sf /etc/nginx/sites-available/shifa.conf /etc/nginx/sites-enabled/shifa.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx --cert-name shifa --redirect --non-interactive \
  --agree-tos -m shifalabs@protonmail.com \
  -d shifalabsasia.com -d www.shifalabsasia.com

systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://shifalabsasia.com   # expect 200
```

✅ **Your website is now live at https://shifalabsasia.com.**

---

# PART B — Email (Postal)

This sets up a self-hosted email server so the site can send order confirmations,
password resets, and affiliate emails. It produces the two values `POSTAL_URL`
and `POSTAL_API_KEY` that you put back into `.env.local`.

## 8. Install Docker, MariaDB, and the Postal tool

```bash
apt-get install -y git curl jq

# Installs Docker + a MariaDB database (uses a default password — fine to start).
curl https://raw.githubusercontent.com/postalserver/install/main/prerequisites/install-ubuntu.v3.sh | bash

# Install the "postal" command
git clone https://github.com/postalserver/install /opt/postal/install
ln -s /opt/postal/install/bin/postal /usr/bin/postal
```

## 9. Start Postal

```bash
postal bootstrap mail.shifaops.com
```
⏸ BY HAND: `nano /opt/postal/config/postal.yml` — set the database password to
match the one from step 8 and confirm the web host is `mail.shifaops.com`. Save.

```bash
postal initialize        # set up the database
postal make-user         # ⏸ create your admin login (use admin@shifaops.com)
postal start             # start it
```

## 10. Put HTTPS in front of the mail server

```bash
tee /etc/nginx/sites-available/postal.conf >/dev/null <<'NGINX'
server {
    listen 80;
    server_name mail.shifaops.com;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/postal.conf /etc/nginx/sites-enabled/postal.conf
nginx -t && systemctl reload nginx
certbot --nginx --cert-name postal -d mail.shifaops.com --redirect \
  --non-interactive --agree-tos -m admin@shifaops.com
```

Open **https://mail.shifaops.com** in a browser and log in with the admin user
from step 9. (If the page doesn't load, run `docker ps` and make sure Postal's
web container is on port 5000; adjust the `proxy_pass` port to match.)

## 11. ⏸ Set up your sending domain (in the Postal web UI)

1. Create an **Organization** (e.g. "Shifa").
2. Inside it, create a **Mail Server** (e.g. "shifa-prod").
3. Click **Domains → Add Domain** and enter `shifaops.com`.
4. Postal shows you exact DNS records — add them at your DNS host for `shifaops.com`:
   - **SPF** (a `TXT` record)
   - **DKIM** (a `TXT` record)
   - **Return-path** (a `CNAME` record)
   - **DMARC** (a `TXT` record): `v=DMARC1; p=quarantine; rua=mailto:admin@shifaops.com`
5. Back in Postal, click **Check / Verify** until every record is green.

## 12. ⏸ Create the API key

In the Mail Server: **Credentials → New Credential → type "API"**, name it
"website", and save. Postal shows a key string — that is your **`POSTAL_API_KEY`**.

## 13. Connect email to the website

⏸ BY HAND: `nano /srv/shifa/.env.local` and set:
```
POSTAL_URL=https://mail.shifaops.com
POSTAL_API_KEY=<the API key from step 12>
```
Then restart and test:
```bash
systemctl restart shifa
```
Trigger a test email (e.g. request a password reset on the site, or send a test
from Postal) to a https://www.mail-tester.com address and check that **SPF, DKIM,
and DMARC all pass**. New servers land in spam at first — send slowly to warm up.

---

# PART C — Backups & day-to-day

## 14. Nightly backups + scheduled jobs

```bash
apt-get install -y rclone
rclone config        # ⏸ create a remote named exactly: offsite (S3 / Backblaze B2 / etc.)
crontab -e           # ⏸ paste the two lines below, then save
```
```cron
30 3 * * * /usr/bin/bash /srv/shifa/deploy/scripts/backup.sh >> /var/log/shifa-backup.log 2>&1
15 9 * * * curl -fsS -H "Authorization: Bearer $(grep -m1 '^CRON_SECRET=' /srv/shifa/.env.local | cut -d= -f2)" https://shifalabsasia.com/api/cron/nudges
```
Test the backup once: `bash /srv/shifa/deploy/scripts/backup.sh`

## 15. Everyday commands

**Add a backup/spare website domain** (point its DNS at `217.60.195.165` first):
```bash
ADMIN_EMAIL=admin@shifaops.com bash /srv/shifa/deploy/scripts/add-domain.sh NEWDOMAIN.com
```

**Deploy a code update:**
```bash
bash /srv/shifa/deploy/scripts/deploy.sh
```

**Restart the app:** `systemctl restart shifa`
**Watch the logs:** `journalctl -u shifa -f`

---

## Quick reference — what each value is

| Value | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://shifalabsasia.com` |
| `HELEKET_MERCHANT_ID` | already filled in (`04cfc4f1-…`) |
| `HELEKET_PAYMENT_API_KEY` | Heleket dashboard → API |
| `POSTAL_URL` | `https://mail.shifaops.com` (after Part B) |
| `POSTAL_API_KEY` | Postal web UI → Mail Server → Credentials → API (step 12) |
| `JWT_SECRET` / `ENCRYPTION_KEY` / `CRON_SECRET` | `openssl rand -hex 32` (step 3) |
| `ADMIN_PASSWORD` | you choose it |
