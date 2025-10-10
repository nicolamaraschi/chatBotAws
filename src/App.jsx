// Import necessary dependencies and components
import { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { TopNavigation } from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import { ResizableBox } from 'react-resizable';

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

  useEffect(() => {
    const storedConfig = localStorage.getItem('appConfig');
    if (storedConfig && !isEditingConfig) {
      setIsConfigured(true);
    }
  }, [isEditingConfig]);

  const handleConfigSet = () => {
    setIsConfigured(true);
  };

  return (
    <ThemeProvider>
      <div>
        {!isConfigured || isEditingConfig ? (
          <ConfigComponent 
            onConfigSet={handleConfigSet} 
            isEditingConfig={isEditingConfig} 
            setEditingConfig={setIsEditingConfig} 
          />
        ) : (
          <Authenticator.Provider>
            <AuthenticatedComponent onEditConfigClick={() => setIsEditingConfig(true)} />
          </Authenticator.Provider>
        )}
      </div>
    </ThemeProvider>
  );
}

const AuthenticatedComponent = ({ onEditConfigClick }) => {
  const { user, authStatus } = useAuthenticator((context) => [context.user, context.authStatus]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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

  if (!user) {
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

  return (
    <div className="main-layout">
      <section className="dashboard-section">
        <SapDashboard />
      </section>
      
      <ResizableBox 
        className="chat-section-resizable"
        width={window.innerWidth * 0.25} 
        height={0}
        axis="x"
        minConstraints={[300, 0]}
        maxConstraints={[window.innerWidth * 0.8, Infinity]}
        resizeHandles={['w']}
      >
        <section className="chat-section">
          <ChatComponent user={user} onLogout={() => setIsAuthenticating(false)} onConfigEditorClick={onEditConfigClick}/>
        </section>
      </ResizableBox>
    </div>
  );
}

AuthenticatedComponent.propTypes = {
  onEditConfigClick: PropTypes.func.isRequired
};

export default App;
