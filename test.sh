#!/bin/bash
set -e

# Colori
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# --- CONFIGURAZIONE ---
CONTAINER_NAME="sap-dashboard-test" # Nome del container
LOCAL_TAG="sap-dashboard-test"
DOCKERFILE_NAME="Dockerfile.unified" # Assicurati che sia quello con node server.js
AWS_REGION="eu-west-1" # Assicurati sia la regione corretta

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}  Build e Test Immagine Locale (ARM64)  ${NC}"
echo -e "${BLUE}  Dockerfile: ${CYAN}$DOCKERFILE_NAME${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

# --- Pulizia container precedente ---
echo -e "${YELLOW}0. Pulizia container precedente '$CONTAINER_NAME' (se esiste)...${NC}"
docker stop $CONTAINER_NAME > /dev/null 2>&1 || true
docker rm $CONTAINER_NAME > /dev/null 2>&1 || true
echo -e "${GREEN}Pulizia completata.${NC}"
# --- ---

# --- Ottieni credenziali temporanee AWS STS ---
echo -e "${YELLOW}1. Ottenimento credenziali temporanee da AWS STS...${NC}"

# Controllo se l'utente è root o IAM
AWS_CALLER_IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text)

if [[ "$AWS_CALLER_IDENTITY" == *":root"* ]]; then
    echo -e "${YELLOW}Rilevato account root AWS. Durata massima sessione: 1 ora (3600 secondi)${NC}"
    MAX_DURATION=3600
else
    echo -e "${GREEN}Rilevato utente IAM. Durata massima sessione: 36 ore (129600 secondi)${NC}"
    MAX_DURATION=129600
fi

echo -e "${CYAN}Richiesta credenziali temporanee con durata $MAX_DURATION secondi...${NC}"
# Utilizziamo l'output direttamente in JSON
CREDENTIALS_JSON=$(aws sts get-session-token --duration-seconds $MAX_DURATION --output json)

if [ $? -ne 0 ]; then
    echo -e "${RED}ERRORE nell'ottenere credenziali temporanee. Controlla l'output sopra.${NC}"
    exit 1
fi

# Estrai le credenziali usando Python (standard su macOS e Linux)
export AWS_ACCESS_KEY_ID=$(python3 -c "import sys, json; print(json.loads('''$CREDENTIALS_JSON''')['Credentials']['AccessKeyId'])")
export AWS_SECRET_ACCESS_KEY=$(python3 -c "import sys, json; print(json.loads('''$CREDENTIALS_JSON''')['Credentials']['SecretAccessKey'])")
export AWS_SESSION_TOKEN=$(python3 -c "import sys, json; print(json.loads('''$CREDENTIALS_JSON''')['Credentials']['SessionToken'])")
EXPIRATION=$(python3 -c "import sys, json; print(json.loads('''$CREDENTIALS_JSON''')['Credentials']['Expiration'])")

# Verifica che l'estrazione sia riuscita
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_SESSION_TOKEN" ]; then
    echo -e "${RED}ERRORE nell'estrarre le credenziali dal JSON.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Credenziali temporanee ottenute con successo!${NC}"
echo -e "${CYAN}Le credenziali scadranno il: $EXPIRATION${NC}"

# --- Build (assicurati che Dockerfile.unified sia corretto!) ---
echo -e "${YELLOW}2. Avvio build per architettura ARM64...${NC}"
echo "Dockerfile: $DOCKERFILE_NAME"
echo "Tag locale: $LOCAL_TAG"
echo "Questo richiederà diversi minuti..."

docker buildx build \
    --platform linux/arm64 \
    -f $DOCKERFILE_NAME \
    -t "$LOCAL_TAG" \
    --load \
    --build-arg VITE_COGNITO_USER_POOL_ID="eu-west-1_7WLST1Mlg" \
    --build-arg VITE_COGNITO_USER_POOL_CLIENT_ID="vpscdsoro31v6hioq7e52ktkv" \
    --build-arg VITE_COGNITO_REGION="eu-west-1" \
    --build-arg VITE_COGNITO_IDENTITY_POOL_ID="eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc" \
    --build-arg VITE_BEDROCK_AGENT_NAME="SAPReportAnalyst" \
    --build-arg VITE_BEDROCK_AGENT_ID="93BV0V6G4L" \
    --build-arg VITE_BEDROCK_AGENT_ALIAS_ID="TSTALIASID" \
    --build-arg VITE_BEDROCK_REGION="eu-west-1" \
    .
echo -e "${GREEN}✅ Build completato!${NC}"
# --- ---

# 3. Avvio container CON CREDENZIALI
echo -e "${YELLOW}3. Avvio container per test locale con credenziali AWS temporanee...${NC}"
echo "Porta 8080 mappata su localhost:8080"

# Avvia il container passando le variabili d'ambiente ottenute da STS
CONTAINER_ID=$(docker run -d \
  -p 8080:8080 \
  --name $CONTAINER_NAME \
  -e AWS_REGION="$AWS_REGION" \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
  $LOCAL_TAG)

echo "Container ID: $CONTAINER_ID"

# 4. Verifica log e processi
echo -e "${YELLOW}4. Verifica dei log del container (attendere 10 secondi)...${NC}"
sleep 10 # Attendi che il container si avvii completamente

docker logs $CONTAINER_NAME

echo -e "${YELLOW}5. Verifica dei processi in esecuzione nel container...${NC}"
docker exec $CONTAINER_NAME ps aux | grep -E 'nginx|node|supervisor' || echo -e "${RED}Nessun processo nginx/node/supervisor trovato! Controlla i log sopra.${NC}"

# 6. Comandi utili
echo -e "${YELLOW}6. Comandi utili:${NC}"
echo -e "${CYAN}• Per fermare il container: ${NC}docker stop $CONTAINER_NAME"
echo -e "${CYAN}• Per rimuovere il container: ${NC}docker rm $CONTAINER_NAME"
echo -e "${CYAN}• Per accedere alla shell del container: ${NC}docker exec -it $CONTAINER_NAME /bin/sh"
echo -e "${CYAN}• Per visualizzare i log in tempo reale: ${NC}docker logs -f $CONTAINER_NAME"

# 7. Riepilogo
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${CYAN}🎉 TEST LOCALE AVVIATO 🎉${NC}"
echo -e "${GREEN}Se i log e i processi sopra sembrano corretti, prova ad accedere all'applicazione.${NC}"
echo -e "${GREEN}Vai a: http://localhost:8080${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${YELLOW}NOTA: Le credenziali AWS temporanee nel container scadranno il: $EXPIRATION${NC}"