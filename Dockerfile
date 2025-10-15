# ============================================
# Stage 1: Build React Application
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

# Build arguments per variabili d'ambiente
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_USER_POOL_CLIENT_ID
ARG VITE_COGNITO_REGION
ARG VITE_COGNITO_IDENTITY_POOL_ID
ARG VITE_BEDROCK_AGENT_NAME
ARG VITE_BEDROCK_AGENT_ID
ARG VITE_BEDROCK_AGENT_ALIAS_ID
ARG VITE_BEDROCK_REGION
ARG VITE_API_URL

# ⚠️ IMPORTANTE: Usa path relativo per Nginx proxy
# Se non specificato, usa "/api" di default
ENV VITE_API_URL=${VITE_API_URL:-/api}

# Imposta le altre variabili d'ambiente
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID
ENV VITE_COGNITO_USER_POOL_CLIENT_ID=$VITE_COGNITO_USER_POOL_CLIENT_ID
ENV VITE_COGNITO_REGION=$VITE_COGNITO_REGION
ENV VITE_COGNITO_IDENTITY_POOL_ID=$VITE_COGNITO_IDENTITY_POOL_ID
ENV VITE_BEDROCK_AGENT_NAME=$VITE_BEDROCK_AGENT_NAME
ENV VITE_BEDROCK_AGENT_ID=$VITE_BEDROCK_AGENT_ID
ENV VITE_BEDROCK_AGENT_ALIAS_ID=$VITE_BEDROCK_AGENT_ALIAS_ID
ENV VITE_BEDROCK_REGION=$VITE_BEDROCK_REGION

# Copia package.json e installa dipendenze
COPY package.json package-lock.json* ./
RUN npm install

# Copia il resto dei file
COPY . .

# Build dell'applicazione
RUN npm run build

# Verifica che il build sia andato a buon fine
RUN ls -la /app/dist

# ============================================
# Stage 2: Serve con Nginx Custom Config
# ============================================
FROM nginx:stable-alpine

# Installa curl per health checks
RUN apk add --no-cache curl

# Rimuovi la configurazione default di Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia il build dalla stage precedente
COPY --from=build /app/dist /usr/share/nginx/html

# Copia la configurazione Nginx custom
COPY nginx.conf /etc/nginx/nginx.conf

# Crea directory per i log se non esiste
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log

# Permessi corretti
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Esponi porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Avvia Nginx
CMD ["nginx", "-g", "daemon off;"]