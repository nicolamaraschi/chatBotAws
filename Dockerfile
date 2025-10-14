# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Declare build arguments for Vite
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_USER_POOL_CLIENT_ID
ARG VITE_COGNITO_REGION
ARG VITE_COGNITO_IDENTITY_POOL_ID
ARG VITE_BEDROCK_AGENT_NAME
ARG VITE_BEDROCK_AGENT_ID
ARG VITE_BEDROCK_AGENT_ALIAS_ID
ARG VITE_BEDROCK_REGION
ARG VITE_API_URL

# Set environment variables from arguments to be used by npm run build
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID
ENV VITE_COGNITO_USER_POOL_CLIENT_ID=$VITE_COGNITO_USER_POOL_CLIENT_ID
ENV VITE_COGNITO_REGION=$VITE_COGNITO_REGION
ENV VITE_COGNITO_IDENTITY_POOL_ID=$VITE_COGNITO_IDENTITY_POOL_ID
ENV VITE_BEDROCK_AGENT_NAME=$VITE_BEDROCK_AGENT_NAME
ENV VITE_BEDROCK_AGENT_ID=$VITE_BEDROCK_AGENT_ID
ENV VITE_BEDROCK_AGENT_ALIAS_ID=$VITE_BEDROCK_AGENT_ALIAS_ID
ENV VITE_BEDROCK_REGION=$VITE_BEDROCK_REGION
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

# Copy the build output from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]