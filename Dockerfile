# Use official Node runtime
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy entire project
COPY . .

# Expose port
EXPOSE 8080

# Start backend using index.js (your actual entrypoint)
CMD ["node", "index.js"]
