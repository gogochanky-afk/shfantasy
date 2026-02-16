# ===== STABLE CLOUD RUN DOCKERFILE =====
FROM node:20-alpine

WORKDIR /app

# 安裝 pnpm
RUN npm install -g pnpm

# 複製 package.json
COPY package.json ./

# 安裝依賴
RUN pnpm install

# 複製全部程式
COPY . .

# 如果有 frontend 就 build
RUN if [ -d "frontend" ]; then cd frontend && pnpm install && pnpm run build; fi

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
