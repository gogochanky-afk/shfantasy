# -----------------------------
# SH Fantasy Stable Runtime
# -----------------------------

FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
