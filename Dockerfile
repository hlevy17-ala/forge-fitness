FROM node:22-slim AS base
RUN npm install -g pnpm@10.33.0

# ── Install all dependencies (needed for build) ──────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/package.json ./scripts/

RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY . .

# Build frontend (PORT required by vite config but only used for dev server)
RUN PORT=3000 BASE_PATH=/ pnpm --filter workout-tracker build

# Bundle API server (esbuild bundles all JS deps into dist/index.mjs)
RUN pnpm --filter api-server build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Copy bundled server (self-contained — no node_modules needed)
COPY --from=build /app/artifacts/api-server/dist ./dist

# Serve the frontend from dist/public so Express can find it
COPY --from=build /app/artifacts/workout-tracker/dist/public ./dist/public

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
