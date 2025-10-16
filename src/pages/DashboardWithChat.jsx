// DashboardWithChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import SapDashboard from './SapDashboard';
import ChatComponent from '../ChatComponent';
import ErrorBoundary from '../components/ErrorBoundary';
import './DashboardWithChat.css';

const DashboardWithChat = ({
  onBackgroundChange,
  onLogout,
  userRole,
  userClientName,
  user,
  onConfigEditorClick,
  isChatCollapsed,
  toggleChatCollapse,
}) => {
  const [chatWidth, setChatWidth] = useState(450); // Larghezza predefinita della chat
  const startX = useRef(0);
  const startWidth = useRef(0);
  const isResizing = useRef(false);
  const chatContainerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Funzione per iniziare il ridimensionamento
  const startResize = (e) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = chatContainerRef.current.offsetWidth;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Funzione per effettuare il ridimensionamento
  const resize = (e) => {
    if (!isResizing.current) return;
    const newWidth = startWidth.current - (e.clientX - startX.current);
    if (newWidth >= 300 && newWidth <= 900) {
      setChatWidth(newWidth);
    }
  };

  // Funzione per terminare il ridimensionamento
  const stopResize = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Pulizia dei listener al dismount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, []);

  return (
    <div className="dashboard-with-chat-layout">
      {/* Dashboard principale */}
      <div className={`dashboard-main-container ${!isChatCollapsed ? 'with-chat' : ''}`}>
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
      </div>
      
      {/* Chat panel */}
      {!isMobile && (
      <div 
        className={`chat-container ${isChatCollapsed ? 'collapsed' : 'expanded'}`}
        style={{ width: isChatCollapsed ? '60px' : `${chatWidth}px` }}
        ref={chatContainerRef}
      >
       
        
        {/* Chat Component */}
        <div className="chat-component-wrapper">
          <ErrorBoundary>
            <ChatComponent 
              user={user} 
              onConfigEditorClick={onConfigEditorClick}
              isChatCollapsed={isChatCollapsed}
              toggleChatCollapse={toggleChatCollapse}
            />
          </ErrorBoundary>
        </div>
        
        {/* Handle per il ridimensionamento manuale */}
        {!isChatCollapsed && (
          <div 
            className="resize-handle"
            onMouseDown={startResize}
          ></div>
        )}
      </div>
      )}
    </div>
  );
};

DashboardWithChat.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
  user: PropTypes.object.isRequired,
  onConfigEditorClick: PropTypes.func.isRequired,
  isChatCollapsed: PropTypes.bool.isRequired,
  toggleChatCollapse: PropTypes.func.isRequired,
};

export default DashboardWithChat;