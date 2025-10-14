#!/bin/bash

# ==============================================================================
# AWS AMPLIFY DEPLOY SCRIPT
# Script completo per il deployment su AWS Amplify dal terminale
# ==============================================================================

set -e  # Esci se c'è un errore

# ==============================================================================
# CONFIGURAZIONI
# ==============================================================================

PROJECT_NAME="sap-dashboard-app"
REGION="eu-west-1"  # Cambia con la tua region preferita
BRANCH="main"
ENV_NAME="production"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==============================================================================
# FUNZIONI DI UTILITÀ
# ==============================================================================

# Banner iniziale
print_banner() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║          🚀 AWS AMPLIFY DEPLOYMENT SCRIPT 🚀              ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║          SAP Dashboard - Deployment Manager                ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Stampa sezione
print_section() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo ""
}

# Stampa successo
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Stampa errore
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Stampa warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Stampa info
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Loading animation
show_loading() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Conferma azione
confirm_action() {
    local message=$1
    echo -e "${YELLOW}$message (y/n): ${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        return 0
    else
        return 1
    fi
}

# ==============================================================================
# FUNZIONI DI VERIFICA PREREQUISITI
# ==============================================================================

check_node() {
    print_info "Verifica Node.js..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js non trovato!"
        echo "  Installa Node.js da: https://nodejs.org/"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js versione >= 18 richiesta (trovata: $(node -v))"
        exit 1
    fi
    
    print_success "Node.js $(node -v) OK"
}

check_npm() {
    print_info "Verifica npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm non trovato!"
        exit 1
    fi
    print_success "npm $(npm -v) OK"
}

check_aws_cli() {
    print_info "Verifica AWS CLI..."
    if ! command -v aws &> /dev/null; then
        print_warning "AWS CLI non trovato"
        echo "  Installa AWS CLI da: https://aws.amazon.com/cli/"
        if ! confirm_action "Vuoi continuare senza AWS CLI?"; then
            exit 1
        fi
        return 1
    fi
    print_success "AWS CLI $(aws --version | cut -d' ' -f1 | cut -d'/' -f2) OK"
    return 0
}

check_amplify_cli() {
    print_info "Verifica Amplify CLI..."
    if ! command -v amplify &> /dev/null; then
        print_warning "Amplify CLI non trovato"
        if confirm_action "Vuoi installarlo ora?"; then
            install_amplify_cli
        else
            exit 1
        fi
    else
        print_success "Amplify CLI OK"
    fi
}

install_amplify_cli() {
    print_info "Installazione Amplify CLI..."
    npm install -g @aws-amplify/cli
    print_success "Amplify CLI installato!"
}

check_aws_credentials() {
    print_info "Verifica credenziali AWS..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "Credenziali AWS non configurate o non valide"
        echo ""
        echo "Configura le credenziali AWS in uno di questi modi:"
        echo "  1. Esegui: aws configure"
        echo "  2. Esegui: amplify configure"
        echo "  3. Imposta le variabili d'ambiente:"
        echo "     export AWS_ACCESS_KEY_ID=your_access_key"
        echo "     export AWS_SECRET_ACCESS_KEY=your_secret_key"
        echo "     export AWS_REGION=$REGION"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local user_arn=$(aws sts get-caller-identity --query Arn --output text)
    
    print_success "Credenziali AWS OK"
    echo "  Account ID: $account_id"
    echo "  User ARN: $user_arn"
}

check_dependencies() {
    print_info "Verifica dipendenze npm..."
    if [ ! -d "node_modules" ]; then
        print_warning "node_modules non trovato"
        if confirm_action "Vuoi installare le dipendenze?"; then
            npm install
            print_success "Dipendenze installate"
        else
            exit 1
        fi
    else
        print_success "Dipendenze OK"
    fi
}

# Verifica tutti i prerequisiti
check_all_prerequisites() {
    print_section "VERIFICA PREREQUISITI"
    
    check_node
    check_npm
    check_aws_cli
    check_amplify_cli
    check_aws_credentials
    check_dependencies
    
    echo ""
    print_success "Tutti i prerequisiti soddisfatti!"
    sleep 1
}

# ==============================================================================
# FUNZIONI DI BUILD
# ==============================================================================

