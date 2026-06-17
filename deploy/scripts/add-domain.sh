#!/usr/bin/env bash
# Add a storefront domain (apex + www) to the shared nginx block and TLS cert.
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
