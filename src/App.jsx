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

import ChatComponent from './ChatComponent';
import ConfigComponent from './ConfigComponent';
import SapDashboard from './pages/SapDashboard';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');

  useEffect(() => {
    const storedConfig = localStorage.getItem('appConfig');
    if (storedConfig && !isEditingConfig) {
      setIsConfigured(true);
      // Configura Amplify immediatamente
      try {
        const config = JSON.parse(storedConfig);
        Amplify.configure({
          Auth: {
            Cognito: {
              region: config.cognito.region,
              userPoolId: config.cognito.userPoolId,
              userPoolClientId: config.cognito.userPoolClientId,
              identityPoolId: config.cognito.identityPoolId
            },
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

  const handleBackgroundChange = (newBg) => {
    setBackgroundImage(newBg);
    localStorage.setItem('backgroundImage', newBg);
  };

  const backgroundStyle = backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {};

  return (
    <ThemeProvider>
      <div className="app-background" style={backgroundStyle}>
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
              />
            </ErrorBoundary>
          </Authenticator.Provider>
        )}
      </div>
    </ThemeProvider>
  );
}

const AuthenticatedComponent = ({ onEditConfigClick, onBackgroundChange }) => {
  const { user, authStatus, signOut } = useAuthenticator((context) => [context.user, context.authStatus, context.signOut]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [userRole, setUserRole] = useState(undefined);
  const [userClientName, setUserClientName] = useState(undefined);
  const [isInitializing, setIsInitializing] = useState(true);

  const toggleChatCollapse = () => {
    setIsChatCollapsed(!isChatCollapsed);
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      const loadUserAttributes = async () => {
        try {
          console.log('🔄 Waiting for user object...');
          
          // IMPORTANTE: Aspetta che user sia disponibile
          let attempts = 0;
          const maxAttempts = 20; // 4 secondi totali
          
          while ((!user || !user.username) && attempts < maxAttempts) {
            console.log(`⏳ Attempt ${attempts + 1}/${maxAttempts} - User not ready yet`);
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
          }
          
          if (!user || !user.username) {
            console.error('❌ User object not available after waiting');
            // Forza un refresh come workaround
            console.log('🔄 Force reloading page...');
            window.location.reload();
            return;
          }
          
          console.log('🔄 Loading user attributes...');
          console.log('👤 User object:', { username: user.username, userId: user.userId });
          
          const attributes = await fetchUserAttributes();
          const role = attributes['custom:ruolo'] || 'admin';
          const clientName = attributes['custom:nomeCliente'];
          
          console.log('✅ User attributes loaded:', { role, clientName });
          setUserRole(role);
          setUserClientName(clientName);
          
          // Attendi un momento per assicurarti che tutto sia pronto
          setTimeout(() => {
            setIsInitializing(false);
            console.log('✅ Initialization complete - Ready to render dashboard');
          }, 300);
        } catch (e) {
          console.error("❌ Error fetching user attributes:", e);
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
          <img src="/logoHorsa.jpg" alt="Horsa AI Logo" style={{ width: '450px' }} />
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
    console.error('❌ User object missing despite authentication!');
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

  console.log('🎨 Rendering main application interface');

  return (
    <>
      <TopNavigation
        identity={{
          href: "#",
          title: `Welcome, ${user.username}`,
        }}
        utilities={[
          {
            type: "button",
            iconName: "settings",
            title: "Update settings",
            ariaLabel: "Update settings",
            disableUtilityCollapse: false,
            onClick: onEditConfigClick
          }
        ]}
      />
      <div className="main-layout">
        <section className="dashboard-section">
          <ErrorBoundary>
            <SapDashboard 
              onBackgroundChange={onBackgroundChange} 
              onLogout={signOut} 
              userRole={userRole}
              userClientName={userClientName}
              isChatCollapsed={isChatCollapsed}
              toggleChatCollapse={toggleChatCollapse}
            />
          </ErrorBoundary>
        </section>
        
        <ResizableBox 
          className="chat-section-resizable"
          width={isChatCollapsed ? 0 : window.innerWidth * 0.25} 
          axis="x"
          minConstraints={[isChatCollapsed ? 0 : 300, Infinity]}
          maxConstraints={[window.innerWidth * 0.8, Infinity]}
          resizeHandles={['w']}
        >
          <section className="chat-section">
            <ErrorBoundary>
              {user && user.username ? (
                <ChatComponent 
                  user={user} 
                  onConfigEditorClick={onEditConfigClick}
                  isChatCollapsed={isChatCollapsed}
                  toggleChatCollapse={toggleChatCollapse}
                />
              ) : (
                <div className="centered-container" style={{ height: '100%' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '20px', color: '#666' }}>
                    Caricamento chat...
                  </p>
                </div>
              )}
            </ErrorBoundary>
          </section>
        </ResizableBox>
      </div>
    </>
  );
}

AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired,
  onBackgroundChange: PropTypes.func.isRequired
};

export default App;