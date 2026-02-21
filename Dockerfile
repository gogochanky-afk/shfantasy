# /Dockerfile
FROM node:20-slim

WORKDIR /app

# 先 copy package 檔，最大化 cache
COPY package.json ./
COPY package-lock.json ./

# 保底：有 lockfile 用 npm ci，冇就 npm install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# copy 其餘程式碼
COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "index.js"]
