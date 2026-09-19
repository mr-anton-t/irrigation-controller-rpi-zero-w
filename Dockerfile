FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npx tsc

ENV USE_MOCK=true
ENV PORT=3000
ENV DB_PATH=/data/irrigation.db
ENV NODE_ENV=production

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "dist/index.js"]
