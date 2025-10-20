import { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { TopNavigation } from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import { ResizableBox } from 'react-resizable';
import { fetchUserAttributes } from '@aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import './styles/chart-fixes.css';

import '@aws-amplify/ui-react/styles.css';
import './App.css';
import './styles/theme.css';
import './dashboard-theme.css';
import 'react-resizable/css/styles.css';
import './styles/MobileLayout.css'; // Import mobile styles

import ChatComponent from './ChatComponent';
import ConfigComponent from './ConfigComponent';
import SapDashboard from './pages/SapDashboard';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import SidebarNavigation from './components/SidebarNavigation';
import BackgroundSelectorEnhanced from './pages/BackgroundSelectorEnhanced'; // Importa il componente per il cambio sfondo

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false); // Stato per gestire l'apertura del selettore di sfondo

  useEffect(() => {
    // Controlla se esiste già una configurazione
    const storedConfig = localStorage.getItem('appConfig');
    
    if (!storedConfig && !isEditingConfig) {
      // Configurazione predefinita
      const defaultConfig = {
        cognito: {
          region: "eu-west-1",
          userPoolId: "eu-west-1_7WLST1Mlg",
          userPoolClientId: "vpscdsoro31v6hioq7e52ktkv",
          identityPoolId: "eu-west-1:36d062f2-d4f0-4b1d-ba60-5ce34cf991cc"
        },
        bedrock: {
          agentName: "SAPReportAnalyst",
          agentId: "93BV0V6G4L",
          agentAliasId: "TSTALIASID",
          region: "eu-west-1"
        }
      };
      
      // Salva in localStorage
      localStorage.setItem('appConfig', JSON.stringify(defaultConfig));
      setIsConfigured(true);
      
      // Configura Amplify
      Amplify.configure({
        Auth: {
          Cognito: {
            region: defaultConfig.cognito.region,
            userPoolId: defaultConfig.cognito.userPoolId,
            userPoolClientId: defaultConfig.cognito.userPoolClientId,
            identityPoolId: defaultConfig.cognito.identityPoolId
          }
        }
      });
      console.log("Configurazione predefinita applicata automaticamente");
    } else if (storedConfig && !isEditingConfig) {
      // Codice esistente per configurare quando esiste già storage
      setIsConfigured(true);
      try {
        const config = JSON.parse(storedConfig);
        Amplify.configure({
          Auth: {
            Cognito: {
              region: config.cognito.region,
              userPoolId: config.cognito.userPoolId,
              userPoolClientId: config.cognito.userPoolClientId,
              identityPoolId: config.cognito.identityPoolId
            }
          }
        });
      } catch (e) {
        console.error("Error configuring Amplify:", e);
      }
    }
    
    const storedBg = localStorage.getItem('backgroundImage');
    if (storedBg) {
      setBackgroundImage(storedBg);
    }
  }, [isEditingConfig]);

  const handleConfigSet = () => {
    setIsConfigured(true);
  };

  // Funzione aggiornata per gestire l'apertura del selettore o l'applicazione diretta dello sfondo
  const handleBackgroundChange = (newBg) => {
    if (newBg === undefined) {
      // Se chiamato senza parametri, apri il selettore
      setIsBgSelectorOpen(true);
    } else {
      // Altrimenti, imposta direttamente il nuovo sfondo
      setBackgroundImage(newBg);
      localStorage.setItem('backgroundImage', newBg);
    }
  };

  // Definizione corretta di backgroundStyle con controllo del tipo
  const backgroundStyle = backgroundImage 
    ? (typeof backgroundImage === 'string' && backgroundImage.startsWith('color:')
        ? { backgroundColor: backgroundImage.substring(6) } 
        : { backgroundImage: `url(${backgroundImage})` }) 
    : {};

  // Effect per gestire la classe CSS per i colori di sfondo
  useEffect(() => {
    // Aggiungi o rimuovi classe CSS per disattivare i gradienti predefiniti
    if (backgroundImage && typeof backgroundImage === 'string' && backgroundImage.startsWith('color:')) {
      document.body.classList.add('custom-background-color');
    } else {
      document.body.classList.remove('custom-background-color');
    }
  }, [backgroundImage]);

  return (
    <ThemeProvider>
      <div className="app-background" style={{
        ...backgroundStyle,
        position: 'relative', 
        zIndex: 1
      }}>
        {!isConfigured || isEditingConfig ? (
          <ConfigComponent 
            onConfigSet={handleConfigSet} 
            isEditingConfig={isEditingConfig} 
            setEditingConfig={setIsEditingConfig}
          />
        ) : (
          <Authenticator.Provider>
            <ErrorBoundary>
              <AuthenticatedComponent 
                onEditConfigClick={() => setIsEditingConfig(true)} 
                onBackgroundChange={handleBackgroundChange}
                isBgSelectorOpen={isBgSelectorOpen}
                setIsBgSelectorOpen={setIsBgSelectorOpen} 
              />
            </ErrorBoundary>
          </Authenticator.Provider>
        )}
      </div>
    </ThemeProvider>
  );
}

