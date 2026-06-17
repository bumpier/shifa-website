# Postal email setup — get POSTAL_URL and POSTAL_API_KEY

Goal: a working self-hosted Postal at **https://mail.shifalabsops.com** that sends
mail from **shifalabsops.com**, giving you the two values the app needs:

- **`POSTAL_URL`** = `https://mail.shifalabsops.com` (the base URL of your Postal install)
- **`POSTAL_API_KEY`** = an **API**-type credential you create on a Mail Server in
  Postal's web UI (the app sends via `POST {POSTAL_URL}/api/v1/send/message` with
  header `X-Server-API-Key: <this key>`)

Postal recommends its own dedicated box (≥4 GB RAM, 2 CPU). We're co-locating on
the storefront VPS — fine for low volume, but nginx already owns ports 80/443, so
we front Postal with **nginx** (not Postal's bundled Caddy) to avoid a port clash.

---

## ⏸ A. DNS + reverse DNS (do first)

- A record: `mail.shifalabsops.com` → `217.60.195.165`
- Ask your VPS provider to set **reverse DNS (PTR)**: `217.60.195.165` → `mail.shifalabsops.com`
- Port 25 outbound must be open (it is on this VPS).

## B. Install Docker + MariaDB + the `postal` CLI — as a sudo user

```bash
sudo apt-get install -y git curl jq

# Prereqs script: installs Docker + a MariaDB container (Postal v3).
# NOTE: it sets a default/insecure DB password — fine to start; harden later.
curl https://raw.githubusercontent.com/postalserver/install/main/prerequisites/install-ubuntu.v3.sh | sudo bash

# Install the postal command
sudo git clone https://github.com/postalserver/install /opt/postal/install
sudo ln -s /opt/postal/install/bin/postal /usr/bin/postal
```

## C. Bootstrap, initialize, start Postal

```bash
# Generates /opt/postal/config/{postal.yml, signing.key, Caddyfile}
postal bootstrap mail.shifalabsops.com

# Open the config and set the MariaDB password to match the prereqs script,
# and confirm the web host is mail.shifalabsops.com:
sudo nano /opt/postal/config/postal.yml

postal initialize          # create the database schema
postal make-user           # ⏸ create your admin login (use admin@shifalabsops.com)
postal start               # start the containers
```

## D. Front it with nginx + TLS (we use nginx, not Caddy)

Postal's web runs on `127.0.0.1:5000`. Reverse-proxy `mail.shifalabsops.com` to it and
get a separate cert named `postal` (kept off the storefront `shifa` cert):

```bash
sudo tee /etc/nginx/sites-available/postal.conf >/dev/null <<'NGINX'
server {
    listen 80;
    server_name mail.shifalabsops.com;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/postal.conf /etc/nginx/sites-enabled/postal.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx --cert-name postal -d mail.shifalabsops.com --redirect \
  --non-interactive --agree-tos -m admin@shifalabsops.com
```

> If `https://mail.shifalabsops.com` doesn't load, confirm Postal's web container is
> published on `127.0.0.1:5000` (`sudo docker ps` / check `web_server` in
> `postal.yml`); adjust the `proxy_pass` port to match.

Open **https://mail.shifalabsops.com** and log in with the admin user from step C.

## E. Create org → mail server → sending domain (in the web UI)

1. **Create Organization** (e.g. "Shifa").
2. **Create Mail Server** inside it (e.g. "shifa-prod").
3. **Add Domain** `shifalabsops.com`. Postal shows the exact DNS records to add — set
   them at your DNS host for `shifalabsops.com`:
   - **SPF** — `TXT @` including Postal's host (e.g. `v=spf1 a mx include:mail.shifalabsops.com ~all`)
   - **DKIM** — `TXT <selector>._domainkey` with the public key Postal generates
   - **Return-path** — the `CNAME` Postal shows (bounce/`rp` host)
   - **DMARC** — `TXT _dmarc` → `v=DMARC1; p=quarantine; rua=mailto:admin@shifalabsops.com`
   - (MX records only if you also want to *receive* mail — not needed for send-only)
4. Click **Verify** in Postal until all records are green.

## F. Create the API credential → this is POSTAL_API_KEY

In the Mail Server: **Credentials → New Credential → type "API"**. Name it
(e.g. "website"). Postal shows a key — that string is your **`POSTAL_API_KEY`**.

## G. Wire the app and test

Edit `/srv/shifa/.env.local`:
```
POSTAL_URL=https://mail.shifalabsops.com
POSTAL_API_KEY=<the API credential from step F>
EMAIL_FROM="Shifa <noreply@shifalabsops.com>"
```
```bash
sudo systemctl restart shifa
```

Test deliverability: trigger an email (request a password reset, or send a test
from Postal) to a https://www.mail-tester.com address and confirm **SPF, DKIM,
DMARC all pass**. Fresh-IP reputation is weak at first — warm up volume gradually.
If it stays poor, point Postal at a smarthost relay (Mail Server → SMTP settings).
