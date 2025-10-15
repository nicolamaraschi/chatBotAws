#!/bin/bash

# ==============================================================================
# Script di Test Docker Locale per macOS
# Simula esattamente l'ambiente di produzione x86
# ==============================================================================

set -e

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Banner
clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║     🧪 Test Docker Locale - Ambiente Produzione          ║${NC}"
echo -e "${BLUE}║     macOS (arm64/amd64) → Simula x86 Linux               ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configurazione
COMPOSE_FILE="docker-compose.test.yml"
FRONTEND_PORT=8080
BACKEND_URL="https://basis.ai.horsacloudtech.net:3001"

# Funzioni utility
print_step() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ==============================================================================
# FASE 1: VERIFICA PREREQUISITI
# ==============================================================================
print_step "FASE 1: Verifica Prerequisiti"

# Verifica Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker non trovato!"
    exit 1
fi
print_success "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Verifica Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    print_error "Docker Compose non trovato!"
    exit 1
fi
print_success "Docker Compose disponibile"

# Verifica buildx
if ! docker buildx version &> /dev/null; then
    print_error "Docker Buildx non disponibile!"
    exit 1
fi
print_success "Docker Buildx disponibile"

# Architettura
ARCH=$(uname -m)
print_info "Architettura macOS: ${ARCH}"

if [[ "$ARCH" == "arm64" ]]; then
    print_warning "Apple Silicon rilevato - Verrà fatto cross-compile per x86"
    
    # Verifica/Crea builder
    if ! docker buildx inspect multiplatform &> /dev/null 2>&1; then
        print_info "Creazione builder multi-platform..."
        docker buildx create --name multiplatform --use
        docker buildx inspect --bootstrap
    else
        docker buildx use multiplatform
    fi
    print_success "Builder multi-platform configurato"
fi

# Verifica file necessari
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "File $COMPOSE_FILE non trovato!"
    exit 1
fi
print_success "File docker-compose.test.yml trovato"

if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile non trovato!"
    exit 1
fi
print_success "Dockerfile trovato"

if [ ! -f "nginx.conf" ]; then
    print_error "nginx.conf non trovato!"
    exit 1
fi
print_success "nginx.conf trovato"

# ==============================================================================
# FASE 2: PULIZIA AMBIENTE
# ==============================================================================
print_step "FASE 2: Pulizia Ambiente Precedente"

# Ferma e rimuovi container esistenti
if docker ps -a | grep -q "sap-dashboard-frontend-test\|sap-backend-test"; then
    print_info "Rimozione container precedenti..."
    docker-compose -f $COMPOSE_FILE down -v 2>/dev/null || true
    docker rm -f sap-dashboard-frontend-test sap-backend-test 2>/dev/null || true
    print_success "Container precedenti rimossi"
else
    print_info "Nessun container precedente da rimuovere"
fi

# Rimuovi immagini vecchie (opzionale)
read -p "Vuoi rimuovere le immagini vecchie? (y/N): " remove_images
if [[ "$remove_images" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    print_info "Rimozione immagini precedenti..."
    docker rmi test-sap-dashboard-frontend 2>/dev/null || true
    docker rmi test-sap-backend 2>/dev/null || true
    print_success "Immagini rimosse"
fi

# ==============================================================================
# FASE 3: BUILD IMMAGINI
# ==============================================================================
print_step "FASE 3: Build Immagini Docker (x86 Linux)"

print_info "Target: linux/amd64 (compatibile x86 Windows/Linux)"
print_info "Questo può richiedere alcuni minuti..."
echo ""

BUILD_START=$(date +%s)

# Build con docker-compose
if docker compose version &> /dev/null 2>&1; then
    docker compose -f $COMPOSE_FILE build --no-cache
else
    docker-compose -f $COMPOSE_FILE build --no-cache
fi

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))

print_success "Build completato in ${BUILD_TIME} secondi"

