# ===== STABLE CLOUD RUN DOCKERFILE =====
FROM node:20-alpine

WORKDIR /app

# 安裝 pnpm
RUN npm install -g pnpm

# 複製 package files
COPY package.json pnpm-lock.yaml* ./

# 安裝依賴
RUN pnpm install --frozen-lockfile

# 複製全部程式
COPY . .

# 如果有 frontend，建置（冇都唔會錯）
RUN if [ -d "frontend" ]; then cd frontend && pnpm install && pnpm run build; fi

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
