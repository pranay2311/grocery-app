#!/usr/bin/env bash
# Deploys the last commit to the Oracle VM. Run from the project folder on your PC (Git Bash):
#   bash deploy/deploy.sh ubuntu@<vm-ip>
# Builds the React app locally, uploads code + build, installs server packages and restarts the service.
# Keeps the 3 newest releases on the server so a bad deploy can be rolled back.
set -euo pipefail

HOST="${1:?usage: bash deploy/deploy.sh ubuntu@<vm-ip>}"
KEY="${SSH_KEY:-$HOME/.ssh/oracle_grocery}"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST")
RELEASE=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d)

if [ -n "$(git status --porcelain)" ]; then
  echo "Note: uncommitted changes are NOT deployed (only the last commit is). Commit them first if you want them live."
fi

echo "==> Building the React app"
npm run build --prefix client >/dev/null

echo "==> Packing release $RELEASE"
git archive --format=tar HEAD -o "$TMP/app.tar"
tar -rf "$TMP/app.tar" client/dist
gzip "$TMP/app.tar"

echo "==> Uploading"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new "$TMP/app.tar.gz" "$HOST:/tmp/grocery-$RELEASE.tar.gz"
rm -rf "$TMP"

echo "==> Installing on the server"
"${SSH[@]}" "sudo bash -s" <<REMOTE
set -euo pipefail
DIR=/opt/grocery/releases/$RELEASE
mkdir -p "\$DIR"
tar -xzf /tmp/grocery-$RELEASE.tar.gz -C "\$DIR"
rm /tmp/grocery-$RELEASE.tar.gz
chown -R grocery:grocery "\$DIR"
sudo -u grocery npm ci --omit=dev --prefix "\$DIR/server" --no-audit --no-fund >/dev/null
ln -sfn "\$DIR" /opt/grocery/current
systemctl restart grocery
# keep the 3 newest releases
ls -1dt /opt/grocery/releases/* | tail -n +4 | xargs -r rm -rf
sleep 3
systemctl is-active grocery && curl -fsS localhost:5000/api/health && echo
REMOTE

echo "==> Deployed release $RELEASE"
