---
title: "Have $5? Let's Self-Host a Next.js app"
category: "tutorials"
date: "27-12-2025"
---

# Have $5? Let's Self-Host a Next.js app

Many developers think they MUST use Vercel or other services to host Next.js applications.

The good news is that **all Next.js features work when self-hosting with Docker** – Server Actions, middleware (now called proxy in v16), internationalization, API routes – everything.

In this tutorial, I'll be deploying an app that I just finished it's called In Sentence. An example sentences project,
I made this for people looking to know how a certain word is employed in multiple real examples.
People like poets, essay writers, students, etc

## What We'll Need

- **A VPS** – any $5/month server works (Hetzner, DigitalOcean, etc.)
- **Docker** – to containerize your app
- **Kamal 2.0** – a deployment tool with zero-downtime deploys
- **GitHub Actions** – for CI/CD automation
- **Cloudflare** – optional

## Step 1: Configure Next.js for Standalone Output

In your `next.config.ts`, enable standalone output for an optimized production build:

```js
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    output: "standalone"
}

export default nextConfig
```

## Step 2: Set Up Your Server

Order an Ubuntu VPS and create an SSH connection.

Check if you have an SSH key on your local machine:

```bash
ls ~/.ssh/id_rsa.pub
```

If not, generate one:

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Copy your public key to the server:

```bash
ssh-copy-id root@your-server-ip
```

SSH into your server and update packages:

```bash
ssh root@your-server-ip
apt update && apt upgrade -y
```

_Replace your-server-ip in previous commands with your actual server IP_

## Step 3: Create the Dockerfile

Create a `Dockerfile` at your project root:

```dockerfile
# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine3.20 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine
# to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
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

# Needed for Prisma + static page generation
ARG DATABASE_URL

ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAACHrJ1X6JhJ1vXHQ
ENV NEXT_PUBLIC_SITE_URL=https://insentence.com

# Generate Prisma client
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run Next.js
FROM base AS runner
WORKDIR /app

# Runtime dependency for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
# Uncomment the following line in case you want to disable telemetry during runtime.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

Add `.dockerignore`:

```
node_modules
insentence-lab
Dockerfile
README.md
.dockerignore
.git
.next
.env*
.kamal/secrets*
```

### Build & Run

```bash
# Build (pass DATABASE_URL for static page generation)
docker build --build-arg DATABASE_URL="your_db_url_here" -t sentence-app .

# Run
docker run -p 3000:3000 --env-file .env sentence-app
```

**Note:** The `DATABASE_URL` is only needed during build for static page generation - it's NOT stored in the final image. If you're not using Prisma, remove the `ARG/ENV DATABASE_URL` and `RUN npx prisma generate` lines.

## Step 4: Set Up Kamal

Install Kamal as a Docker alias in your `~/.zshrc`:

```bash
alias kamal='docker run -it --rm -v "${PWD}:/workdir" -v "${HOME}/.ssh:/root/.ssh" -v "/run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock" -e SSH_AUTH_SOCK="/run/host-services/ssh-auth.sock" -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/basecamp/kamal:latest'
```

Initialize Kamal in your project:

```bash
kamal init
```

### Local Secrets Configuration

For local deployments, create a `.env` file at your project root with your secrets:

```
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key
TURNSTILE_SECRET_KEY=your_turnstile_key
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
```

**Important:** Add `.env` to your `.gitignore` to keep secrets out of version control.

Configure `config/deploy.yml`:

```yaml
<% require "dotenv"; Dotenv.load(".env") %>

service: is
image: waelassafdev/sentence-app

env:
  clear:
    DATABASE_URL: <%= ENV['DATABASE_URL'] %>
    OPENAI_API_KEY: <%= ENV['OPENAI_API_KEY'] %>
    TURNSTILE_SECRET_KEY: <%= ENV['TURNSTILE_SECRET_KEY'] %>

servers:
  web:
    hosts:
      - 185.229.251.232

proxy:
  app_port: 3000
  ssl: true
  host: insentence.com
  healthcheck:
    path: /
    interval: 5

registry:
  username: <%= ENV['DOCKER_USERNAME'] %>
  password: <%= ENV['DOCKER_PASSWORD'] %>

builder:
  arch: amd64
  remote: ssh://root@185.229.251.232
  cache:
    type: registry
    options: mode=max
    image: waelassafdev/sentence-app-build-cache
  args:
    DATABASE_URL: <%= ENV['DATABASE_URL'] %>


asset_path: /app/.next
```

> **Important:** The `asset_path` is important. It tells Kamal to combine the assets between deploys to avoid 404 errors. This is especially important for Next.js apps, as the filenames change with every build.

## Step 5: Point Your DNS

Now point your DNS records to your server's IP address.

| Type | Name           | Value   | Proxy Status | TTL        |
|------|----------------|---------|--------------|------------|
| A    | insentence.com | your-server-ip-address | DNS-only     | Automatic  |

## Step 6: Deploy

Now we just need to git commit our changes:

```bash
git add .
git commit -m "First Deploy"
```

And Deploy for the first time:

```bash
kamal setup
```

That command will setup everything for us. Installing Docker, building/pushing the container image, deploying the application, etc.

For subsequent deploys we commit the changes and run:

```bash
kamal deploy
```

But next, we'll set up a CI/CD pipeline to automate our builds. So we just make edits, commit them, push the code to GitHub,
and GitHub Actions will take it from there, and deploy our app to the server.

## Step 7: Set Up CI/CD with GitHub Actions

Once GitHub Actions is configured, you won't need the local `.env` file anymore since all secrets will be managed through GitHub's secrets system.

### Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these Repository secrets:

- `DATABASE_URL`
- `DOCKER_PASSWORD`
- `DOCKER_USERNAME`
- `OPENAI_API_KEY`
- `SSH_PRIVATE_KEY` (your private key content from `~/.ssh/id_rsa`)
- `TURNSTILE_SECRET_KEY`

### Create Deployment Workflow

Create the deployment file:

```bash
mkdir -p .github/workflows && touch .github/workflows/deploy.yml
```

And paste the following in it:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

concurrency:
  group: deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        ruby-version: ["3.2.2"]
        kamal-version: ["2.2.2"]
    env:
      DOCKER_BUILDKIT: 1

    steps:
      - uses: actions/checkout@v4

      - name: Set up Ruby ${{ matrix.ruby-version }}
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: ${{ matrix.ruby-version }}
          bundler-cache: true

      - name: Set up Kamal
        run: gem install kamal -v ${{ matrix.kamal-version }}

      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - uses: docker/setup-buildx-action@v3
      - name: Build and deploy
        run: |
          kamal lock release
          kamal deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          TURNSTILE_SECRET_KEY: ${{ secrets.TURNSTILE_SECRET_KEY }}
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
```

Now every push to `main` triggers a deployment using the secrets stored in GitHub.

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

## Optional: Cloudflare CDN

Once everything works, enable Cloudflare's proxy (orange cloud) on your DNS records to cache static assets at the edge.
This significantly improves load times for users worldwide.

---

That's it. Your Next.js app is now self-hosted with zero-downtime deployments, CI/CD, and full feature support – all for ~$5/month.