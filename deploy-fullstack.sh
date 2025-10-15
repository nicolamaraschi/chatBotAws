#!/bin/bash

# ==============================================================================
# SCRIPT DI DEPLOY FULLSTACK (FRONTEND + BACKEND) SU AWS AMPLIFY
# ==============================================================================

# Colori per l'output
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
CYAN="\033[0;36m"
BLUE="\033[0;34m"
PURPLE="\033[0;35m"
NC="\033[0m" # No Color

# Variabili di configurazione
PROJECT_NAME="chatBotAws"
ENV_NAME="dev"
REGION="eu-west-1"
BRANCH="agenda"
GITHUB_REPO="https://github.com/nicolamaraschi/chatBotAws"

# Variabili per il Frontend (Build)
VITE_COGNITO_USER_POOL_ID="eu-west-1_7WLST1Mlg"
VITE_COGNITO_USER_POOL_CLIENT_ID="vpscdsoro31v6hioq7e52ktkv"
VITE_COGNITO_REGION="eu-west-1"
VITE_COGNITO_IDENTITY_POOL_ID="eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc"
VITE_BEDROCK_AGENT_NAME="SAPReportAnalyst"
VITE_BEDROCK_AGENT_ID="93BV0V6G4L"
VITE_BEDROCK_AGENT_ALIAS_ID="TSTALIASID"
VITE_BEDROCK_REGION="eu-west-1"
VITE_API_URL="https://basis.ai.horsacloudtech.net:3001"

# Credenziali AWS per il Backend
AWS_ACCESS_KEY_ID="AKIAYUPNXOTUGBWSCUEJ"
AWS_SECRET_ACCESS_KEY="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"
# AWS_SESSION_TOKEN è opzionale, decommentare se necessario
# AWS_SESSION_TOKEN="INSERISCI_QUI_IL_TOKEN_SE_NECESSARIO"

# ==============================================================================
# FUNZIONI DI UTILITÀ
# ==============================================================================

print_banner() {
    clear
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}             DEPLOY FULLSTACK AWS AMPLIFY                      ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${YELLOW}╔════ $1 ════${NC}"
    echo ""
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

confirm_action() {
    echo -e "${YELLOW}$1 [s/N]${NC} "
    read -p "" response
    if [[ "$response" =~ ^([sS][iI]|[sS])$ ]]; then
        return 0
    else
        return 1
    fi
}

# ==============================================================================
# VERIFICA PREREQUISITI
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
        if confirm_action "Vuoi installare AWS CLI ora?"; then
            install_aws_cli
        else
            exit 1
        fi
        return 1
    fi
    print_success "AWS CLI $(aws --version | cut -d' ' -f1 | cut -d'/' -f2) OK"
    return 0
}

install_aws_cli() {
    print_info "Installazione AWS CLI..."
    
    case "$(uname -s)" in
        Darwin*)    # macOS
            brew install awscli
            ;;
        Linux*)     # Linux
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
            unzip awscliv2.zip
            sudo ./aws/install
            rm -rf aws awscliv2.zip
            ;;
        *)          # Windows/altro
            print_error "Installazione automatica non supportata sul tuo OS. Installa manualmente."
            exit 1
            ;;
    esac
    
    print_success "AWS CLI installato!"
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
    print_info "Configurazione credenziali AWS..."
    
    # Esporta le credenziali
    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="$REGION"
    
    # Verifica se le credenziali funzionano
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "Credenziali AWS non valide o insufficienti"
        echo ""
        echo "Verifica che le credenziali siano corrette e abbiano i permessi necessari."
        if confirm_action "Vuoi configurare manualmente le credenziali?"; then
            aws configure
        else
            exit 1
        fi
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local user_arn=$(aws sts get-caller-identity --query Arn --output text)
    
    print_success "Credenziali AWS OK"
    echo "  Account ID: $account_id"
    echo "  User ARN: $user_arn"
}

