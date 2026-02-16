# -------- 1) deps stage --------
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm i -g pnpm

# Copy only manifest files first (better layer caching)
COPY package.json ./
# Optional lockfiles (copy if they exist in repo)
# (If your repo has pnpm-lock.yaml, keep it. If not, this line is harmless only if file exists.)
# Because Docker COPY fails if file missing, we avoid copying lockfile directly here.

# Install deps (no frozen lock to avoid ERR_PNPM_NO_LOCKFILE)
RUN pnpm install

# -------- 2) build stage (optional frontend build) --------
FROM node:20-alpine AS build
WORKDIR /app
RUN npm i -g pnpm

# Bring node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY . .

# If you have a build script, keep this.
# If you DON'T have frontend build, you can remove this line safely.
RUN pnpm run build || echo "No build script / build skipped"

# -------- 3) runtime stage --------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy production files
COPY --from=build /app ./

# Cloud Run listens on 8080
EXPOSE 8080

# Start server
CMD ["node", "index.js"]
