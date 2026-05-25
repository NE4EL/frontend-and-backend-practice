FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY ../frontend/package*.json ./
RUN npm install
COPY ../frontend .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY --from=frontend-builder /frontend/dist ./frontend/dist
EXPOSE 3000
CMD ["node", "server.js"]
