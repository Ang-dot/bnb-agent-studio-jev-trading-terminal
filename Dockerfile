# API-only paper worker. Inject secrets at runtime; live execution stays locked.
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787 HOSTING_MODE=cloud WORKER_ENABLED=false GMGN_CLI_PATH=/usr/local/bin/gmgn-cli
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts && npm install --global gmgn-cli@1.6.6 --ignore-scripts && npm cache clean --force
COPY --chown=node:node server ./server
COPY --chown=node:node src ./src
COPY --chown=node:node app/agent ./app/agent
COPY tsconfig.json ./
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "server/index.ts"]
