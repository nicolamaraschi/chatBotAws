#!/bin/bash
set -e

# --- CONFIGURAZIONE ---
AWS_REGION="eu-west-1"
ECR_URI="593740920040.dkr.ecr.eu-west-1.amazonaws.com"
REPO_NAME="hrun/sap-dashboard"
FULL_REPO_URI="$ECR_URI/$REPO_NAME"

# --- COLORI ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}--- Script di Versioning e Push per ECR ---${NC}"

# --- 1. Login a ECR ---
echo -e "\n${YELLOW}[1/4] Eseguo il login a ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
echo -e "${GREEN}Login completato.${NC}"

# --- 2. Calcolo Prossima Versione ---
echo -e "\n${YELLOW}[2/4] Calcolo della prossima versione...${NC}"
LATEST_TAG=$(aws ecr describe-images --repository-name $REPO_NAME --region $AWS_REGION --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageTags[?starts_with(@, `v`)]' --output text | sed 's/v//' | sort -n | tail -1)

if [ -z "$LATEST_TAG" ]; then
  NEXT_VERSION="v1"
else
  NEXT_VERSION="v$((LATEST_TAG + 1))"
fi
echo -e "${GREEN}La prossima versione sarà: ${NEXT_VERSION}${NC}"

# --- 3. Build e Push Multi-Tag ---
echo -e "\n${YELLOW}[3/4] Eseguo il build per linux/amd64 (x86) e il push...${NC}"
echo "Tag da creare: ${CYAN}${NEXT_VERSION}${NC} e ${CYAN}latest${NC}"

docker buildx build \
  --platform linux/amd64 \
  -t "${FULL_REPO_URI}:${NEXT_VERSION}" \
  -t "${FULL_REPO_URI}:latest" \
  --push .

# --- 4. Riepilogo ---
echo -e "\n${YELLOW}[4/4] Operazione completata!${NC}"
echo -e "${GREEN}✅ Immagine caricata con successo su ECR.${NC}"
echo -e "URI Immagine: ${FULL_REPO_URI}"
echo -e "Tag creati: ${CYAN}${NEXT_VERSION}, latest${NC}"