build_project() {
    print_section "BUILD PROGETTO"
    
    print_info "Pulizia build precedenti..."
    rm -rf dist
    
    print_info "Esecuzione build..."
    echo ""
    
    npm run build
    
    echo ""
    
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        print_success "Build completata con successo!"
        
        # Mostra statistiche
        local build_size=$(du -sh dist | cut -f1)
        echo "  Dimensione build: $build_size"
        
        local file_count=$(find dist -type f | wc -l)
        echo "  File generati: $file_count"
    else
        print_error "Build fallita! Directory dist vuota o non esistente"
        exit 1
    fi
}

# ==============================================================================
# FUNZIONI AMPLIFY
# ==============================================================================

check_amplify_initialized() {
    if [ -d "amplify" ] && [ -f "amplify/.config/project-config.json" ]; then
        return 0
    else
        return 1
    fi
}

initialize_amplify() {
    print_section "INIZIALIZZAZIONE AMPLIFY"
    
    if check_amplify_initialized; then
        print_info "Amplify già inizializzato"
        if ! confirm_action "Vuoi reinizializzare?"; then
            return 0
        fi
        print_warning "Rimozione configurazione esistente..."
        rm -rf amplify .amplify-hosting
    fi
    
    print_info "Inizializzazione progetto Amplify..."
    echo ""
    
    # Inizializza Amplify in modalità headless
    amplify init \
        --amplify "{
            \"projectName\":\"$PROJECT_NAME\",
            \"envName\":\"$ENV_NAME\",
            \"defaultEditor\":\"vscode\"
        }" \
        --frontend "{
            \"framework\":\"react\",
            \"config\":{
                \"SourceDir\":\"src\",
                \"DistributionDir\":\"dist\",
                \"BuildCommand\":\"npm run build\",
                \"StartCommand\":\"npm run dev\"
            }
        }" \
        --providers "{
            \"awscloudformation\":{
                \"configLevel\":\"project\",
                \"useProfile\":true,
                \"profileName\":\"default\",
                \"region\":\"$REGION\"
            }
        }" \
        --yes
    
    echo ""
    print_success "Amplify inizializzato!"
}

configure_hosting() {
    print_section "CONFIGURAZIONE HOSTING"
    
    # Verifica se hosting è già configurato
    if amplify status 2>/dev/null | grep -q "hosting"; then
        print_info "Hosting già configurato"
        return 0
    fi
    
    print_info "Aggiunta configurazione hosting..."
    
    # Aggiungi hosting manuale (Manual deploy)
    amplify add hosting <<EOF
Hosting with Amplify Console
Manual deployment
EOF
    
    print_success "Hosting configurato!"
}

# ==============================================================================
# FUNZIONI DI DEPLOY
# ==============================================================================

deploy_to_amplify() {
    print_section "DEPLOY SU AMPLIFY"
    
    print_info "Avvio deployment..."
    echo ""
    
    # Deploy con Amplify
    amplify publish --yes
    
    echo ""
    print_success "Deploy completato!"
}

