# /Dockerfile

# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# If your project has a build step, keep this.
# If you DON'T have build, you can remove this line.
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code + built assets
COPY --from=build /app /app

# Sanity: make sure public exists (and ideally has index.html)
RUN test -d /app/public
# Optional extra sanity check:
# RUN test -f /app/public/index.html

EXPOSE 8080
CMD ["node", "index.js"]
