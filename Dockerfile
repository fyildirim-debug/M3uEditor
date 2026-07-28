FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node knexfile.js ./
RUN mkdir -p /app/data/logos && chown -R node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
