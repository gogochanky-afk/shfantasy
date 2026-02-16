# ===== SHFANTASY STABLE CLOUD RUN DOCKERFILE (FULL) =====
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json ./
# Copy lockfile only if it exists (won't fail if missing)
COPY pnpm-lock.yaml* ./

# Install deps (DO NOT use --frozen-lockfile because lockfile may not exist)
RUN pnpm install

# Copy all source
COPY . .

# Build frontend if exists
RUN if [ -d "frontend" ]; then \
      cd frontend && pnpm install && pnpm run build && cd .. ; \
    fi

ENV PORT=8080
EXPOSE 8080

# Start server (index.js at repo root)
CMD ["node", "index.js"]
