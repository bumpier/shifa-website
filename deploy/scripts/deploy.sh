#!/usr/bin/env bash
# Update a live deploy: pull, install, build, migrate, restart.
# Run as root: bash /srv/shifa/deploy/scripts/deploy.sh
set -euo pipefail

cd /srv/shifa
# Repo is owned by the 'shifa' app user; allow root's git to operate on it.
git config --global --add safe.directory /srv/shifa 2>/dev/null || true
git pull --ff-only
npm ci
npm run build
npx prisma migrate deploy
# Hand ownership of the freshly built files back to the app user.
chown -R shifa:shifa /srv/shifa
systemctl restart shifa
systemctl status shifa --no-pager | head -n 6
