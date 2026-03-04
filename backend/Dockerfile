# ===== SHFantasy Backend Dockerfile (Final Version) =====

# Use official Node.js runtime
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy dependencies files
COPY package.json package-lock.json* yarn.lock* ./

# Install production dependencies only
RUN npm install --production

# Copy all backend source code
COPY . .

# Cloud Run requires applications to listen on PORT
ENV PORT=8080
EXPOSE 8080

# Start backend
CMD ["npm", "start"]