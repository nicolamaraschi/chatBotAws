#!/bin/bash

# ==============================================================================
# SCRIPT PER PUBBLICARE IMMAGINI SU AWS ECR ESISTENTI CON VERSIONAMENTO
# ==============================================================================

# Imposta colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Repository ECR già creati
AWS_REGION="eu-west-1"
AWS_ACCOUNT_ID="593740920040"
ECR_REPO_FRONTEND="hrun/sap-dashboard-frontend"
ECR_REPO_BACKEND="hrun/sap-dashboard-backend"
ECR_URI_FRONTEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_FRONTEND"
ECR_URI_BACKEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_BACKEND"

# Funzione per determinare la prossima versione
get_next_version() {
    local repo=$1
    local latest_version=0
    
    # Ottieni tutte le versioni esistenti che iniziano con v
    echo "Recupero versioni esistenti per $repo..."
    local versions=$(aws ecr describe-images --repository-name "$repo" --region "$AWS_REGION" --query 'imageDetails[].imageTags[]' --output text | grep -E "^v[0-9]+" || echo "")
    
    if [ -n "$versions" ]; then
        # Estrai il numero più alto
        latest_version=$(echo "$versions" | sed 's/v//g' | sort -n | tail -1 || echo "0")
    fi
    
    # Incrementa di 1
    local next_version=$((latest_version + 1))
    echo "v$next_version"
}

# Funzioni di utilità
print_section() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Verifica AWS CLI e Docker
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI non trovato. Installalo con 'pip install awscli'"
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker non trovato. Installalo seguendo le istruzioni su https://docs.docker.com/get-docker/"
fi

# Richiedi percorsi frontend e backend
print_section "Configurazione percorsi"
read -p "Percorso cartella frontend: " FRONTEND_PATH
read -p "Percorso cartella backend: " BACKEND_PATH

# Autenticazione a ECR
print_section "Autenticazione a AWS ECR"
print_info "Autenticazione a ECR nella regione $AWS_REGION..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

if [ $? -ne 0 ]; then
    print_error "Autenticazione ECR fallita"
fi
print_success "Autenticazione ECR riuscita"

# Build e push immagine frontend
print_section "Build e Push Frontend"
# Verifica che la directory esista
if [ ! -d "$FRONTEND_PATH" ]; then
    print_error "La directory del frontend $FRONTEND_PATH non esiste"
fi

# Determina la prossima versione per il frontend
FRONTEND_VERSION=$(get_next_version "$ECR_REPO_FRONTEND")
print_info "Nuova versione frontend: $FRONTEND_VERSION"

# Vai nella directory del frontend
cd "$FRONTEND_PATH"

# Build immagine Docker
print_info "Building immagine Docker frontend..."
docker build -t "$ECR_REPO_FRONTEND:latest" -t "$ECR_REPO_FRONTEND:$FRONTEND_VERSION" .

if [ $? -ne 0 ]; then
    print_error "Build frontend fallito"
fi
print_success "Build frontend completato"

# Tag immagini per ECR
print_info "Tagging immagini Docker frontend..."
docker tag "$ECR_REPO_FRONTEND:latest" "$ECR_URI_FRONTEND:latest"
docker tag "$ECR_REPO_FRONTEND:$FRONTEND_VERSION" "$ECR_URI_FRONTEND:$FRONTEND_VERSION"

# Push immagini a ECR
print_info "Pushing immagine Docker frontend a ECR..."
docker push "$ECR_URI_FRONTEND:latest"
docker push "$ECR_URI_FRONTEND:$FRONTEND_VERSION"

if [ $? -ne 0 ]; then
    print_error "Push frontend a ECR fallito"
fi
print_success "Push frontend a ECR completato"

# Build e push immagine backend
print_section "Build e Push Backend"
# Verifica che la directory esista
if [ ! -d "$BACKEND_PATH" ]; then
    print_error "La directory del backend $BACKEND_PATH non esiste"
