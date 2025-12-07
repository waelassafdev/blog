---
title: "Have $5? Let's Self-Host a Next.js app"
category: "tutorials"
date: "08-12-2024"
---

# Have $5? Let's Self-Host a Next.js app

Got $5 and a Next.js app you want to deploy? Let's skip Vercel and host it yourself.

Many developers struggle with self-hosting Next.js applications. The good news is that **all Next.js features work when self-hosting with Docker** — Server Actions, middleware (now called proxy in v16), internationalization, API routes — everything.

## What You'll Need

- **Docker** — to containerize your app
- **Kamal 2.0** — a deployment tool with zero-downtime deploys
- **A VPS** — any $5/month server works (Hetzner, DigitalOcean, etc.)
- **Cloudflare** — optional, but great for CDN and DNS
- **GitHub Actions** — for CI/CD automation

## Step 1: Configure Next.js for Standalone Output

In your `next.config.ts`, enable standalone output for an optimized production build:

```js
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

## Step 2: Set Up Your Server

Order an Ubuntu VPS and create an SSH connection.

Check if you have an SSH key:

```bash
ls ~/.ssh/id_rsa.pub
```

If not, generate one:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Copy your public key to the server:

```bash
cat ~/.ssh/id_rsa.pub | ssh root@your-server-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

SSH into your server and update packages:

```bash
ssh root@your-server-ip
apt update && apt upgrade -y
```

## Step 3: Create the Dockerfile

Create a `Dockerfile` at your project root. This one works with npm, pnpm, or yarn:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

Add a `.dockerignore`:

```
node_modules
.next
.git
*.md
```

Test locally:

```bash
docker build -t my-nextjs-app .
docker run -p 3000:3000 --env-file .env my-nextjs-app
```

Visit `http://localhost:3000` to verify it works.

## Step 4: Set Up Kamal

Install Kamal as a Docker alias in your `~/.zshrc`:

```bash
alias kamal='docker run -it --rm -v "${PWD}:/workdir" -v "${HOME}/.ssh:/root/.ssh" -v "/run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock" -e SSH_AUTH_SOCK="/run/host-services/ssh-auth.sock" -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/basecamp/kamal:latest'
```

Initialize Kamal in your project:

```bash
kamal init
```

Add your secrets to `.kamal/secrets`:

```
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
```

Configure `config/deploy.yml`:

```yaml
service: my-app
image: your-dockerhub-username/my-app

servers:
  web:
    hosts:
      - your-server-ip
    options:
      publish:
        - "3000:3000"

proxy:
  ssl: true
  host: yourdomain.com

registry:
  username: your-dockerhub-username
  password:
    - DOCKER_PASSWORD

builder:
  arch: amd64

asset_path: /app/.next/static
```

> **Important:** The `asset_path` option tells Kamal to preserve assets between deploys, preventing 404 errors on hashed filenames.

## Step 5: Point Your DNS

Add an A record in Cloudflare (or your DNS provider):

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | @ | your-server-ip | DNS only |
| A | www | your-server-ip | DNS only |

## Step 6: Deploy

Commit your changes:

```bash
git add .
git commit -m "Add Docker and Kamal config"
```

Deploy for the first time:

```bash
kamal setup
```

For subsequent deploys:

```bash
kamal deploy
```

## Step 7: Set Up CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Install SSH key
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Deploy with Kamal
        env:
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        run: |
          echo "DOCKER_USERNAME=$DOCKER_USERNAME" > .kamal/secrets
          echo "DOCKER_PASSWORD=$DOCKER_PASSWORD" >> .kamal/secrets
          
          docker run --rm \
            -v "${PWD}:/workdir" \
            -v "${SSH_AUTH_SOCK}:/ssh-agent" \
            -e SSH_AUTH_SOCK=/ssh-agent \
            ghcr.io/basecamp/kamal:latest deploy
```

Add these secrets to your GitHub repo (Settings → Secrets → Actions):
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`
- `SSH_PRIVATE_KEY` (your private key content)

Now every push to `main` triggers a deployment.

## Debugging

View running containers:

```bash
docker ps
```

Check logs:

```bash
docker logs <container-id>
```

Monitor resources:

```bash
docker stats
```

## Running Multiple Apps on One Server

You can't run multiple apps on port 3000. Use different ports:

```yaml
# Site 1 - port 3000
options:
  publish:
    - "3000:3000"

# Site 2 - port 3001
options:
  publish:
    - "3001:3000"

# Site 3 - port 3002
options:
  publish:
    - "3002:3000"
```

Then configure your reverse proxy (Nginx, Caddy, etc.) to route each domain to its port.

## Optional: Cloudflare CDN

Once everything works, enable Cloudflare's proxy (orange cloud) on your DNS records to cache static assets at the edge. This significantly improves load times for users worldwide.

---

That's it. Your Next.js app is now self-hosted with zero-downtime deployments, CI/CD, and full feature support — all for about $5/month.
