#!/usr/bin/env bash
# Nightly backup: consistent SQLite snapshot + uploads + env, rotate, push off-box.
# Requires an rclone remote named "offsite" (see deploy/README.md §7).
set -euo pipefail

APP=/srv/shifa
DEST=/var/backups/shifa
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

# Consistent online snapshot (safe while the app is running)
sqlite3 "$APP/data/shifa.db" ".backup '$DEST/shifa-$STAMP.db'"

# Uploads + secrets (env holds ENCRYPTION_KEY / JWT_SECRET)
tar czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP/public" uploads
install -m 600 "$APP/.env.local" "$DEST/env-$STAMP.local"

# Keep the most recent 14 of each locally
for pat in 'shifa-*.db' 'uploads-*.tar.gz' 'env-*.local'; do
  ls -1t "$DEST"/$pat 2>/dev/null | tail -n +15 | xargs -r rm -f
done

# Push the night's three files off-box (use an encrypted remote where possible)
rclone copy "$DEST/shifa-$STAMP.db"       offsite:shifa-backups/
rclone copy "$DEST/uploads-$STAMP.tar.gz" offsite:shifa-backups/
rclone copy "$DEST/env-$STAMP.local"      offsite:shifa-backups/

echo "Backup complete: shifa-$STAMP.db (local + offsite)"
