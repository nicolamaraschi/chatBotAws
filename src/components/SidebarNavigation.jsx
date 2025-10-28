import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Dashboard from '../pages/Dashboard';
import DashboardWithChat from '../pages/DashboardWithChat';
import ChatComponent from '../ChatComponent';
import AgendaView from '../pages/AgendaView';
import ErrorBoundary from './ErrorBoundary';
import { useTheme } from '../context/ThemeContext';
import * as AWSAuth from '@aws-amplify/auth';
import './SidebarNavigation.css';

const SidebarNavigation = ({
  activeView,
  setActiveView,
  onBackgroundChange,
  onLogout,
  userRole,
  userClientName,
  isChatCollapsed,
  toggleChatCollapse,
  onConfigEditorClick,
  user,
  isMobile,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [userEmail, setUserEmail] = useState('');

  // Recupera l'email dell'utente da Cognito
  useEffect(() => {
    if (userRole === 'admin' && user) {
      const fetchUserEmail = async () => {
        try {
          const attributes = await AWSAuth.fetchUserAttributes();
          if (attributes && attributes.email) {
            setUserEmail(attributes.email);
          }
        } catch (error) {
          console.error('Errore nel recupero dell\'email:', error);
        }
      };
      fetchUserEmail();
    }
  }, [userRole, user]);
  
  // Funzione per alternare lo stato della sidebar
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // Icons for menu buttons (using Font Awesome)
  const menuIcons = {
    dashboard: <i className="menu-icon fas fa-chart-line"></i>,
    chatbot: <i className="menu-icon fas fa-robot"></i>,
    agenda: <i className="menu-icon fas fa-calendar-alt"></i>,
  };

  // Determina quale informazione visualizzare nella barra laterale
  const getUserDisplayName = () => {
    if (userRole === 'admin') {
      // Per gli admin, mostra l'email se disponibile
      return userEmail || user?.username || 'Admin';
    } else {
      // Per i clienti, mostra il nome del cliente
      return userClientName || user?.username || 'User';
    }
  };

  // Determina quale iniziale utilizzare per l'avatar
  const getAvatarInitial = () => {
    if (userRole === 'admin') {
      // Per gli admin, usa l'iniziale dell'email
      return userEmail ? userEmail.charAt(0).toUpperCase() : (user?.username?.charAt(0) || 'A');
    } else {
      // Per i clienti, usa l'iniziale del nome cliente
      return userClientName ? userClientName.charAt(0).toUpperCase() : (user?.username?.charAt(0) || 'U');
    }
  };

  return (
    <div className={`sidebar-layout ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className={`sidebar-nav ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
           
          </div>
          {!sidebarCollapsed && (
            <button className="toggle-sidebar" onClick={toggleSidebar} title="Toggle sidebar">
              <i className={`fas ${sidebarCollapsed ? 'fa-angle-right' : 'fa-angle-left'}`}></i>
            </button>
          )}
        </div>

        <div className="nav-buttons">
          <button
            className={activeView === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveView('dashboard')}
            title="Dashboard"
          >
            {menuIcons.dashboard}
            {!sidebarCollapsed && <span className="btn-text">Dashboard</span>}
          </button>
          <button
            className={activeView === 'chatbot' ? 'active' : ''}
            onClick={() => setActiveView('chatbot')}
            title="Agent AI"
          >
            {menuIcons.chatbot}
            {!sidebarCollapsed && <span className="btn-text">Agent AI</span>}
          </button>
          <button
            className={activeView === 'agenda' ? 'active' : ''}
            onClick={() => setActiveView('agenda')}
            title="Patching Schedule"
          >
            {menuIcons.agenda}
            {!sidebarCollapsed && <span className="btn-text">Patching Schedule</span>}
          </button>
        </div>

        <div className="sidebar-actions">
           <button onClick={toggleTheme} title={theme === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro'}>
             <i className={`menu-icon fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
             {!sidebarCollapsed && <span className="btn-text">{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>}
           </button>
           
           <button 
             onClick={() => onBackgroundChange()} 
             title="Cambia sfondo"
           >
             <i className="menu-icon fas fa-image"></i>
             {!sidebarCollapsed && <span className="btn-text">Sfondo</span>}
           </button>
           
           <button onClick={onLogout} title="Logout">
             <i className="menu-icon fas fa-sign-out-alt"></i>
             {!sidebarCollapsed && <span className="btn-text">Logout</span>}
           </button>
        </div>

        {!sidebarCollapsed && (
          <div className="user-profile">
            <div className="avatar">{getAvatarInitial()}</div>
            <div className="user-info">
              <div className="username">{getUserDisplayName()}</div>
              <div className="role">{userRole === 'admin' ? 'Amministratore' : 'Cliente'}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Pulsante flottante per riaprire la sidebar quando è collassata */}
      <button 
        className={`sidebar-toggle-float ${sidebarCollapsed ? 'visible' : ''}`} 
        onClick={toggleSidebar} 
        title="Espandi menu"
        aria-label="Espandi menu"
      >
        <i className="fas fa-angle-right"></i>
      </button>

      <div className="main-content-area">
        {activeView === 'dashboard' && (
          isMobile ? (
            <Dashboard
              onBackgroundChange={() => onBackgroundChange()}
              onLogout={onLogout}
              userRole={userRole}
              userClientName={userClientName}
              user={user}
            />
          ) : (
            <DashboardWithChat
              onBackgroundChange={() => onBackgroundChange()}
              onLogout={onLogout}
              userRole={userRole}
              userClientName={userClientName}
              user={user}
              onConfigEditorClick={onConfigEditorClick}
              isChatCollapsed={isChatCollapsed}
              toggleChatCollapse={toggleChatCollapse}
              isMobile={isMobile}
            />
          )
        )}
        {activeView === 'chatbot' && (
          <section className="chat-section-fullscreen">
            <ErrorBoundary>
              {user && user.username ? (
                <ChatComponent
                  user={user}
                  onConfigEditorClick={onConfigEditorClick}
                  isChatCollapsed={false}
                  toggleChatCollapse={() => { }} // Pass an empty function
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
        )}
        {activeView === 'agenda' && (
          <section className="agenda-section">
            <ErrorBoundary>
              <AgendaView
                userRole={userRole}
                userClientName={userClientName}
                user={user}
              />
            </ErrorBoundary>
          </section>
        )}
      </div>
    </div>
  );
};

SidebarNavigation.propTypes = {
  activeView: PropTypes.string.isRequired,
  setActiveView: PropTypes.func.isRequired,
  onBackgroundChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
  isChatCollapsed: PropTypes.bool.isRequired,
  toggleChatCollapse: PropTypes.func.isRequired,
  onConfigEditorClick: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  isMobile: PropTypes.bool.isRequired,
};

export default SidebarNavigation;