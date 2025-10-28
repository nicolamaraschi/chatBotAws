#!/bin/bash
set -e

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- CONFIGURAZIONE ---
AWS_REGION="eu-west-1"
AWS_ACCOUNT_ID="593740920040"

# IL TUO REPOSITORY ECR UNICO
ECR_REPO_NAME="hrun/sap-dashboard"
ECR_URI="593740920040.dkr.ecr.eu-west-1.amazonaws.com/$ECR_REPO_NAME"
DOCKERFILE_NAME="Dockerfile.unified" # Assicurati che questo sia il Dockerfile corretto e aggiornato

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Build e Push Immagine Unificata (ARM64) ${NC}"
echo -e "${BLUE}  Repository: ${CYAN}$ECR_URI${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

# 1. Autenticazione ECR
echo -e "${YELLOW}1. Autenticazione a AWS ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo -e "${GREEN}Login ECR riuscito!${NC}"

# 2. Build e Push
echo -e "${YELLOW}2. Avvio Build & Push (per linux/arm64)...${NC}"
echo "Dockerfile: $DOCKERFILE_NAME"
echo "Questo richiederà diversi minuti..."

# Usiamo buildx per specificare l'architettura ARM64
docker buildx build \
    --platform linux/arm64 \
    -f $DOCKERFILE_NAME \
    -t "$ECR_URI:latest" \
    --build-arg VITE_COGNITO_USER_POOL_ID="eu-west-1_7WLST1Mlg" \
    --build-arg VITE_COGNITO_USER_POOL_CLIENT_ID="vpscdsoro31v6hioq7e52ktkv" \
    --build-arg VITE_COGNITO_REGION="eu-west-1" \
    --build-arg VITE_COGNITO_IDENTITY_POOL_ID="eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc" \
    --build-arg VITE_BEDROCK_AGENT_NAME="SAPReportAnalyst" \
    --build-arg VITE_BEDROCK_AGENT_ID="93BV0V6G4L" \
    --build-arg VITE_BEDROCK_AGENT_ALIAS_ID="TSTALIASID" \
    --build-arg VITE_BEDROCK_REGION="eu-west-1" \
    --push \
    .

echo -e "${GREEN}✅ Build e Push completati!${NC}"

# 3. Riepilogo
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${CYAN}🎉 DEPLOY SU ECR COMPLETATO 🎉${NC}"
echo -e "Immagine ARM64 pubblicata su: ${GREEN}$ECR_URI:latest${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"