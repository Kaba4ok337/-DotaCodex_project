FROM node:22.13-bookworm-slim

ENV HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build:css && npm prune --omit=dev && chown -R node:node /app
ENV NODE_ENV=production

USER node

EXPOSE 8000
CMD ["node", "server.js"]

