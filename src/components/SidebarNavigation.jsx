// SidebarNavigation.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DashboardWithChat from '../pages/DashboardWithChat';
import Dashboard from '../pages/Dashboard';
import ChatComponent from '../ChatComponent';
import AgendaView from '../pages/AgendaView';
import ErrorBoundary from './ErrorBoundary';
import './SidebarNavigation.css';
import { useTheme } from '../context/ThemeContext';

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

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Icone per i menu
  const menuIcons = {
    dashboard: <i className="menu-icon fas fa-chart-line"></i>,
    chatbot: <i className="menu-icon fas fa-comments"></i>,
    agenda: <i className="menu-icon fas fa-calendar-alt"></i>,
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

        {/* --- SEZIONE AGGIUNTA --- */}
        <div className="sidebar-actions">
           <button onClick={toggleTheme} title={theme === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro'}>
             <i className={`menu-icon fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
             {!sidebarCollapsed && <span className="btn-text">{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>}
           </button>
           <button onClick={onLogout} title="Logout">
             <i className="menu-icon fas fa-sign-out-alt"></i>
             {!sidebarCollapsed && <span className="btn-text">Logout</span>}
           </button>
        </div>
        {/* --- FINE SEZIONE AGGIUNTA --- */}

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
          isMobile ? (
            <Dashboard
              onBackgroundChange={onBackgroundChange}
              onLogout={onLogout}
              userRole={userRole}
              userClientName={userClientName}
              user={user}
            />
          ) : (
            <DashboardWithChat
              onBackgroundChange={onBackgroundChange}
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