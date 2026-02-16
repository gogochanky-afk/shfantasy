# =========================
# 1) Frontend build (Vite)
# =========================
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Ensure pnpm exists
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Copy manifest + lockfile (lockfile optional via *)
COPY frontend/package.json ./
COPY frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy rest + build
COPY frontend/. .
RUN pnpm run build

# =========================
# 2) Backend runtime (Express)
# =========================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Backend deps (lockfile optional via *)
COPY package.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# Backend source
COPY . .

# Built frontend dist -> backend path
COPY --from=frontend /frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
