# -------------------------
# 1) Build frontend (Vite)
# -------------------------
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Install deps
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

# Build
COPY frontend/ ./
RUN npm run build


# -------------------------
# 2) Backend runtime (Express)
# -------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Install backend deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy backend source
COPY . .

# Copy built frontend dist -> /app/frontend/dist
COPY --from=frontend /frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
