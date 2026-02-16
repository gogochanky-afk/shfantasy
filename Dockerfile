# =========================
# 1) Frontend build (Vite)
# =========================
FROM node:20-alpine AS frontend
WORKDIR /frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/. .
RUN pnpm run build

# =========================
# 2) Backend runtime (Express)
# =========================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable

# install backend deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# copy backend source
COPY . .

# copy built frontend into backend folder
COPY --from=frontend /frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
