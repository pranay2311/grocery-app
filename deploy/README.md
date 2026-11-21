# Deploying to an Oracle Cloud VM

One Node service serves the website and the API; Caddy in front provides HTTPS.

## First time
1. Create an Ubuntu VM in Oracle Cloud (Always Free), add the public key `~/.ssh/oracle_grocery.pub`.
2. In the VM's subnet Security List, allow ingress TCP 80 and 443 from `0.0.0.0/0`.
3. Copy and run the setup script (replace the IP):
   ```bash
   scp -i ~/.ssh/oracle_grocery deploy/server-setup.sh ubuntu@<ip>:/tmp/
   ssh -i ~/.ssh/oracle_grocery ubuntu@<ip> "sudo bash /tmp/server-setup.sh <ip-with-dashes>.sslip.io"
   ```
4. Put the secrets in `/etc/grocery/env` on the VM (`NODE_ENV=production`, `PORT=5000`, `MONGODB_URI`, `GEMINI_API_KEY`, a new long random `JWT_SECRET`).
5. In MongoDB Atlas → Network Access, add the VM's public IP.

## Every update
Commit your changes, then from the project folder (Git Bash):
```bash
bash deploy/deploy.sh ubuntu@<ip>
```

## Useful commands on the VM
- Logs: `sudo journalctl -u grocery -f`
- Restart: `sudo systemctl restart grocery`
- Roll back: `sudo ln -sfn /opt/grocery/releases/<older> /opt/grocery/current && sudo systemctl restart grocery`
