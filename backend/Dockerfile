# ===== Backend Dockerfile (for Cloud Run) =====

# Use official Node.js 18
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies
RUN npm install --production

# Copy the rest of the backend code
COPY . .

# Expose port Cloud Run will listen on
ENV PORT=8080

# Start the backend
CMD ["npm", "start"]