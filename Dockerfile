# ========= 1) Build frontend =========
FROM node:20-slim AS build
WORKDIR /app

RUN corepack enable

# Install frontend deps
COPY frontend/package.json frontend/pnpm-lock.yaml* ./frontend/
WORKDIR /app/frontend
RUN pnpm install --frozen-lockfile || pnpm install

# Copy frontend source and build
COPY frontend/ ./
RUN pnpm build

# ========= 2) Runtime (backend + static dist) =========
FROM node:20-slim
WORKDIR /app

# Backend deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

# Backend code
COPY index.js ./

# Frontend dist
COPY --from=build /app/frontend/dist ./frontend/dist

ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
