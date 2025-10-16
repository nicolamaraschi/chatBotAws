// SidebarNavigation.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import DashboardWithChat from '../pages/DashboardWithChat';
import ChatComponent from '../ChatComponent';
import AgendaView from '../pages/AgendaView';
import ErrorBoundary from './ErrorBoundary';
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
  user
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  // Gestisce il ridimensionamento della finestra
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
      // In modalità mobile, la sidebar non deve essere collassata
      if (window.innerWidth <= 1024) {
        setSidebarCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Icone per i menu
  const menuIcons = {
    dashboard: <i className="menu-icon fas fa-chart-line"></i>,
    chatbot: <i className="menu-icon fas fa-comments"></i>,
    agenda: <i className="menu-icon fas fa-calendar-alt"></i>,
    settings: <i className="menu-icon fas fa-cog"></i>
  };

  return (
    <div className={`sidebar-layout ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className={`sidebar-nav ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            {!sidebarCollapsed && <span className="app-logo">APP</span>}
          </div>
          {!isMobile && (
            <button 
              className="toggle-sidebar" 
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
            >
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
            title="Chatbot"
          >
            {menuIcons.chatbot}
            {!sidebarCollapsed && <span className="btn-text">Chatbot</span>}
            {!sidebarCollapsed && <span className="badge">3</span>}
          </button>
          <button
            className={activeView === 'agenda' ? 'active' : ''}
            onClick={() => setActiveView('agenda')}
            title="Agenda"
          >
            {menuIcons.agenda}
            {!sidebarCollapsed && <span className="btn-text">Agenda</span>}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="user-profile">
            <div className="avatar">{user?.username?.charAt(0) || 'U'}</div>
            <div className="user-info">
              <div className="username">{user?.username || 'User'}</div>
              <div className="role">{userRole || 'Guest'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="main-content-area">
        {activeView === 'dashboard' && (
          <DashboardWithChat
            onBackgroundChange={onBackgroundChange}
            onLogout={onLogout}
            userRole={userRole}
            userClientName={userClientName}
            user={user}
            onConfigEditorClick={onConfigEditorClick}
            isChatCollapsed={isChatCollapsed}
            toggleChatCollapse={toggleChatCollapse}
          />
        )}
        {activeView === 'chatbot' && (
          <section className="chat-section">
            <ErrorBoundary>
              {user && user.username ? (
                <ChatComponent
                  user={user}
                  onConfigEditorClick={onConfigEditorClick}
                  isChatCollapsed={false} /* Always expanded in full-screen view */
                  toggleChatCollapse={toggleChatCollapse} /* Pass the main toggle function */
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
};

export default SidebarNavigation;