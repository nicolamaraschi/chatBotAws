#!/bin/bash

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🐳 Docker Build - SAP Dashboard                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configurazione
IMAGE_NAME="sap-dashboard"
IMAGE_TAG="latest"
PLATFORM="linux/amd64"

# ============================================
# CONFIGURAZIONE API
# ============================================
echo -e "${YELLOW}Scegli la configurazione API:${NC}"
echo "1) Proxy Nginx (/api) - Backend nello stesso host"
echo "2) Backend esterno - Specifica URL completo"
echo ""
read -p "Scelta (1-2): " api_choice

case $api_choice in
    1)
        VITE_API_URL="/api"
        echo -e "${CYAN}✓ Configurato per proxy Nginx locale${NC}"
        ;;
    2)
        read -p "Inserisci URL backend (es. https://backend.example.com:3001): " custom_url
        VITE_API_URL="$custom_url"
        echo -e "${CYAN}✓ Configurato per backend esterno: ${VITE_API_URL}${NC}"
        ;;
    *)
        echo -e "${RED}❌ Scelta non valida${NC}"
        exit 1
        ;;
esac

echo ""

# Variabili d'ambiente
VITE_COGNITO_USER_POOL_ID="eu-west-1_7WLST1Mlg"
VITE_COGNITO_USER_POOL_CLIENT_ID="vpscdsoro31v6hioq7e52ktkv"
VITE_COGNITO_REGION="eu-west-1"
VITE_COGNITO_IDENTITY_POOL_ID="eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc"
VITE_BEDROCK_AGENT_NAME="SAPReportAnalyst"
VITE_BEDROCK_AGENT_ID="93BV0V6G4L"
VITE_BEDROCK_AGENT_ALIAS_ID="TSTALIASID"
VITE_BEDROCK_REGION="eu-west-1"

# Verifica prerequisiti
echo -e "${YELLOW}🔍 Verifica prerequisiti...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Esegui lo script dalla root del progetto${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker non trovato${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisiti OK${NC}"

# Architettura
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    USE_BUILDX=true
    if ! docker buildx inspect multiplatform &> /dev/null 2>&1; then
        docker buildx create --name multiplatform --use
        docker buildx inspect --bootstrap
    else
        docker buildx use multiplatform
    fi
else
    USE_BUILDX=false
fi

# Build
echo ""
echo -e "${YELLOW}📦 Build in corso...${NC}"
echo ""

if [ "$USE_BUILDX" = true ]; then
    docker buildx build \
        --platform ${PLATFORM} \
        --build-arg VITE_COGNITO_USER_POOL_ID="${VITE_COGNITO_USER_POOL_ID}" \
        --build-arg VITE_COGNITO_USER_POOL_CLIENT_ID="${VITE_COGNITO_USER_POOL_CLIENT_ID}" \
        --build-arg VITE_COGNITO_REGION="${VITE_COGNITO_REGION}" \
        --build-arg VITE_COGNITO_IDENTITY_POOL_ID="${VITE_COGNITO_IDENTITY_POOL_ID}" \
        --build-arg VITE_BEDROCK_AGENT_NAME="${VITE_BEDROCK_AGENT_NAME}" \
        --build-arg VITE_BEDROCK_AGENT_ID="${VITE_BEDROCK_AGENT_ID}" \
        --build-arg VITE_BEDROCK_AGENT_ALIAS_ID="${VITE_BEDROCK_AGENT_ALIAS_ID}" \
        --build-arg VITE_BEDROCK_REGION="${VITE_BEDROCK_REGION}" \
        --build-arg VITE_API_URL="${VITE_API_URL}" \
        -t ${IMAGE_NAME}:${IMAGE_TAG} \
        --load \
        .
else
    docker build \
        --platform ${PLATFORM} \
        --build-arg VITE_COGNITO_USER_POOL_ID="${VITE_COGNITO_USER_POOL_ID}" \
        --build-arg VITE_COGNITO_USER_POOL_CLIENT_ID="${VITE_COGNITO_USER_POOL_CLIENT_ID}" \
        --build-arg VITE_COGNITO_REGION="${VITE_COGNITO_REGION}" \
        --build-arg VITE_COGNITO_IDENTITY_POOL_ID="${VITE_COGNITO_IDENTITY_POOL_ID}" \
        --build-arg VITE_BEDROCK_AGENT_NAME="${VITE_BEDROCK_AGENT_NAME}" \
        --build-arg VITE_BEDROCK_AGENT_ID="${VITE_BEDROCK_AGENT_ID}" \
        --build-arg VITE_BEDROCK_AGENT_ALIAS_ID="${VITE_BEDROCK_AGENT_ALIAS_ID}" \
        --build-arg VITE_BEDROCK_REGION="${VITE_BEDROCK_REGION}" \
        --build-arg VITE_API_URL="${VITE_API_URL}" \
        -t ${IMAGE_NAME}:${IMAGE_TAG} \
        .
fi

echo ""
echo -e "${GREEN}✅ BUILD COMPLETATA!${NC}"
echo ""
echo -e "${CYAN}📦 Immagine: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo -e "${CYAN}📊 Dimensione: $(docker images ${IMAGE_NAME}:${IMAGE_TAG} --format "{{.Size}}")${NC}"
echo ""

# Menu
echo -e "${BLUE}Cosa vuoi fare?${NC}"
echo "1) 🧪 Test locale (porta 8080)"
echo "2) 💾 Salva in .tar.gz"
echo "3) ❌ Esci"
echo ""
read -p "Scelta: " choice

case $choice in
    1)
        docker rm -f sap-dashboard-test 2>/dev/null || true
        docker run -d --name sap-dashboard-test -p 8080:80 ${IMAGE_NAME}:${IMAGE_TAG}
        sleep 2
        echo -e "${GREEN}✅ Container avviato su http://localhost:8080${NC}"
        docker logs --tail 20 sap-dashboard-test
        ;;
    2)
        OUTPUT_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"
        docker save -o ${OUTPUT_FILE} ${IMAGE_NAME}:${IMAGE_TAG}
        gzip -f ${OUTPUT_FILE}
        echo -e "${GREEN}✅ Salvato: ${OUTPUT_FILE}.gz${NC}"
        ;;
    3)
        echo -e "${GREEN}👋 Ciao!${NC}"
        ;;
esac