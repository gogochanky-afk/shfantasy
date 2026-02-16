# ---- Runtime image (simple & stable) ----
FROM node:20-alpine

WORKDIR /app

# 1) Copy only package files first (better cache)
COPY package.json ./
# 如果你有 lockfile，就一併 copy；冇都唔會錯
COPY pnpm-lock.yaml* ./
COPY package-lock.json* ./
COPY yarn.lock* ./

# 2) Install deps (no frozen lockfile to avoid CI fail)
RUN npm i -g pnpm && pnpm install

# 3) Copy the rest
COPY . .

# 4) Cloud Run port
ENV PORT=8080
EXPOSE 8080

# 5) Start
CMD ["node", "index.js"]