get_deployment_info() {
    print_section "INFORMAZIONI DEPLOYMENT"
    
    # Ottieni App ID
    local app_id=$(cat amplify/.config/project-config.json 2>/dev/null | grep -o '"appId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$app_id" ]; then
        print_info "App ID: $app_id"
        
        # Prova a ottenere l'URL
        local app_url=$(aws amplify get-app --app-id "$app_id" --region "$REGION" --query 'app.defaultDomain' --output text 2>/dev/null)
        
        if [ -n "$app_url" ] && [ "$app_url" != "None" ]; then
            echo ""
            echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                                                            ║${NC}"
            echo -e "${GREEN}║  🎉 DEPLOYMENT COMPLETATO CON SUCCESSO! 🎉               ║${NC}"
            echo -e "${GREEN}║                                                            ║${NC}"
            echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
            echo ""
            echo -e "${CYAN}🌐 URL Applicazione:${NC}"
            echo -e "   https://$BRANCH.$app_url"
            echo ""
            echo -e "${CYAN}📊 Comandi utili:${NC}"
            echo "   amplify status      - Visualizza stato"
            echo "   amplify console     - Apri console web"
            echo "   amplify publish     - Deploy successivo"
            echo ""
        fi
    fi
}

# ==============================================================================
# FUNZIONI GESTIONE VARIABILI D'AMBIENTE
# ==============================================================================

configure_environment_variables() {
    print_section "CONFIGURAZIONE VARIABILI D'AMBIENTE"
    
    if ! confirm_action "Vuoi configurare le variabili d'ambiente?"; then
        return 0
    fi
    
    # Ottieni App ID
    local app_id=$(cat amplify/.config/project-config.json 2>/dev/null | grep -o '"appId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$app_id" ]; then
        print_error "App ID non trovato. Esegui prima il deploy."
        return 1
    fi
    
    echo ""
    echo "Inserisci le variabili d'ambiente (premi ENTER per saltare):"
    echo ""
    
    read -p "VITE_COGNITO_USER_POOL_ID: " cognito_pool_id
    read -p "VITE_COGNITO_USER_POOL_CLIENT_ID: " cognito_client_id
    read -p "VITE_COGNITO_REGION (default: $REGION): " cognito_region
    cognito_region=${cognito_region:-$REGION}
    read -p "VITE_COGNITO_IDENTITY_POOL_ID: " cognito_identity_pool
    read -p "VITE_BEDROCK_AGENT_NAME: " bedrock_agent_name
    read -p "VITE_BEDROCK_AGENT_ID: " bedrock_agent_id
    read -p "VITE_BEDROCK_AGENT_ALIAS_ID: " bedrock_alias_id
    read -p "VITE_BEDROCK_REGION (default: $REGION): " bedrock_region
    bedrock_region=${bedrock_region:-$REGION}

    read -p "VITE_API_URL (default: https://basis.ai.horsacloudtech.net:3001): " api_url
    api_url=${api_url:-"https://basis.ai.horsacloudtech.net:3001"}

    
    
    # Costruisci il JSON delle variabili
    local env_vars="{"
    [ -n "$cognito_pool_id" ] && env_vars+="\"VITE_COGNITO_USER_POOL_ID\":\"$cognito_pool_id\","
    [ -n "$cognito_client_id" ] && env_vars+="\"VITE_COGNITO_USER_POOL_CLIENT_ID\":\"$cognito_client_id\","
    [ -n "$cognito_region" ] && env_vars+="\"VITE_COGNITO_REGION\":\"$cognito_region\","
    [ -n "$cognito_identity_pool" ] && env_vars+="\"VITE_COGNITO_IDENTITY_POOL_ID\":\"$cognito_identity_pool\","
    [ -n "$bedrock_agent_name" ] && env_vars+="\"VITE_BEDROCK_AGENT_NAME\":\"$bedrock_agent_name\","
    [ -n "$bedrock_agent_id" ] && env_vars+="\"VITE_BEDROCK_AGENT_ID\":\"$bedrock_agent_id\","
    [ -n "$bedrock_alias_id" ] && env_vars+="\"VITE_BEDROCK_AGENT_ALIAS_ID\":\"$bedrock_alias_id\","
    [ -n "$bedrock_region" ] && env_vars+="\"VITE_BEDROCK_REGION\":\"$bedrock_region\","

    # Aggiungi questa nuova riga
[ -n "$api_url" ] && env_vars+="\"VITE_API_URL\":\"$api_url\","
    
    # Rimuovi l'ultima virgola
    env_vars="${env_vars%,}"
    env_vars+="}"
    
    if [ "$env_vars" != "{}" ]; then
        print_info "Aggiornamento variabili d'ambiente..."
        
        aws amplify update-app \
            --app-id "$app_id" \
            --region "$REGION" \
            --environment-variables "$env_vars" > /dev/null
        
        print_success "Variabili d'ambiente configurate!"
        print_warning "Nota: Sarà necessario un nuovo deploy per applicare le modifiche"
    else
        print_warning "Nessuna variabile d'ambiente inserita"
    fi
}

# ==============================================================================
# FUNZIONI DI GESTIONE
# ==============================================================================

view_status() {
    print_section "STATUS AMPLIFY"
    amplify status
}

open_console() {
    print_section "APERTURA CONSOLE"
    print_info "Apertura console Amplify nel browser..."
    amplify console
}

delete_deployment() {
    print_section "ELIMINAZIONE DEPLOYMENT"
    
    print_warning "ATTENZIONE: Questa operazione eliminerà TUTTO il deployment!"
    print_warning "Verranno rimossi:"
    echo "  - Infrastruttura AWS"
    echo "  - Configurazione Amplify"
    echo "  - Hosting e dominio"
    echo ""
    
    if ! confirm_action "Sei SICURO di voler continuare?"; then
        print_info "Operazione annullata"
        return 0
    fi
    
    print_info "Eliminazione in corso..."
    amplify delete --yes
    
    print_success "Deployment eliminato"
}

# ==============================================================================
# WORKFLOW COMPLETO
# ==============================================================================

full_deployment_workflow() {
    print_banner
    
    # Step 1: Prerequisiti
    check_all_prerequisites
    
    # Step 2: Build
    build_project
    
    # Step 3: Inizializzazione Amplify
    initialize_amplify
    
    # Step 4: Configurazione Hosting
    configure_hosting
    
    # Step 5: Deploy
    deploy_to_amplify
    
    # Step 6: Variabili d'ambiente (opzionale)
    configure_environment_variables
    
    # Step 7: Info finali
    get_deployment_info
}

quick_deploy() {
    print_banner
    
    if ! check_amplify_initialized; then
        print_error "Amplify non inizializzato. Usa prima 'Deploy Completo'"
        sleep 2
        return 1
    fi
    
    build_project
    deploy_to_amplify
    get_deployment_info
}

# ==============================================================================
# MENU PRINCIPALE
# ==============================================================================

show_main_menu() {
    while true; do
        print_banner
        
        echo -e "${CYAN}Seleziona un'opzione:${NC}"
        echo ""
        echo "  1) 🚀 Deploy Completo (Prima volta)"
        echo "  2) ⚡ Deploy Veloce (Update)"
        echo "  3) 📦 Solo Build"
        echo "  4) 📊 Visualizza Status"
        echo "  5) 🌐 Apri Console Web"
        echo "  6) ⚙️  Configura Variabili d'Ambiente"
        echo "  7) 🗑️  Elimina Deployment"
        echo "  0) 👋 Esci"
        echo ""
        read -p "Scelta: " choice
        
        case $choice in
            1)
                full_deployment_workflow
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            2)
                quick_deploy
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            3)
                print_banner
                build_project
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            4)
                print_banner
                view_status
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            5)
                print_banner
                open_console
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            6)
                print_banner
                configure_environment_variables
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            7)
                print_banner
                delete_deployment
                echo ""
                read -p "Premi ENTER per continuare..."
                ;;
            0)
                print_banner
                echo -e "${GREEN}👋 Arrivederci!${NC}"
                echo ""
                exit 0
                ;;
            *)
                print_error "Scelta non valida"
                sleep 1
                ;;
        esac
    done
}