fi

# Determina la prossima versione per il backend
BACKEND_VERSION=$(get_next_version "$ECR_REPO_BACKEND")
print_info "Nuova versione backend: $BACKEND_VERSION"

# Vai nella directory del backend
cd "$BACKEND_PATH"

# Build immagine Docker
print_info "Building immagine Docker backend..."
docker build -t "$ECR_REPO_BACKEND:latest" -t "$ECR_REPO_BACKEND:$BACKEND_VERSION" .

if [ $? -ne 0 ]; then
    print_error "Build backend fallito"
fi
print_success "Build backend completato"

# Tag immagini per ECR
print_info "Tagging immagini Docker backend..."
docker tag "$ECR_REPO_BACKEND:latest" "$ECR_URI_BACKEND:latest"
docker tag "$ECR_REPO_BACKEND:$BACKEND_VERSION" "$ECR_URI_BACKEND:$BACKEND_VERSION"

# Push immagini a ECR
print_info "Pushing immagine Docker backend a ECR..."
docker push "$ECR_URI_BACKEND:latest"
docker push "$ECR_URI_BACKEND:$BACKEND_VERSION"

if [ $? -ne 0 ]; then
    print_error "Push backend a ECR fallito"
fi
print_success "Push backend a ECR completato"

# Riepilogo
print_section "Riepilogo"
print_success "Frontend pubblicato su: $ECR_URI_FRONTEND:latest e $ECR_URI_FRONTEND:$FRONTEND_VERSION"
print_success "Backend pubblicato su: $ECR_URI_BACKEND:latest e $ECR_URI_BACKEND:$BACKEND_VERSION"

# Menu opzioni di distribuzione
print_section "Opzioni di Distribuzione"
echo "Cosa vuoi fare dopo la pubblicazione delle immagini?"
echo "1) Distribuire su EC2 (crea script di setup)"
echo "2) Distribuire su ECS (preparare i task definition)"
echo "3) Distribuire su Elastic Beanstalk"
echo "4) Uscire (solo push completato)"
echo ""
read -p "Scelta (1-4): " deploy_choice

case $deploy_choice in
    1)
        # Distribuzione su EC2
        print_section "Distribuzione su AWS EC2"
        read -p "ID dell'istanza EC2 (es. i-1234567890abcdef0): " EC2_INSTANCE_ID
        
        if [ -z "$EC2_INSTANCE_ID" ]; then
            print_error "ID istanza EC2 non fornito"
        fi
        
        # Genera script di setup EC2
        cat > ec2-setup.sh <<EOF
#!/bin/bash

# Installa Docker se non è già installato
if ! command -v docker &> /dev/null; then
    echo "Installazione Docker..."
    sudo yum update -y
    sudo amazon-linux-extras install docker -y
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    sudo systemctl enable docker
fi

# Autenticazione a ECR
echo "Autenticazione a ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Pull immagine frontend
echo "Pull immagine frontend..."
docker pull $ECR_URI_FRONTEND:latest

# Pull immagine backend
echo "Pull immagine backend..."
docker pull $ECR_URI_BACKEND:latest

# Ferma container esistenti se presenti
docker rm -f frontend-container 2>/dev/null || true
docker rm -f backend-container 2>/dev/null || true

# Avvia container backend
echo "Avvio container backend..."
docker run -d --name backend-container -p 3000:3000 $ECR_URI_BACKEND:latest

# Avvia container frontend
echo "Avvio container frontend..."
docker run -d --name frontend-container -p 80:80 $ECR_URI_FRONTEND:latest

