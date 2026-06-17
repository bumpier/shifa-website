#!/usr/bin/env bash
# Base hardening for a fresh Ubuntu VPS. Run as root.
# Usage: APP_USER=shifa PUBKEY="ssh-ed25519 AAAA..." bash provision-base.sh
set -euo pipefail

: "${APP_USER:?set APP_USER (e.g. shifa)}"
: "${PUBKEY:?set PUBKEY to your SSH public key}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades curl ca-certificates gnupg

# Non-root sudo user with your SSH key
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
  usermod -aG sudo "$APP_USER"
fi
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
echo "$PUBKEY" > "/home/$APP_USER/.ssh/authorized_keys"
chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"

# SSH: key-only, no root login
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd

# Firewall: SSH, HTTP, HTTPS, SMTP only
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
ufw --force enable

# fail2ban on SSH (defaults are fine) + enable auto security updates
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Base hardening complete. ufw status:"
ufw status verbose
echo
echo "IMPORTANT: open a new SSH session as '$APP_USER' over your key BEFORE"
echo "closing this root session — root login and password auth are now disabled."
