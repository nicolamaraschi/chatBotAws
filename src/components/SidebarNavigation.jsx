import React from 'react';
import PropTypes from 'prop-types';
import SapDashboard from '../pages/SapDashboard';
import ChatComponent from '../ChatComponent';
import AgendaView from '../pages/AgendaView'; // This will be created later
import ErrorBoundary from './ErrorBoundary';
import './SidebarNavigation.css'; // This will be created next

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
  user // Pass the user object for ChatComponent
}) => {
  return (
    <div className="sidebar-layout">
      <div className="sidebar-nav">
        <button
          className={activeView === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeView === 'chatbot' ? 'active' : ''}
          onClick={() => setActiveView('chatbot')}
        >
          Chatbot
        </button>
        <button
          className={activeView === 'agenda' ? 'active' : ''}
          onClick={() => setActiveView('agenda')}
        >
          Agenda
        </button>
      </div>
      <div className="main-content-area">
        {activeView === 'dashboard' && (
          <section className="dashboard-section">
            <ErrorBoundary>
              <SapDashboard
                onBackgroundChange={onBackgroundChange}
                onLogout={onLogout}
                userRole={userRole}
                userClientName={userClientName}
                isChatCollapsed={isChatCollapsed}
                toggleChatCollapse={toggleChatCollapse}
              />
            </ErrorBoundary>
          </section>
        )}
        {activeView === 'chatbot' && (
          <section className="chat-section">
            <ErrorBoundary>
              {user && user.username ? (
                <ChatComponent
                  user={user}
                  onConfigEditorClick={onConfigEditorClick}
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
        )}
        {activeView === 'agenda' && (
          <section className="agenda-section">
            <ErrorBoundary>
              <AgendaView
                userRole={userRole}
                userClientName={userClientName}
                user={user} // Pass user for potential API calls
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
