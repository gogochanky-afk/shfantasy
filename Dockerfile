# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# ---------- Install deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---------- Build frontend ----------
FROM deps AS build
COPY . .
RUN pnpm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./

EXPOSE 8080
CMD ["node", "index.js"]