# ==============================================================================
# ENTRY POINT
# ==============================================================================

main() {
    # Verifica di essere nella directory corretta
    if [ ! -f "package.json" ]; then
        print_error "Esegui questo script dalla root del progetto!"
        exit 1
    fi
    
    # Se ci sono argomenti, esegui direttamente
    if [ $# -gt 0 ]; then
        case $1 in
            --full|-f)
                full_deployment_workflow
                ;;
            --quick|-q)
                quick_deploy
                ;;
            --build|-b)
                build_project
                ;;
            --status|-s)
                view_status
                ;;
            --help|-h)
                echo "Uso: $0 [opzione]"
                echo ""
                echo "Opzioni:"
                echo "  --full, -f      Deploy completo"
                echo "  --quick, -q     Deploy veloce"
                echo "  --build, -b     Solo build"
                echo "  --status, -s    Visualizza status"
                echo "  --help, -h      Mostra questo aiuto"
                echo ""
                echo "Senza argomenti: mostra menu interattivo"
                ;;
            *)
                print_error "Opzione non valida: $1"
                echo "Usa --help per vedere le opzioni disponibili"
                exit 1
                ;;
        esac
    else
        # Nessun argomento: mostra menu
        show_main_menu
    fi
}

# Avvia lo script
main "$@"