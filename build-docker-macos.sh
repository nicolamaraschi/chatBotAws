#!/bin/bash

# ==============================================================================
# Docker Build Script per macOS → Windows x86
# ==============================================================================

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Banner
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║     🐳 Docker Build - macOS → Windows x86                ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configurazione
IMAGE_NAME="sap-dashboard"
IMAGE_TAG="latest"
PLATFORM="linux/amd64"

# Variabili d'ambiente
VITE_COGNITO_USER_POOL_ID="eu-west-1_7WLST1Mlg"
VITE_COGNITO_USER_POOL_CLIENT_ID="vpscdsoro31v6hioq7e52ktkv"
VITE_COGNITO_REGION="eu-west-1"
VITE_COGNITO_IDENTITY_POOL_ID="eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc"
VITE_BEDROCK_AGENT_NAME="SAPReportAnalyst"
VITE_BEDROCK_AGENT_ID="93BV0V6G4L"
VITE_BEDROCK_AGENT_ALIAS_ID="TSTALIASID"
VITE_BEDROCK_REGION="eu-west-1"
# Aggiungi questa nuova variabile per l'API URL
VITE_API_URL="https://basis.ai.horsacloudtech.net:3001"

# Verifica Docker
echo -e "${YELLOW}🔍 Verifica Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker non trovato!${NC}"
    echo "Installa Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo -e "${GREEN}✅ Docker OK${NC}"

# Verifica architettura
echo -e "${YELLOW}🔍 Verifica architettura...${NC}"
ARCH=$(uname -m)
echo "Architettura Mac: $ARCH"

if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${YELLOW}⚠️  Rilevato Apple Silicon (M1/M2/M3)${NC}"
    USE_BUILDX=true
    
    # Verifica buildx
    if ! docker buildx version &> /dev/null; then
        echo -e "${RED}❌ Buildx non disponibile${NC}"
        exit 1
    fi
    
    # Crea builder multi-platform se non esiste
    if ! docker buildx inspect multiplatform &> /dev/null; then
        echo -e "${YELLOW}🔧 Creazione builder multi-platform...${NC}"
        docker buildx create --name multiplatform --use
        docker buildx inspect --bootstrap
    else
        docker buildx use multiplatform
    fi
    
    echo -e "${GREEN}✅ Buildx configurato${NC}"
else
    echo -e "${GREEN}✅ Intel Mac - Build standard${NC}"
    USE_BUILDX=false
fi

# Build
echo ""
echo -e "${YELLOW}📦 Avvio build per ${PLATFORM}...${NC}"
echo ""

if [ "$USE_BUILDX" = true ]; then
    # Build con buildx (Apple Silicon)
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
    # Build standard (Intel Mac)
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
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║          ✅ BUILD COMPLETATA CON SUCCESSO! ✅             ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Info immagine
SIZE=$(docker images ${IMAGE_NAME}:${IMAGE_TAG} --format "{{.Size}}")
echo -e "${BLUE}📦 Immagine creata:${NC}"
echo "   Nome: ${IMAGE_NAME}:${IMAGE_TAG}"
echo "   Piattaforma: ${PLATFORM}"
echo "   Dimensione: ${SIZE}"
echo ""

# Menu opzioni
echo -e "${BLUE}Cosa vuoi fare?${NC}"
echo "1) 🧪 Testa localmente (porta 8080)"
echo "2) 💾 Salva immagine in file .tar"
echo "3) 📤 Push su Docker Hub"
echo "4) 📤 Push su AWS ECR"
echo "5) ❌ Niente, finito"
echo ""
read -p "Scelta (1-5): " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}🚀 Avvio container di test...${NC}"
        docker run -d \
            --name sap-dashboard-test \
            --platform ${PLATFORM} \
            -p 8080:80 \
            ${IMAGE_NAME}:${IMAGE_TAG}
        
        echo -e "${GREEN}✅ Container avviato!${NC}"
        echo "🌐 Apri nel browser: http://localhost:8080"
        echo ""
        echo "Per fermare:"
        echo "  docker stop sap-dashboard-test"
        echo "  docker rm sap-dashboard-test"
        ;;
    
    2)
        echo ""
        echo -e "${YELLOW}💾 Salvataggio immagine...${NC}"
        OUTPUT_FILE="${IMAGE_NAME}-${IMAGE_TAG}.tar"
        docker save -o ${OUTPUT_FILE} ${IMAGE_NAME}:${IMAGE_TAG}
        
        # Comprimi
        echo -e "${YELLOW}🗜️  Compressione...${NC}"
        gzip ${OUTPUT_FILE}
        
        FILE_SIZE=$(ls -lh ${OUTPUT_FILE}.gz | awk '{print $5}')
        echo -e "${GREEN}✅ Immagine salvata!${NC}"
        echo "📁 File: ${OUTPUT_FILE}.gz"
        echo "📊 Dimensione: ${FILE_SIZE}"
        echo ""
        echo "Per caricare su Windows:"
        echo "  docker load < ${OUTPUT_FILE}.gz"
        ;;
    
    3)
        echo ""
        read -p "Docker Hub username: " docker_username
        
        echo -e "${YELLOW}🔐 Login a Docker Hub...${NC}"
        docker login
        
        echo -e "${YELLOW}📤 Push in corso...${NC}"
        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${docker_username}/${IMAGE_NAME}:${IMAGE_TAG}
        docker push ${docker_username}/${IMAGE_NAME}:${IMAGE_TAG}
        
        echo -e "${GREEN}✅ Push completato!${NC}"
        echo "🌐 Immagine disponibile su:"
        echo "   docker pull ${docker_username}/${IMAGE_NAME}:${IMAGE_TAG}"
        ;;
    
    4)
        echo ""
        read -p "AWS Region (default: eu-west-1): " aws_region
        aws_region=${aws_region:-eu-west-1}
        
        read -p "AWS Account ID: " aws_account_id
        
        if [ -z "$aws_account_id" ]; then
            echo -e "${RED}❌ Account ID obbligatorio${NC}"
            exit 1
        fi
        
        ECR_REPO="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/${IMAGE_NAME}"
        
        echo -e "${YELLOW}🔐 Login ad AWS ECR...${NC}"
        aws ecr get-login-password --region ${aws_region} | \
            docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com
        
        echo -e "${YELLOW}📦 Creazione repository (se non esiste)...${NC}"
        aws ecr create-repository --repository-name ${IMAGE_NAME} --region ${aws_region} 2>/dev/null || true
        
        echo -e "${YELLOW}📤 Push in corso...${NC}"
        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
        docker push ${ECR_REPO}:${IMAGE_TAG}
        
        echo -e "${GREEN}✅ Push completato!${NC}"
        echo "🌐 Immagine disponibile su:"
        echo "   ${ECR_REPO}:${IMAGE_TAG}"
        ;;
    
    5)
        echo -e "${GREEN}👍 Ottimo! Immagine pronta per il deploy.${NC}"
        ;;
    
    *)
        echo -e "${RED}❌ Scelta non valida${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ Processo completato!${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""