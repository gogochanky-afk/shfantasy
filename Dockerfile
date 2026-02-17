# ---------- 1) Build Frontend ----------
FROM node:18 AS frontend-builder
WORKDIR /app/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build


# ---------- 2) Backend Runtime ----------
FROM node:18
WORKDIR /app

# copy backend (which is root in your repo)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# copy frontend build into public
RUN mkdir -p public
COPY --from=frontend-builder /app/frontend/dist ./public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
