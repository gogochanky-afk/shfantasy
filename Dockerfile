# ===== STABLE CLOUD RUN DOCKERFILE (FULL) =====
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root package files first (better cache)
COPY package.json pnpm-lock.yaml* ./

# Install deps
RUN pnpm install --frozen-lockfile

# Copy all source
COPY . .

# Build frontend if exists
RUN if [ -d "frontend" ]; then cd frontend && pnpm install --frozen-lockfile && pnpm run build; fi

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
