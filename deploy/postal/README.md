# Postal email setup (self-hosted)

Postal sends from **SENDING_DOMAIN** via **MAIL_DOMAIN**, kept separate from the
burnable storefront domains so a blocked storefront never poisons mail reputation.

## A. Prerequisites
- DNS A record: `MAIL_DOMAIN` → `VPS_IP`.
- Reverse DNS (PTR): ask the VPS provider to set `VPS_IP` → `MAIL_DOMAIN`.
- Docker:
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
- **SPF**   `TXT @  "v=spf1 a mx include:MAIL_DOMAIN ~all"`
- **DKIM**  `TXT <selector>._domainkey  "v=DKIM1; t=s; h=sha256; p=<key from Postal>"`
- **DMARC** `TXT _dmarc  "v=DMARC1; p=quarantine; rua=mailto:ADMIN_EMAIL"`
- **Return-Path** `CNAME` as printed by Postal (custom return-path / bounces).

## D. Create the mail server + API credential
In the Postal web UI: create an Organization → Mail Server → add `SENDING_DOMAIN`
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
Trigger a real email (affiliate invite / password reset, or a Postal test send) to
a https://www.mail-tester.com address and confirm **SPF, DKIM, and DMARC all PASS**.
Fresh-IP reputation is weak at first — warm up volume gradually. If deliverability
stays poor, point Postal at a smarthost relay (Postal → Mail Server → SMTP settings).

## G. Front the web UI with TLS on MAIL_DOMAIN
Postal ships a web server on `127.0.0.1:5000` by default. Reverse-proxy it with a
**separate** cert named `postal` (kept off the storefront `shifa` cert):

```bash
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

Verify: `https://MAIL_DOMAIN` serves the Postal login over valid TLS.
