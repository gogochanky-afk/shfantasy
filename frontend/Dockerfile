# Step 1: Build Vite static files
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .
RUN pnpm build

# Step 2: Serve static files with Cloud Run's built-in web server
FROM gcr.io/distroless/static
WORKDIR /app
COPY --from=builder /app/dist /app
CMD ["/app"]
