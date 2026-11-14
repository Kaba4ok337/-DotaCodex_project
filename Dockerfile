FROM node:22.13-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:css && npm prune --omit=dev

FROM node:22.13-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 8000
CMD ["node", "server.js"]