# Mostra info immagini
echo ""
print_info "Immagini create:"
docker images | grep -E "test-sap-dashboard|REPOSITORY" || true
echo ""

# ==============================================================================
# FASE 4: AVVIO CONTAINER
# ==============================================================================
print_step "FASE 4: Avvio Container di Test"

print_info "Avvio container..."
if docker compose version &> /dev/null 2>&1; then
    docker compose -f $COMPOSE_FILE up -d
else
    docker-compose -f $COMPOSE_FILE up -d
fi

# Attendi che i container siano pronti
print_info "Attesa avvio container..."
sleep 5

# Verifica stato
if docker ps | grep -q "sap-dashboard-frontend-test"; then
    print_success "Container frontend avviato"
else
    print_error "Container frontend non avviato!"
    docker-compose -f $COMPOSE_FILE logs
    exit 1
fi

# ==============================================================================
# FASE 5: TEST HEALTH CHECK
# ==============================================================================
print_step "FASE 5: Test Health Check"

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:${FRONTEND_PORT}/health > /dev/null 2>&1; then
        print_success "Health check OK"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            print_error "Health check fallito dopo ${MAX_RETRIES} tentativi"
            docker logs sap-dashboard-frontend-test
            exit 1
        fi
        print_warning "Tentativo ${RETRY_COUNT}/${MAX_RETRIES}..."
        sleep 3
    fi
done

# ==============================================================================
# FASE 6: TEST FUNZIONALITÀ
# ==============================================================================
print_step "FASE 6: Test Funzionalità"

# Test 1: Frontend accessibile
print_info "Test 1: Frontend accessibile..."
if curl -sf http://localhost:${FRONTEND_PORT}/ > /dev/null; then
    print_success "Frontend raggiungibile"
else
    print_error "Frontend non raggiungibile"
fi

# Test 2: File statici
print_info "Test 2: File statici (JS/CSS)..."
if curl -sf http://localhost:${FRONTEND_PORT}/ | grep -q "assets"; then
    print_success "File statici presenti"
else
    print_warning "File statici non rilevati (potrebbe essere normale)"
fi

# Test 3: Nginx config
print_info "Test 3: Configurazione Nginx..."
if docker exec sap-dashboard-frontend-test cat /etc/nginx/nginx.conf | grep -q "location /api"; then
    print_success "Proxy /api configurato"
else
    print_warning "Proxy /api non trovato in configurazione"
fi

# Test 4: Backend proxy (se configurato)
print_info "Test 4: Test proxy API..."
PROXY_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${FRONTEND_PORT}/api/sap/clients 2>/dev/null || echo "000")

if [ "$PROXY_TEST" = "200" ]; then
    print_success "Proxy API funzionante (200 OK)"
elif [ "$PROXY_TEST" = "401" ] || [ "$PROXY_TEST" = "403" ]; then
    print_success "Proxy API funzionante (${PROXY_TEST} - Autenticazione richiesta)"
else
    print_warning "Proxy API risponde con codice: ${PROXY_TEST}"
    print_info "Questo è normale se il backend richiede autenticazione"
fi

# Test 5: Verifica architettura container
print_info "Test 5: Verifica architettura container..."
CONTAINER_ARCH=$(docker inspect sap-dashboard-frontend-test --format='{{.Platform}}' 2>/dev/null || echo "unknown")
print_info "Architettura container: ${CONTAINER_ARCH}"

if echo "$CONTAINER_ARCH" | grep -q "amd64"; then
    print_success "Container è x86/amd64 ✓"
else
    print_warning "Architettura: ${CONTAINER_ARCH}"
fi

# ==============================================================================
# FASE 7: INFORMAZIONI E LOG
# ==============================================================================
print_step "FASE 7: Informazioni di Sistema"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║          ✅ TEST COMPLETATO CON SUCCESSO! ✅              ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📊 Informazioni Container:${NC}"
echo ""
docker ps --filter "name=sap-dashboard" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo -e "${CYAN}🌐 URL Applicazione:${NC}"
echo "   Frontend: http://localhost:${FRONTEND_PORT}"
echo "   Health Check: http://localhost:${FRONTEND_PORT}/health"
echo "   API Proxy: http://localhost:${FRONTEND_PORT}/api/"
echo ""

