#!/usr/bin/env bash
# Base setup + hardening for a fresh Ubuntu VPS. Run as root.
#
# Two modes, chosen by whether you pass PUBKEY:
#
#   Password / Terminus login (no SSH key) — DEFAULT:
#     APP_USER=shifa bash provision-base.sh
#     Leaves SSH login exactly as your provider set it, so you keep logging in
#     as root with your password. fail2ban guards against brute-force.
#
#   Key-based SSH (only if you actually use SSH keys):
#     APP_USER=shifa PUBKEY="ssh-ed25519 AAAA..." bash provision-base.sh
#     Installs your key for APP_USER and locks SSH to keys only (no password,
#     no root login).
set -euo pipefail

: "${APP_USER:?set APP_USER (e.g. shifa)}"
PUBKEY="${PUBKEY:-}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg

# App-runtime user. It runs the website via systemd; it is NOT a login account.
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi

if [ -n "$PUBKEY" ]; then
  # Key-based SSH: install the key and lock SSH down to keys only.
  usermod -aG sudo "$APP_USER"
  install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
  echo "$PUBKEY" > "/home/$APP_USER/.ssh/authorized_keys"
  chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
  chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl restart ssh || systemctl restart sshd || true
  echo "SSH locked to key-only. Log in as '$APP_USER' with your key from now on."
else
  echo "Password/Terminus mode: SSH login left unchanged (you keep logging in as root)."
  echo "Run the rest of the setup as root; the website runs as the '$APP_USER' user."
fi

# Firewall: SSH, HTTP, HTTPS, SMTP only
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
ufw --force enable

# Brute-force protection (important while password SSH is enabled) + auto updates
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Base setup complete. Firewall status:"
ufw status verbose
if [ -z "$PUBKEY" ]; then
  echo
  echo "TIP: make sure root has a STRONG password (run: passwd) — it is your only login."
fi
