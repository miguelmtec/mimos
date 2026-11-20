# Cidade Online — real-time server (optional)

**You do not need this to run the online mode.** Today "Cidade Online" runs on Vercel + Neon
(polling, `public/data/online.json` → `"pollingEnabled": true`). This folder is the kit for the
day you want the real-time version: one small VM running `server/index.mjs` (WebSocket rooms,
10 Hz snapshots). Nothing here creates cloud resources by itself.

What you get: `wss://<ip-with-dashes>.sslip.io` with an automatic Let's Encrypt certificate (Caddy),
a systemd service that restarts on failure, and a `/health` endpoint.

## 1. One secret, in two places

Generate a long random value and keep it:

```bash
openssl rand -hex 32
```

- Vercel → Project → Settings → Environment Variables → `ONLINE_TICKET_SECRET` = that value
  (Production and Preview), then redeploy.
- The same value goes into the VM (step 3).

The game's API signs a short-lived ticket with it (`GET /api/online/ticket`); the VM only checks
the signature. The VM never sees session cookies, e-mails or the accounts database.

## 2. Create the VM (AWS Lightsail)

1. Lightsail → Create instance → Linux/Unix → OS only → **Ubuntu 22.04 LTS** → the 1 GB plan.
2. Networking → **create a static IP and attach it** (the hostname is derived from the IP; if the
   IP changes, the name changes).
3. Networking → IPv4 firewall, exactly these rules:

| Application | Protocol | Port | Why |
|---|---|---|---|
| SSH | TCP | 22 | administration (restrict to your IP if you can) |
| HTTP | TCP | 80 | Let's Encrypt validation and the redirect to HTTPS |
| HTTPS | TCP | 443 | `wss://` for the game and `/health` |

Port 8080 (Node) stays closed: Caddy talks to it on localhost. The instance also turns on `ufw`
with the same three ports.

## 3. Install

**Option A — launch script.** Open `cloud-init.yaml`, replace
`CHANGE_ME_TO_THE_SAME_SECRET_AS_VERCEL` with the secret (and `BRANCH` if the server code is not
on `main` yet), and paste the whole file into "Add launch script" when creating the instance.
A launch script cannot be added to an existing instance; for that use option B.

**Option B — by hand, on an existing instance** (also the way to redo a step):

```bash
ssh ubuntu@<static-ip>
sudo -i
# paste the three files from cloud-init.yaml (write_files) into place:
#   /etc/vice-paws-online.env   (chmod 600, with the secret)
#   /etc/vice-paws-online.repo
#   /etc/systemd/system/vice-paws-online.service
#   /usr/local/sbin/vice-paws-setup.sh   (chmod 755)
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
bash /usr/local/sbin/vice-paws-setup.sh
```

If the repository is private, copy the code instead of cloning:
`scp -r server ubuntu@<static-ip>:/tmp/server` then `sudo mkdir -p /opt/vice-paws && sudo mv /tmp/server /opt/vice-paws/server`
and run the setup script (it skips the clone when the folder exists).

The script prints the address, also saved in `/etc/vice-paws-online.url`:

```
Cidade Online server: wss://203-0-113-10.sslip.io   health: https://203-0-113-10.sslip.io/health
```

## 4. Check

```bash
curl https://203-0-113-10.sslip.io/health
# {"ok":true,"players":0,"rooms":0,"uptime":12,"hz":10}
systemctl status vice-paws-online caddy
journalctl -u vice-paws-online -f
```

The first HTTPS request can take ~10 s while Caddy gets the certificate.

## 5. Point the game at it

`public/data/online.json`:

```json
{ "enabled": true, "maxPerRoom": 30, "maxRooms": 20, "tickMs": 1500, "pollingEnabled": true, "wsUrl": "wss://203-0-113-10.sslip.io" }
```

Commit and deploy. The client tries the real-time server first and falls back to polling when it
cannot connect (set `"pollingEnabled": false` to never touch Neon for the online mode). To go back
to polling only, empty `wsUrl`.

## Operating it

- **Update:** `sudo bash /usr/local/sbin/vice-paws-setup.sh` (pulls the branch, reinstalls, restarts; players reconnect by themselves).
- **Turn the mode off for everybody:** `"enabled": false` in `online.json`, or `ONLINE_ENABLED=false` in Vercel (no tickets are issued, so nobody can connect).
- **Reports:** with `DATABASE_URL` set in `/etc/vice-paws-online.env` they go to the Neon table `vp_online_reports` (`source = 'ws'`); otherwise to `/var/lib/vice-paws-online/reports.jsonl`, one JSON per line.
- **Limits** (in `server/lib/protocol.mjs`): 30 cats per room instance, 8 instances per map, 20 rooms, 300 players, 8 connections per address, 20 messages/s per connection, movement capped at 620 px/s.
- **Capacity:** a room of 30 moving cats is about 0.4 Mbit/s out in total; 300 players fit comfortably in 1 GB of RAM and one vCPU.
- **Cost guard:** the server makes no database query except when a player files a report.

## Local run

```bash
cd server && npm install
ONLINE_TICKET_SECRET=dev-secret HOST=127.0.0.1 PORT=8080 node index.mjs
# or the whole game + API + real-time server, in memory:
node tests/helpers/online-dev-server.mjs 8790 --ws
```