configure_iam_permissions() {
    print_section "CONFIGURAZIONE PERMESSI IAM"
    
    print_info "Creazione policy per Amplify Fullstack..."
    
    # Nome della policy
    local policy_name="AmplifyFullstackDeployPolicy"
    
    # Crea il documento della policy
    cat > amplify_policy.json << 'EOL'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "amplify:*",
                "s3:*",
                "cloudformation:*",
                "cloudfront:*",
                "route53:*",
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PassRole",
                "lambda:*",
                "apigateway:*",
                "cognito-identity:*",
                "cognito-idp:*",
                "dynamodb:*"
            ],
            "Resource": "*"
        }
    ]
}
EOL

    # Verifica se la policy esiste già
    if aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policy_name" &> /dev/null; then
        print_info "Policy $policy_name già esistente"
    else
        # Crea la policy
        aws iam create-policy --policy-name "$policy_name" --policy-document file://amplify_policy.json
        print_success "Policy $policy_name creata!"
    fi
    
    # Chiedi all'utente se vuole allegare la policy all'utente corrente
    if confirm_action "Vuoi allegare questa policy al tuo IAM User?"; then
        local user_name=$(aws sts get-caller-identity --query UserId --output text | cut -d':' -f2)
        
        if [ -n "$user_name" ]; then
            aws iam attach-user-policy --user-name "$user_name" --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$policy_name"
            print_success "Policy allegata all'utente $user_name!"
        else
            print_warning "Non è stato possibile determinare il nome utente. Collega la policy manualmente."
        fi
    fi
    
    # Rimuovi il file temporaneo
    rm -f amplify_policy.json
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
    
    # Verifica anche le dipendenze del backend
    if [ -d "aws-serverless-app" ]; then
        print_info "Verifica dipendenze backend..."
        if [ ! -d "aws-serverless-app/node_modules" ]; then
            print_warning "node_modules backend non trovati"
            if confirm_action "Vuoi installare le dipendenze backend?"; then
                cd aws-serverless-app && npm install && cd ..
                print_success "Dipendenze backend installate"
            fi
        else
            print_success "Dipendenze backend OK"
        fi
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
    configure_iam_permissions
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
    
    print_info "Esecuzione build frontend..."
    echo ""
    
    # Costruisci il file .env per Vite
    cat > .env << EOL
VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=$VITE_COGNITO_USER_POOL_CLIENT_ID
VITE_COGNITO_REGION=$VITE_COGNITO_REGION
VITE_COGNITO_IDENTITY_POOL_ID=$VITE_COGNITO_IDENTITY_POOL_ID
VITE_BEDROCK_AGENT_NAME=$VITE_BEDROCK_AGENT_NAME
VITE_BEDROCK_AGENT_ID=$VITE_BEDROCK_AGENT_ID
VITE_BEDROCK_AGENT_ALIAS_ID=$VITE_BEDROCK_AGENT_ALIAS_ID
VITE_BEDROCK_REGION=$VITE_BEDROCK_REGION
VITE_API_URL=$VITE_API_URL
EOL
    
    npm run build
    
    echo ""
    
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        print_success "Build frontend completata con successo!"
        
        # Mostra statistiche
        local build_size=$(du -sh dist | cut -f1)
        echo "  Dimensione build: $build_size"
        
        local file_count=$(find dist -type f | wc -l)
        echo "  File generati: $file_count"
    else
        print_error "Build fallita! Directory dist vuota o non esistente"
        exit 1
    fi
    
    # Build del backend se presente
    if [ -d "aws-serverless-app" ]; then
        print_info "Esecuzione build backend..."
        cd aws-serverless-app
        
        # Se il backend ha uno script di build, usalo
        if grep -q "\"build\":" package.json; then
            npm run build
        else
            print_info "Nessuno script di build trovato nel backend, si assume pronto per il deploy"
        fi
        
        cd ..
        print_success "Build backend completata!"
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
                \"useProfile\":false,
                \"accessKeyId\":\"$AWS_ACCESS_KEY_ID\",
                \"secretAccessKey\":\"$AWS_SECRET_ACCESS_KEY\",
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
    
    # Aggiungi hosting
    amplify add hosting <<EOF
Hosting with Amplify Console
Continuous deployment (Git-based deployments)
$GITHUB_REPO
$BRANCH
EOF
    
    print_success "Hosting configurato con integrazione GitHub!"
}

configure_backend() {
    print_section "CONFIGURAZIONE BACKEND"
    
    if ! [ -d "aws-serverless-app" ]; then
        print_warning "Directory backend 'aws-serverless-app' non trovata!"
        print_info "Saltando configurazione backend..."
        return 0
    fi
    
    print_info "Aggiunta API per backend..."
    
    # Aggiungi API
    amplify add api <<EOF
REST
$PROJECT_NAME-api
/api
y
AWS_IAM
n
n
EOF
    
    print_info "Configurazione Lambda Function..."
    
    # Configura funzione Lambda
    amplify add function <<EOF
backendFunction
nodejs
y
aws-serverless-app/server.js
y
n
n
EOF
    
    # Collega la funzione all'API
    print_info "Collegamento API a Lambda..."
    amplify update api <<EOF
$PROJECT_NAME-api
/api
AWS_IAM
Lambda
backendFunction
y
EOF
    
    # Se ci sono dipendenze nel backend, configura script per copiarle
    if [ -f "aws-serverless-app/package.json" ]; then
        print_info "Configurazione dipendenze Lambda..."
        
        # Path della funzione Lambda
        local lambda_path="amplify/backend/function/backendFunction"
        
        # Crea script di build personalizzato
        mkdir -p "$lambda_path/custom-build"
        cat > "$lambda_path/custom-build/index.js" << 'EOL'
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// Copia il file server.js nel build
fs.copySync('../../../../aws-serverless-app/server.js', './build/server.js');

// Copia package.json nel build
fs.copySync('../../../../aws-serverless-app/package.json', './build/package.json');

// Installa dipendenze nel build
console.log('Installazione dipendenze backend...');
execSync('npm ci --production', { cwd: './build', stdio: 'inherit' });

console.log('Build backend completato!');
EOL
        
        # Modifica amplify-meta.json per usare custom build
        local meta_file="$lambda_path/amplify-meta.json"
        if [ -f "$meta_file" ]; then
            # Backup
            cp "$meta_file" "$meta_file.bak"
            
            # Aggiorna il file
            node -e "
            const meta = require('./$meta_file');
            meta.customBuild = true;
            fs.writeFileSync('./$meta_file', JSON.stringify(meta, null, 2));
            "
            
            print_success "Build script personalizzato configurato!"
        fi
    fi
    
    print_success "Backend configurato!"
}

