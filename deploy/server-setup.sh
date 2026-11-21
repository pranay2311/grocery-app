#!/usr/bin/env bash
# One-time setup of a fresh Oracle Cloud Ubuntu VM for the grocery app.
# Run on the VM:  sudo bash server-setup.sh <domain>
#   <domain> e.g. 130-61-12-34.sslip.io (free name that points to the VM's IP) or your own domain.
# Installs Node 22 and Caddy (automatic HTTPS), opens ports 80/443, creates a service user and systemd service.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash server-setup.sh <domain>}"
APP_USER=grocery
APP_DIR=/opt/grocery

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

echo "==> Swap (helps on 1 GB VMs)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Caddy (web server with automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Firewall: allow web traffic (Oracle images block it by default)"
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport "$port" -j ACCEPT
done
netfilter-persistent save

echo "==> App user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR/releases" /etc/grocery
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
touch /etc/grocery/env && chmod 600 /etc/grocery/env

echo "==> systemd service"
cat > /etc/systemd/system/grocery.service <<UNIT
[Unit]
Description=Grocery Prices web app
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/current
EnvironmentFile=/etc/grocery/env
ExecStart=/usr/bin/node server/src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable grocery

echo "==> Caddy site: https://$DOMAIN -> app on port 5000"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
  encode gzip
  reverse_proxy localhost:5000
}
CADDY
systemctl reload caddy || systemctl restart caddy

echo "Done. Next: put secrets in /etc/grocery/env and deploy the app."
