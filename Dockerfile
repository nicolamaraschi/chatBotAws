# STAGE 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY aws-serverless-app/package*.json ./aws-serverless-app/
RUN npm install
RUN npm install --prefix aws-serverless-app
COPY . .
RUN npm run build

# STAGE 2: Immagine di Produzione
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache nginx bash
COPY --from=builder /app/aws-serverless-app ./aws-serverless-app
RUN npm install --prefix aws-serverless-app --omit=dev
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh .
RUN chmod +x ./start.sh
EXPOSE 80
CMD ["./start.sh"]