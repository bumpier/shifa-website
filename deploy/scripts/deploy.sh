#!/usr/bin/env bash
# Update a live deploy: pull, install, build, migrate, restart.
# Run as the app user from anywhere: bash /srv/shifa/deploy/scripts/deploy.sh
set -euo pipefail

cd /srv/shifa
git pull --ff-only
npm ci
npm run build
npx prisma migrate deploy
sudo systemctl restart shifa
sudo systemctl status shifa --no-pager | head -n 6
