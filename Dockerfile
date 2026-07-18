FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
COPY knexfile.js ./
COPY --from=frontend-build /frontend/dist ./public/
EXPOSE 3000
CMD ["node", "src/index.js"]
