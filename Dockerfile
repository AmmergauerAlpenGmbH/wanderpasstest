FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /data
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/gipfelpass.sqlite
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "server.js"]
