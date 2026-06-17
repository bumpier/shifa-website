# Ubuntu VPS — multi-domain hosting with domain-block failover

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation plan
**Repo:** shifa-website (Next.js 15 · SQLite/Prisma · self-hosted Postal · crypto payments)

---

## 1. Goal

Stand up a single fresh Ubuntu VPS that serves the Shifa storefront under **many
domains at once**, so that when one domain is taken down we route traffic to a
domain that is already live. Email (Postal) is self-hosted on the same box
(port 25 is already open).

## 2. Threat model — what we are protecting against

The failure we are surviving is **domain blocking / banning**, NOT server or
hardware failure (confirmed with the user). Causes: registrar seizure, DNS/ISP
blocklists, payment-processor abuse flags. The **server stays up**; we just need
spare identical domains we can shift audiences onto.

**Explicitly accepted residual risk:** all domains resolve directly to one VPS
IP (no Cloudflare / no front proxy — user chose plain nginx). If an adversary
blocks the *IP itself* rather than a domain, every domain goes down together.
Mitigation is out of scope now but **additive later**: putting Cloudflare
(orange-cloud) or a rotatable front-proxy VPS in front requires **no change** to
this server build.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Failure protected against | Domain blocking/banning (not hardware) |
| Backend topology | **One** Next.js app + **one** SQLite DB; domains are nginx aliases |
| Brand | Same brand on every domain (true mirrors, shared admin/orders/affiliates) |
| Origin IP | Direct DNS → VPS IP, nginx on the box (no external proxy) |
| Email | Postal self-hosted, co-located on the same VPS |
| Mail domain | A **separate stable domain** (confirmed available), never a burnable storefront domain |
| VPS RAM | ~10 GB (confirmed) — no swap needed |
| Multi-host app fix (§9) | In scope, as a small follow-up after the box is up |

## 4. Architecture

```
                    DNS A records (direct → VPS IP)
   shop1.com ┐
   shop2.com ┼──►  VPS public IP
   shop3.com ┘          │
                        ▼
                 ┌──────────────┐  :80/:443  reverse proxy + TLS (certbot)
                 │    nginx     │  server_name shop1.com shop2.com shop3.com …
                 └──────┬───────┘
                        │ proxy_pass 127.0.0.1:3000 (Host + X-Forwarded-* forwarded)
                 ┌──────▼───────┐
                 │  Next.js app │  systemd service `shifa`, one process, non-root
                 │ (next start) │  bound to 127.0.0.1:3000 only
                 └──────┬───────┘
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
   /data/shifa.db   /public/uploads/    Postal (email, port 25)
   (one SQLite)     (persistent)        separate STABLE mail domain
```

One process, one DB, one admin/affiliate pool. Every domain is live at all
times — "failover" = stop advertising a dead domain, point users at a live one.

## 5. Components

### A. Network & domains
- Per domain: `A` record (apex + `www`) → VPS IP.
- A **single nginx server block** lists all domains in `server_name … ;` and
  `proxy_pass http://127.0.0.1:3000;`, forwarding `Host`, `X-Forwarded-Proto`,
  `X-Forwarded-For`, `X-Real-IP`. Forwarding `Host` is required for §9.
- TLS via **`certbot --nginx`**, one certificate with all domains as SANs,
  auto-renewed by certbot's systemd timer.

### B. App runtime
- **Node 20 LTS**. App run by a **systemd unit `shifa.service`** as a non-root
  user, `ExecStart` = `npm run start` (`next start`), bound to `127.0.0.1:3000`
  (never public — only nginx reaches it). `Restart=always`.
- Secrets loaded via systemd `EnvironmentFile=` pointing at the app's
  `.env.local`; Prisma CLI reads `.env` (`DATABASE_URL="file:../data/shifa.db"`).
- Migrations applied with **`prisma migrate deploy`** (never `migrate dev` on
  the server).
- RAM: **~10 GB confirmed** — comfortable for `next build` + co-located Postal;
  no swap or build-locally workaround needed.

