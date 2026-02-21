# /Dockerfile
FROM node:20-slim

WORKDIR /app

# 先 copy package + lockfile，確保 npm ci 一定搵到 package-lock.json
COPY package.json package-lock.json ./

# 用 npm ci 做 deterministic install（production only）
RUN npm ci --omit=dev

# 再 copy 其餘檔案
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
