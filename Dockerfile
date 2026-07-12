FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY server ./server
COPY index.html styles.css script.js ./
COPY assets ./assets

EXPOSE 8080

CMD ["node", "server.js"]
