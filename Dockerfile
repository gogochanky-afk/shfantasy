FROM node:20-alpine

WORKDIR /app

# Copy everything (debug check included)
COPY . .

# DEBUG: show what is actually inside the container
RUN echo "=== FILES IN /app ===" && ls -R /app

RUN npm install --production

EXPOSE 8080
CMD ["node", "index.js"]
