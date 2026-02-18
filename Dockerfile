FROM node:18

WORKDIR /app
COPY . .

# 1) Build frontend
RUN cd frontend && npm install && npm run build

# 2) Install backend deps (root)
RUN npm install

EXPOSE 8080

# ✅ IMPORTANT: use ROOT index.js as the only server entry
CMD ["node", "index.js"]
