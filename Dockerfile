FROM node:18-alpine

WORKDIR /app

# Install pnpm and git
RUN npm install -g pnpm && apk add --no-cache git

# Copy backend package.json
COPY package.json ./

# Install backend deps
RUN npm install

# Copy frontend package.json
COPY frontend/package.json ./frontend/

# Install frontend deps
RUN cd frontend && pnpm install

# Copy everything
COPY . .

# Build frontend
RUN cd frontend && pnpm run build

EXPOSE 8080

CMD ["npm", "start"]
