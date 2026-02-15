FROM node:18-alpine

WORKDIR /app

# Install pnpm and git
RUN npm install -g pnpm && apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install
RUN cd frontend && pnpm install

# Copy source code
COPY . .

# Get git commit hash and build frontend with version info
RUN cd frontend && \
    export VITE_BUILD_ID=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \
    export VITE_APP_VERSION="1.0.0" && \
    echo "Building with BUILD_ID=$VITE_BUILD_ID" && \
    pnpm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
