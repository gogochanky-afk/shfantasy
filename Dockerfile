FROM node:18-alpine

WORKDIR /app

# Install pnpm + git
RUN npm install -g pnpm && apk add --no-cache git

# Copy package manifests first (better cache)
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/

# Install backend deps
RUN npm install

# Install frontend deps
RUN cd frontend && pnpm install

# Copy source
COPY . .

# Build frontend (Vite)
RUN cd frontend && \
    export VITE_BUILD_ID=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \
    export VITE_APP_VERSION="1.0.0" && \
    echo "Building with BUILD_ID=$VITE_BUILD_ID" && \
    pnpm run build

# Cloud Run uses PORT env var
EXPOSE 8080

# Start backend
CMD ["npm", "start"]