create_amplify_yml() {
    print_section "CREAZIONE AMPLIFY.YML"
    
    cat > amplify.yml << 'EOL'
version: 1
backend:
  phases:
    build:
      commands:
        - amplifyPush --simple
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
EOL
    
    print_success "File amplify.yml creato!"
}

# ==============================================================================
# FUNZIONI DI DEPLOY
# ==============================================================================

deploy_to_amplify() {
    print_section "DEPLOY SU AMPLIFY"
    
    print_info "Avvio deployment..."
    echo ""
    
    # Deploy con Amplify
    amplify push --yes
    
    # Pubblica l'app
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
            echo -e "${GREEN}║  🎉 DEPLOYMENT COMPLETATO CON SUCCESSO!                    ║${NC}"
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
    
    # Istruzioni per GitHub
    print_info "Per completare l'integrazione con GitHub:"
    echo "1. Vai alla console Amplify: https://console.aws.amazon.com/amplify"
    echo "2. Seleziona la tua app '$PROJECT_NAME'"
    echo "3. Vai a 'Hosting' -> 'Connect branch'"
    echo "4. Seleziona il repository GitHub '$GITHUB_REPO'"
    echo "5. Seleziona il branch '$BRANCH'"
    echo "6. Segui le istruzioni per autorizzare AWS Amplify"
    echo ""
    echo "Una volta completata l'integrazione, ogni push su GitHub avvierà automaticamente il deploy!"
}

# ==============================================================================
# FUNZIONI GESTIONE VARIABILI D'AMBIENTE
# ==============================================================================

configure_environment_variables() {
    print_section "CONFIGURAZIONE VARIABILI D'AMBIENTE"
    
    # Ottieni App ID
    local app_id=$(cat amplify/.config/project-config.json 2>/dev/null | grep -o '"appId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$app_id" ]; then
        print_error "App ID non trovato. Esegui prima il deploy."
        return 1
    fi
    
    print_info "Configurazione variabili d'ambiente su Amplify..."
    
    # Costruisci il JSON delle variabili
    local env_vars="{"
    env_vars+="\"VITE_COGNITO_USER_POOL_ID\":\"$VITE_COGNITO_USER_POOL_ID\","
    env_vars+="\"VITE_COGNITO_USER_POOL_CLIENT_ID\":\"$VITE_COGNITO_USER_POOL_CLIENT_ID\","
    env_vars+="\"VITE_COGNITO_REGION\":\"$VITE_COGNITO_REGION\","
    env_vars+="\"VITE_COGNITO_IDENTITY_POOL_ID\":\"$VITE_COGNITO_IDENTITY_POOL_ID\","
    env_vars+="\"VITE_BEDROCK_AGENT_NAME\":\"$VITE_BEDROCK_AGENT_NAME\","
    env_vars+="\"VITE_BEDROCK_AGENT_ID\":\"$VITE_BEDROCK_AGENT_ID\","
    env_vars+="\"VITE_BEDROCK_AGENT_ALIAS_ID\":\"$VITE_BEDROCK_AGENT_ALIAS_ID\","
    env_vars+="\"VITE_BEDROCK_REGION\":\"$VITE_BEDROCK_REGION\","
    env_vars+="\"VITE_API_URL\":\"$VITE_API_URL\""
    env_vars+="}"
    
    aws amplify update-app \
        --app-id "$app_id" \
        --region "$REGION" \
        --environment-variables "$env_vars" > /dev/null
    
    print_success "Variabili d'ambiente configurate!"
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
    echo "  - API e funzioni Lambda"
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
    
    # Step 4: Configurazione Backend (se presente)
    configure_backend
    
    # Step 5: Configurazione Hosting
    configure_hosting
    
    # Step 6: Crea amplify.yml
    create_amplify_yml
    
    # Step 7: Deploy
    deploy_to_amplify
    
    # Step 8: Variabili d'ambiente
    configure_environment_variables
    
    # Step 9: Info finali
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
    configure_environment_variables
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
    
    # Avvia il menu
    show_main_menu
}

# Avvio dello script
main