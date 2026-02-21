# /Dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package manifests first
COPY package.json ./
# Copy lockfile if it exists (won't fail if missing in build context)
COPY package-lock.json ./ 

# Install deps:
# - If package-lock.json exists -> npm ci (reproducible)
# - Else -> npm install (still works for MVP)
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy rest of app
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
