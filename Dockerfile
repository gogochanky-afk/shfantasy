# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable

# ---------- Deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ---------- Build (optional) ----------
FROM deps AS build
COPY . .
# 如果你有前端 build（例如 Vite/React）就會有 dist/ 或 build/
# 冇就唔會 fail（因為下面用 || true）
RUN pnpm run build || true

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# corepack for pnpm runtime (optional)
RUN corepack enable

# Copy node_modules + source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./

EXPOSE 8080
CMD ["node", "index.js"]