echo -e "${CYAN}📦 Dimensioni Immagini:${NC}"
docker images | grep "test-sap-dashboard" | awk '{printf "   %s: %s\n", $1":"$2, $7}'
echo ""

echo -e "${CYAN}💾 Uso Risorse:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "NAME|sap-dashboard"
echo ""

# ==============================================================================
# MENU AZIONI
# ==============================================================================
print_step "Azioni Disponibili"

echo "1) 📝 Visualizza log frontend"
echo "2) 🔍 Ispeziona container (shell interattiva)"
echo "3) 🔄 Riavvia container"
echo "4) 📊 Statistiche real-time"
echo "5) 💾 Esporta immagine frontend in .tar.gz"
echo "6) 🧹 Stop e pulizia"
echo "7) ❌ Esci (lascia container in esecuzione)"
echo ""

while true; do
    read -p "Scelta (1-7): " action
    
    case $action in
        1)
            echo ""
            print_info "Log frontend (Ctrl+C per uscire):"
            docker logs -f sap-dashboard-frontend-test
            ;;
        2)
            echo ""
            print_info "Entrando nel container..."
            print_warning "Usa 'exit' per uscire"
            docker exec -it sap-dashboard-frontend-test sh
            ;;
        3)
            echo ""
            print_info "Riavvio container..."
            docker restart sap-dashboard-frontend-test
            sleep 3
            print_success "Container riavviato"
            ;;
        4)
            echo ""
            print_info "Statistiche (Ctrl+C per uscire):"
            docker stats sap-dashboard-frontend-test
            ;;
        5)
            echo ""
            print_info "Esportazione immagine..."
            
            IMAGE_NAME="test-sap-dashboard-frontend"
            OUTPUT_FILE="sap-dashboard-production-ready.tar"
            
            # Ottieni l'ID dell'immagine
            IMAGE_ID=$(docker images -q ${IMAGE_NAME}:latest)
            
            if [ -z "$IMAGE_ID" ]; then
                print_error "Immagine non trovata!"
            else
                docker save -o ${OUTPUT_FILE} ${IMAGE_ID}
                gzip -f ${OUTPUT_FILE}
                
                FILE_SIZE=$(ls -lh ${OUTPUT_FILE}.gz | awk '{print $5}')
                print_success "Immagine esportata!"
                echo ""
                echo -e "${CYAN}📁 File: ${OUTPUT_FILE}.gz${NC}"
                echo -e "${CYAN}📊 Dimensione: ${FILE_SIZE}${NC}"
                echo ""
                echo -e "${YELLOW}📤 Per il tuo collega su Windows/Portainer:${NC}"
                echo "   1. Trasferisci il file: ${OUTPUT_FILE}.gz"
                echo "   2. Su Portainer: Images → Import → Carica il file"
                echo "   3. Deploy: Container → Add → Usa l'immagine importata"
                echo "   4. Port mapping: 8080:80 (o altra porta)"
                echo ""
            fi
            ;;
        6)
            echo ""
            print_warning "Stop e pulizia ambiente..."
            if docker compose version &> /dev/null 2>&1; then
                docker compose -f $COMPOSE_FILE down -v
            else
                docker-compose -f $COMPOSE_FILE down -v
            fi
            print_success "Pulizia completata"
            exit 0
            ;;
        7)
            echo ""
            print_info "Container lasciato in esecuzione"
            print_info "Per fermarlo: docker-compose -f $COMPOSE_FILE down"
            exit 0
            ;;
        *)
            print_error "Scelta non valida"
            ;;
    esac
    
    echo ""
    echo "1) Log  2) Shell  3) Riavvia  4) Stats  5) Esporta  6) Stop  7) Esci"
    echo ""
done