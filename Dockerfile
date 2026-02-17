# ---------- 1) Build Frontend (Vite) ----------
FROM node:18 AS frontend-builder
WORKDIR /app/frontend

# Enable pnpm (because your repo has pnpm-lock.yaml)
RUN corepack enable

# Copy only frontend first for better cache
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of frontend
COPY frontend/ ./
RUN pnpm build

# ---------- 2) Backend Runtime ----------
FROM node:18 AS runner
WORKDIR /app

# Copy backend
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy backend source
COPY backend/ /app/backend/

# Copy frontend build output into backend public folder
# Vite default output = dist
RUN mkdir -p /app/backend/public
COPY --from=frontend-builder /app/frontend/dist /app/backend/public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
