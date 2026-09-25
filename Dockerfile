# Temporary infrastructure probe. No provider credentials or trading code.
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY --chown=node:node scripts/hosting-preflight.mjs ./scripts/hosting-preflight.mjs
USER node
EXPOSE 8787
CMD ["node", "scripts/hosting-preflight.mjs"]
