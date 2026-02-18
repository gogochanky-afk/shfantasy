# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install deps first (better cache)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app
COPY . .

# Make sure public exists (sanity)
RUN test -d /app/public

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
