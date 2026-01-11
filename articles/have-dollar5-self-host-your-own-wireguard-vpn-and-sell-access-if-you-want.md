---
title: "Have $5? Self-Host Your Own WireGuard VPN (And Sell Access If You Want)"
category: "tutorials"
date: "11-01-2026"
---

# Have $5? Self-Host Your Own WireGuard VPN (And Sell Access If You Want)

> **Note:** This guide can be used standalone or alongside a future video where I walk through the setup step by step. Bookmark it — it’s practical, cheap, and scalable.

If you think running a private VPN requires expensive infrastructure or complex setups, think again.

With just **$5/month**, you can deploy your own **WireGuard VPN server**, fully under your control — no subscriptions, no logs, no middlemen.

In this tutorial, you’ll learn how to:
- Deploy WireGuard on a low-cost VPS
- Generate and manage client access
- Revoke users instantly
- Optionally **sell VPN access** to others in a clean, controlled way

This setup is perfect for developers, privacy-conscious users, remote workers, or anyone who wants full ownership of their network traffic.

## What You’ll Need

- A $5 VPS (Hetzner, DigitalOcean, etc.)
- Ubuntu 22.04+
- Root SSH access
- WireGuard
- (Optional) WireGuard GUI on desktop/mobile

---

## Step 1: Install WireGuard on the Server

SSH into your server:

```bash
ssh root@your-server-ip
````

Install WireGuard:

```bash
apt update && apt install -y wireguard
```

Enable IP forwarding (required):

```bash
sysctl net.ipv4.ip_forward=1
```

Make it permanent:

```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
```

Verify:

```bash
sysctl net.ipv4.ip_forward
# net.ipv4.ip_forward = 1
```

---

## Step 2: Server Keys

Generate server keys:

```bash
cd /etc/wireguard
wg genkey | tee server.key | wg pubkey > server.pub
chmod 600 server.key
```

---

## Step 3: Server Config (`wg0.conf`)

Create `/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = <contents of server.key>

PostUp = iptables -t nat -A POSTROUTING -o eno1 -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -o eno1 -j MASQUERADE
```

### What does `10.10.0.1/24` mean?

* `10.10.0.1` → your VPN server’s **internal VPN IP**
* `/24` → allows `10.10.0.2` → `10.10.0.254` for clients
* This is **private**, internal, and **not tied to your public IP**
* You chose it — it’s not special or global

---

## Step 4: Create Clients (One-Liner)

Each device **must have its own config**.
Never reuse the same client config for multiple devices.

Create **20 clients at once**:

```bash
for i in $(seq 1 20); do
  wg genkey | tee /etc/wireguard/client$i.key | wg pubkey > /etc/wireguard/client$i.pub
done
```

---

## Step 5: Add Clients to Server

Example for `client1`:

```ini
[Peer]
PublicKey = <client1.pub>
AllowedIPs = 10.10.0.2/32
```

Each client gets **one IP**:

| Client  | IP        |
| ------- | --------- |
| client1 | 10.10.0.2 |
| client2 | 10.10.0.3 |
| client3 | 10.10.0.4 |
| ...     | ...       |

---

## Step 6: Client Config (`client1.conf`)

```ini
[Interface]
PrivateKey = <client1.key>
Address = 10.10.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <server.pub>
Endpoint = your-server-ip:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

This routes **all traffic** through your VPN.

---

## Step 7: Start WireGuard

```bash
wg-quick up wg0
```

Check status:

```bash
wg
```

---

## Step 8: Transfer Client Config to Your Mac

```bash
rsync -avz -e ssh root@your-server-ip:/etc/wireguard/client1.conf .
```

---

## Step 9: Connect Using WireGuard GUI

* Install **WireGuard**

  * macOS
  * Windows
  * iOS
  * Android
* Click **Add Tunnel**
* Import `client1.conf`
* Toggle **ON**

You’re now routing traffic through your own server.

---

## Cutting Off Non-Paying Users

Yes — it’s instant.

Each user is just a `[Peer]` on the server.

### Option 1: Live (no restart)

```bash
wg set wg0 peer <client_public_key> remove
```

### Option 2: Config-based

Delete their `[Peer]` block from `wg0.conf` and reload:

```bash
wg-quick down wg0 && wg-quick up wg0
```

No peer = no tunnel = no internet.

---

## Can One Client Config Be Shared?

**No. Don’t do it.**

* WireGuard identifies clients by **public key**
* Sharing configs causes:

  * IP conflicts
  * Broken routing
  * Random disconnects

**One device = one config. Always.**

---

## Why This Setup Is Powerful

* No subscriptions
* No third-party VPN logs
* Full control
* Instantly revoke access
* Scales cleanly
* Costs ~$5/month

This is how VPNs actually work — everything else is marketing.

---

## Final Notes

* Back up `/etc/wireguard`
* Never reuse client configs
* Rotate keys if compromised
* You now own the entire stack

That’s it.

You’re running your own VPN.

```

---

If you want next:
- **Auto-generate + email configs**
- **Usage monitoring**
- **Bandwidth caps**
- **Stripe + auto-disable**

Just say the word.
```

