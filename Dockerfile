# =========================
# Frontend build (Vite)
# =========================
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Enable pnpm
RUN corepack enable

# Install deps
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Build
COPY frontend/ ./
RUN pnpm run build


# =========================
# Backend runtime (Express)
# =========================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable

# Install backend deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy backend source
COPY . .

# Copy built frontend dist into backend container
COPY --from=frontend /frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