### C. Deploy flow
- A `deploy.sh` on the server: `git pull` → `npm ci` → `npm run build` →
  `prisma migrate deploy` → `systemctl restart shifa`. Run manually or from cron
  (matches the project's existing cron-deploy convention).

### D. Failover workflow (the actual objective)
- **Pre-provision a pool** of 3–5 spare domains *already* wired into DNS +
  nginx + the shared cert, all serving right now. Switching is instant because
  nothing has to be spun up.
- `add-domain.sh <domain>`: append to `server_name`, run certbot to extend the
  cert, `nginx -t && systemctl reload nginx`. Retiring a domain = drop it from
  the rotation/advertising.
- **Honest limitation:** a domain blocked at DNS/registrar level is unreachable,
  so you cannot 302 *from* it. Real failover therefore relies on:
  1. an out-of-band way to reach users/affiliates (email via Postal, Telegram, etc.), and
  2. (optional, §8) a hard-to-kill "gateway redirector" on a separate stable
     domain whose only job is to 302 to the current live storefront domain.

### E. Email — Postal (port 25)
- Postal co-located on the box (Docker + MariaDB + RabbitMQ via the official
  installer). Web UI + SMTP fronted by nginx on a **separate, stable mail
  domain** (e.g. `mail.opsdomain.com`) that is **never** one of the burnable
  storefront domains — so a blocked storefront domain cannot poison email.
- Required DNS / host config: **PTR/rDNS** (requested from the VPS provider for
  the IP → mail hostname), **SPF**, **DKIM**, **DMARC**, return-path. App wiring
  via `POSTAL_URL` + `POSTAL_API_KEY` + `EMAIL_FROM` in `.env.local`.
- ⚠️ Fresh-IP deliverability is poor at first (warm-up needed). Fallback if
  self-hosting underdelivers: point Postal at a smarthost relay. Setting
  `EMAIL_FROM`'s domain to the stable mail domain keeps reputation off the
  storefront domains.

### F. Security hardening
- `ufw`: allow **22, 80, 443, 25** (plus 587/465 if Postal needs them); deny the
  rest by default.
- SSH **key-only**; root login + password auth disabled. **fail2ban** on SSH.
  **unattended-upgrades** for security patches.
- App listens on **127.0.0.1 only**; SQLite DB (`/data/`) and uploads
  (`/public/uploads/`) are gitignored and live outside any web-served path
  (Next does not serve `/data`). Optional nginx IP-allowlist on `/admin`.

### G. Backups & cron
- Nightly **`sqlite3 /data/shifa.db ".backup" …`** (consistent online backup),
  rotated and **copied off-box**.
- Back up **`.env.local`** to a secure location — it holds `ENCRYPTION_KEY`,
  without which AES-256-GCM-encrypted affiliate wallet addresses are
  unrecoverable, plus `JWT_SECRET`, payment, and Postal secrets.
- `/public/uploads/` included in the off-box backup (product images, gitignored).
- Cron: existing nudges job
  (`curl -H "Authorization: Bearer $CRON_SECRET" https://<primary-domain>/api/cron/nudges`),
  the backup job; certbot renewal via its own systemd timer.

## 6. Artifacts to produce (implementation)

1. `nginx` site config template (multi-domain server block + proxy settings).
2. `shifa.service` systemd unit.
3. `deploy.sh` (pull → build → migrate → restart).
4. `add-domain.sh <domain>` (server_name + certbot + reload).
5. Backup script + cron entries (DB `.backup`, off-box copy, rotation).
6. `ufw` / fail2ban / unattended-upgrades / SSH-hardening steps.
7. Postal install + DNS (SPF/DKIM/DMARC/PTR) runbook.
8. A top-to-bottom **provisioning runbook** stitching the above in order.

## 7. Verification

- nginx serves each configured domain over HTTPS with a valid cert (all SANs).
- App reachable **only** via nginx (`curl` to `:3000` from outside is refused).
- A test order → webhook → paid → commission still works (existing dev
  simulator / smoke scripts: `scripts/smoke-nudge.ts`, `scripts/smoke-pyramid.ts`).
- Adding a new domain via `add-domain.sh` brings it live without restarting the app.
- Postal sends a test email that lands (check headers: SPF/DKIM/DMARC pass).
- DB nightly backup file is produced and lands off-box.

## 8. Optional enhancements (not blocking)

- **Gateway redirector:** a minimal always-on app on a separate, hard-to-kill
  domain that 302s to the current live storefront — the single thing you defend
  hardest and the link you advertise.
- **Cloudflare / front proxy** in front of nginx to hide the origin IP (closes
  the §2 residual risk). Additive; no change to this server build.

## 9. Follow-up app change — makes failover *correct* (in scope, after the box is up)

Today referral links, payment callbacks, and email links derive from a single
build-time `NEXT_PUBLIC_SITE_URL`. With many domains, an affiliate on
`shop2.com` would be handed `shop1.com` links — dead the moment `shop1` is
blocked. Change: derive those URLs from the **request host**
(`x-forwarded-host`, forwarded by nginx). The payment **webhook callback** must
target one always-reachable domain regardless of which storefront the customer
used. Tracked as a separate small task; the VPS build works without it if only
one primary domain is advertised at a time.

## 10. Out of scope

- Hardware/availability failover (would need a second server; contradicts the
  single-box requirement).
- Multi-brand / per-domain isolated databases (rejected — shared backend chosen).
- Kubernetes / containerising the Next.js app (unnecessary for one box).
