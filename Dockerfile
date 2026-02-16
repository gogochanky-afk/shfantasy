FROM node:20-alpine

WORKDIR /app

# install pnpm
RUN npm install -g pnpm

# copy package files
COPY package.json ./

# install deps (NO frozen-lockfile)
RUN pnpm install

# copy rest of app
COPY . .

# expose port
ENV PORT=8080
EXPOSE 8080

# start server
CMD ["node", "index.js"]
