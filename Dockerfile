# Dockerfile
FROM node:20-slim

WORKDIR /app

# 只 copy package.json 先做依賴安裝（build cache 會快好多）
COPY package.json ./
# 如果有 package-lock.json / npm-shrinkwrap.json 亦 copy 過來，但我哋唔用 npm ci
# （避免 lockfile 有問題導致 build 炸）
COPY package-lock.json* npm-shrinkwrap.json* ./

# 永遠用 npm install，避免 npm ci 因 lockfile 不一致而 fail
RUN npm install --omit=dev && npm cache clean --force

# copy 其餘檔案
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