echo "Deployment completato!"
EOF

        chmod +x ec2-setup.sh
        print_success "Script ec2-setup.sh creato"
        print_info "Per completare la distribuzione su EC2:"
        print_info "1. Copia lo script ec2-setup.sh sull'istanza EC2"
        print_info "2. Connettiti all'istanza EC2: ssh -i tua-chiave.pem ec2-user@tuo-ec2-dns"
        print_info "3. Esegui lo script: ./ec2-setup.sh"
        print_info "4. Assicurati che i gruppi di sicurezza permettano il traffico sulle porte 80 e 3000"
        ;;
    2)
        # Distribuzione su ECS
        print_section "Distribuzione su AWS ECS"
        read -p "Nome del cluster ECS (lascia vuoto per default): " ECS_CLUSTER
        
        if [ -z "$ECS_CLUSTER" ]; then
            ECS_CLUSTER="sap-dashboard-cluster"
        fi
        
        # Creazione task definition per frontend
        cat > frontend-task-def.json <<EOF
{
  "family": "frontend-task",
  "networkMode": "awsvpc",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend-container",
      "image": "$ECR_URI_FRONTEND:$FRONTEND_VERSION",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "hostPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/frontend-task",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": [
    "FARGATE"
  ],
  "cpu": "256",
  "memory": "512"
}
EOF

        # Creazione task definition per backend
        cat > backend-task-def.json <<EOF
{
  "family": "backend-task",
  "networkMode": "awsvpc",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend-container",
      "image": "$ECR_URI_BACKEND:$BACKEND_VERSION",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/backend-task",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": [
    "FARGATE"
  ],
  "cpu": "256",
  "memory": "512"
}
EOF

        print_success "Task definition per frontend e backend create"
        print_info "Per registrare le task definition e creare i servizi ECS:"
        print_info "1. Registra le task definition:"
        print_info "   aws ecs register-task-definition --cli-input-json file://frontend-task-def.json --region $AWS_REGION"
        print_info "   aws ecs register-task-definition --cli-input-json file://backend-task-def.json --region $AWS_REGION"
        print_info "2. Crea un cluster ECS (se non esiste):"
        print_info "   aws ecs create-cluster --cluster-name $ECS_CLUSTER --region $AWS_REGION"
        print_info "3. Crea i servizi ECS per frontend e backend usando la console AWS o CLI"
        ;;
    3)
        # Distribuzione su Elastic Beanstalk
        print_section "Distribuzione su AWS Elastic Beanstalk"
        print_info "Preparazione dei file per Elastic Beanstalk..."
        
        # Crea file Dockerrun.aws.json
        cat > Dockerrun.aws.json <<EOF
{
  "AWSEBDockerrunVersion": "3",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "$ECR_URI_FRONTEND:$FRONTEND_VERSION",
      "essential": true,
      "memory": 256,
      "portMappings": [
        {
          "hostPort": 80,
          "containerPort": 80
        }
      ]
    },
    {
      "name": "backend",
      "image": "$ECR_URI_BACKEND:$BACKEND_VERSION",
      "essential": true,
      "memory": 256,
      "portMappings": [
        {
          "hostPort": 3000,
          "containerPort": 3000
        }
      ]
    }
  ]
}
EOF

        # Crea directory .ebextensions
        mkdir -p .ebextensions
        
        # Crea file di configurazione per EB
        cat > .ebextensions/00-options.config <<EOF
option_settings:
  aws:elasticbeanstalk:environment:
    EnvironmentType: LoadBalanced
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx
EOF

        print_success "File di configurazione EB creati"
        print_info "Per distribuire con Elastic Beanstalk:"
        print_info "1. Installa l'EB CLI se non l'hai già: pip install awsebcli"
        print_info "2. Inizializza un'applicazione EB: eb init -p docker -r $AWS_REGION sap-dashboard"
        print_info "3. Crea l'ambiente: eb create sap-dashboard-env"
        print_info "4. Oppure distribuisci su un ambiente esistente: eb deploy"
        ;;
    4)
        print_info "Uscita. Le immagini sono state pubblicate su ECR con successo."
        ;;
    *)
        print_error "Scelta non valida"
        ;;
esac

echo ""
echo -e "${GREEN}Processo completato con successo!${NC}"