const AuthenticatedComponent = ({ 
  onEditConfigClick, 
  onBackgroundChange, 
  isBgSelectorOpen,
  setIsBgSelectorOpen 
}) => {
  const { user, authStatus, signOut } = useAuthenticator((context) => [context.user, context.authStatus, context.signOut]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [userRole, setUserRole] = useState(undefined);
  const [userClientName, setUserClientName] = useState(undefined);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'chatbot', or 'agenda'

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleChatCollapse = () => {
    setIsChatCollapsed(!isChatCollapsed);
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      const loadUserAttributes = async () => {
        try {
          // Aspetta che user sia disponibile
          let attempts = 0;
          const maxAttempts = 20; // 4 secondi totali
          
          while ((!user || !user.username) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
          }
          
          if (!user || !user.username) {
            // Forza un refresh come workaround
            window.location.reload();
            return;
          }
          
          const attributes = await fetchUserAttributes();
          const role = attributes['custom:ruolo'] || 'admin';
          const clientName = attributes['custom:nomeCliente'];
          
          setUserRole(role);
          setUserClientName(clientName);
          
          // Attendi un momento per assicurarti che tutto sia pronto
          setTimeout(() => {
            setIsInitializing(false);
          }, 300);
        } catch (e) {
          console.error("Error fetching user attributes:", e);
          setUserRole('admin');
          // Anche in caso di errore, continua dopo un timeout
          setTimeout(() => {
            setIsInitializing(false);
          }, 500);
        }
      };
      loadUserAttributes();
    }
  }, [authStatus, user]);

  useEffect(() => {
    setIsAuthenticating(authStatus === 'processing');
  }, [authStatus]);

  const authComponents = {
    Header() {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
         
        </div>
      );
    }
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="centered-container">
        <div style={{ width: '600px', transform: 'scale(1.1)', transformOrigin: 'center' }}>
          <Authenticator hideSignUp={true} components={authComponents}>
            {isAuthenticating ? (
              <div>Authenticating...</div>
            ) : (
              <div className="tool-bar">
                Please sign in to use the application
              </div>
            )}
          </Authenticator>
        </div>
      </div>
    );
  }

  // Mostra loader durante l'inizializzazione
  if (isInitializing || userRole === undefined) {
    return (
      <div className="centered-container">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', fontSize: '1.2rem', color: 'white' }}>
            {isInitializing 
              ? 'Preparazione dashboard...'
              : 'Caricamento permessi utente...'}
          </p>
          {userRole && (
            <small style={{ color: 'rgba(255,255,255,0.7)', marginTop: '10px', display: 'block' }}>
              Ruolo: {userRole === 'admin' ? 'Amministratore' : 'Cliente'}
            </small>
          )}
          <small style={{ color: 'rgba(255,255,255,0.5)', marginTop: '5px', display: 'block', fontSize: '0.9rem' }}>
            Debug: isInit={String(isInitializing)}, userRole={userRole || 'undefined'}, hasUser={String(!!user)}
          </small>
        </div>
      </div>
    );
  }

  // Controllo di sicurezza aggiuntivo
  if (!user || !user.username) {
    return (
      <div className="centered-container">
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2 style={{ color: '#ff6b6b' }}>⚠️ Errore di autenticazione</h2>
          <p>Oggetto utente non disponibile.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Ricarica la pagina
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        onBackgroundChange={onBackgroundChange}
        onLogout={signOut}
        userRole={userRole}
        userClientName={userClientName}
        isChatCollapsed={isChatCollapsed}
        toggleChatCollapse={toggleChatCollapse}
        onConfigEditorClick={onEditConfigClick}
        user={user}
        isMobile={isMobile}
      />
      
      {/* Mostra il selettore di sfondo quando necessario */}
      {isBgSelectorOpen && (
        <BackgroundSelectorEnhanced
          onBackgroundChange={(newBg) => {
            onBackgroundChange(newBg);
            setIsBgSelectorOpen(false);
          }}
          onClose={() => setIsBgSelectorOpen(false)} 
        />
      )}
    </>
  );
};

AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired,
  onBackgroundChange: PropTypes.func.isRequired,
  isBgSelectorOpen: PropTypes.bool.isRequired,
  setIsBgSelectorOpen: PropTypes.func.isRequired
};

export default App;