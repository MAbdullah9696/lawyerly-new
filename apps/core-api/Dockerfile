# Build from REPO ROOT (monorepo — lockfile lives at root):
#   docker build -t lawyerly-core-api -f apps/core-api/Dockerfile .

# ─── Stage 1: Build (install all deps, generate Prisma client, compile TS) ───
FROM node:20-slim AS builder
WORKDIR /app

# OpenSSL is required by the Prisma query engine on Debian/slim images.
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Copy root workspace manifest + lockfile first (best-practice cache layer).
COPY package.json package-lock.json ./
# npm workspace graph requires all workspace package.json files to be present.
COPY apps/core-api/package.json  ./apps/core-api/
COPY apps/web/package.json       ./apps/web/
COPY apps/admin-web/package.json ./apps/admin-web/
COPY packages/shared/package.json ./packages/shared/

# Single npm ci — the only install in the entire build.
# The runtime stage copies node_modules from here and prunes devDeps,
# avoiding a second parallel npm ci that would race on esbuild's postinstall.
RUN npm ci

# Copy Prisma schema + source.
COPY apps/core-api/prisma    ./apps/core-api/prisma/
COPY apps/core-api/tsconfig.json ./apps/core-api/
COPY apps/core-api/src       ./apps/core-api/src/

WORKDIR /app/apps/core-api

# `npm run build` = `prisma generate && tsc -p tsconfig.json`
# prisma generate runs here; the binary matches this OS/arch
# (node:20-slim = Debian Bookworm = debian-openssl-3.0.x).
RUN npm run build

# ─── Stage 2: Slim runtime image ─────────────────────────────────────────────
# Every instruction here uses COPY --from=builder, so BuildKit cannot start
# this stage until the builder stage completes — guaranteed sequential execution,
# no parallel npm ci race on esbuild's postinstall binary.
FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy workspace manifests from builder (not from build context) to keep
# this stage fully dependent on builder and allow npm prune to work correctly.
COPY --from=builder /app/package.json          ./
COPY --from=builder /app/package-lock.json     ./
COPY --from=builder /app/apps/core-api/package.json  ./apps/core-api/
COPY --from=builder /app/apps/web/package.json       ./apps/web/
COPY --from=builder /app/apps/admin-web/package.json ./apps/admin-web/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Copy full node_modules from builder, then prune devDeps in-place.
# This is cheaper than a second npm ci and avoids the parallel-install race.
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev

# Compiled application output.
COPY --from=builder /app/apps/core-api/dist ./dist

# Prisma schema (needed if `prisma migrate deploy` is run as a pre-deploy step).
COPY --from=builder /app/apps/core-api/prisma ./prisma

# The generated Prisma client (query engine binary) already lives in
# node_modules/.prisma after the builder ran `prisma generate`. npm prune
# does not touch node_modules/.prisma (it is not a listed package), so it
# survives the prune step above — no extra COPY needed here.

COPY --from=builder /app/apps/core-api/package.json ./package.json

# NOTE: DO NOT run `prisma migrate deploy` in this CMD.
# Running migrations on every container start is a footgun: it serializes
# startup, breaks rolling restarts, and is unsafe during scale-out.
# Run migrations once as a pre-deploy step:
#
#   npx prisma migrate deploy
#
# On Koyeb, wire this as a "Release Command" in service settings, or run
# manually via `koyeb exec` against a one-off container before traffic shifts.

EXPOSE 4000
CMD ["node", "dist/index.js"]
