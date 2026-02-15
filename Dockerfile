FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install
RUN cd frontend && pnpm install

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && pnpm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
