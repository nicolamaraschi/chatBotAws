import { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { TopNavigation } from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import { ResizableBox } from 'react-resizable';
import { fetchUserAttributes } from '@aws-amplify/auth';

import '@aws-amplify/ui-react/styles.css';
import './App.css';
import './styles/theme.css';
import 'react-resizable/css/styles.css'; // Styles for resizable box

import ChatComponent from './ChatComponent';
import ConfigComponent from './ConfigComponent';
import SapDashboard from './pages/SapDashboard'; // Import the dashboard
import { ThemeProvider } from './context/ThemeContext'; // Import ThemeProvider

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');

  useEffect(() => {
    const storedConfig = localStorage.getItem('appConfig');
    if (storedConfig && !isEditingConfig) {
      setIsConfigured(true);
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
            <AuthenticatedComponent 
              onEditConfigClick={() => setIsEditingConfig(true)} 
              onBackgroundChange={handleBackgroundChange} 
            />
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

  const toggleChatCollapse = () => {
    setIsChatCollapsed(!isChatCollapsed);
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      const loadUserAttributes = async () => {
        try {
          const attributes = await fetchUserAttributes();
          setUserRole(attributes['custom:ruolo'] || 'admin'); // Default to admin if attribute is missing
          setUserClientName(attributes['custom:nomeCliente']);
        } catch (e) {
          console.error("Error fetching user attributes:", e);
          setUserRole('admin'); // Default to admin on error for safety
        }
      };
      loadUserAttributes();
    }
  }, [authStatus]);

  useEffect(() => {
    setIsAuthenticating(authStatus === 'processing');
  }, [authStatus]);

  const components = {
    Header() {
      return (
        <div>
          <TopNavigation
            identity={{
              href: "#",
              title: `Welcome`,
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
        </div>
      );
    }
  }

  if (authStatus !== 'authenticated') {
    return (
      <div className="centered-container">
        <img src="/logoHorsa.jpg" alt="Horsa AI Logo" style={{ width: '400px', margin: '20px auto', display: 'block' }} />
        <Authenticator hideSignUp={true} components={components}>
          {isAuthenticating ? (
            <div>Authenticating...</div>
          ) : (
            <div className="tool-bar">
              Please sign in to use the application
            </div>
          )}
        </Authenticator>
      </div>
    );
  }

  // ATTENDI che gli attributi utente siano caricati prima di renderizzare la dashboard
  if (userRole === undefined) {
    return <div className="centered-container">Loading user permissions...</div>;
  }

  return (
    <div className="main-layout">
      <section className="dashboard-section">
        <SapDashboard 
          onBackgroundChange={onBackgroundChange} 
          onLogout={signOut} 
          userRole={userRole}
          userClientName={userClientName}
        />
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
          <ChatComponent 
            user={user} 
            onConfigEditorClick={onEditConfigClick}
            isChatCollapsed={isChatCollapsed}
            toggleChatCollapse={toggleChatCollapse}
          />
        </section>
      </ResizableBox>
    </div>
  );
}

AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired,
  onBackgroundChange: PropTypes.func.isRequired
};

export default App;
