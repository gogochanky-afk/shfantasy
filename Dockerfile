FROM node:18

WORKDIR /app

COPY . .

RUN cd frontend && npm install && npm run build
RUN cd backend && npm install

EXPOSE 8080

CMD ["node", "backend/index.js"]
