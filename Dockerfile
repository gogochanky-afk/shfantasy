# ===== SHFantasy Stable Cloud Run Dockerfile =====
FROM node:20-alpine

WORKDIR /app

# 1) install pnpm
RUN npm install -g pnpm

# 2) install root deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 3) copy all source
COPY . .

# 4) build frontend if exists
RUN if [ -d "frontend" ]; then cd frontend && pnpm install --frozen-lockfile && pnpm build; fi

# 5) Cloud Run uses PORT env
ENV PORT=8080
EXPOSE 8080

# 6) start server
CMD ["node", "index.js"]
