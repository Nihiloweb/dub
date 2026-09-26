# syntax=docker/dockerfile:1

# Multi-stage build for Dub (apps/web) monorepo — Coolify / self-hosted.
# Stages: base → deps → builder → runner

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages ./packages
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/turbo.json ./
COPY . .

# Build-time env (NEXT_PUBLIC_* are inlined into the client bundle)
ARG DATABASE_URL=mysql://root:build@db:3306/dub
ARG NEXT_PUBLIC_APP_DOMAIN
ARG NEXT_PUBLIC_APP_SHORT_DOMAIN
ARG NEXT_PUBLIC_PARTNERS_DOMAIN
ENV DATABASE_URL=$DATABASE_URL \
  NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN \
  NEXT_PUBLIC_APP_SHORT_DOMAIN=$NEXT_PUBLIC_APP_SHORT_DOMAIN \
  NEXT_PUBLIC_PARTNERS_DOMAIN=$NEXT_PUBLIC_PARTNERS_DOMAIN \
  NODE_OPTIONS=--max-old-space-size=6144 \
  NEXT_TELEMETRY_DISABLED=1

# Dummy placeholders so page-data collection does not throw on missing optional SDKs
ENV STRIPE_SECRET_KEY=sk_unset \
  QSTASH_TOKEN=unset \
  UPSTASH_VECTOR_REST_URL=https://example-vector.upstash.io \
  UPSTASH_VECTOR_REST_TOKEN=unset \
  TINYBIRD_API_KEY= \
  TINYBIRD_API_URL=https://api.tinybird.co \
  PLANETSCALE_DATABASE_URL=http://root:build@planetscale-proxy:3900/dub \
  UPSTASH_REDIS_REST_URL=http://127.0.0.1:8079 \
  UPSTASH_REDIS_REST_TOKEN=build \
  NEXTAUTH_SECRET=build-secret-not-for-production \
  NEXTAUTH_URL=http://localhost:3000 \
  ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

RUN --mount=type=cache,target=/app/apps/web/.next/cache \
  --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm -r --workspace-concurrency=1 --filter "./packages/**" build \
  && pnpm --filter web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
  PORT=3000 \
  NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
