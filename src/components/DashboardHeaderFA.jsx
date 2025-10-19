import React from 'react';
import PropTypes from 'prop-types';
import './DashboardHeaderFA.css';

/**
 * Dashboard header component with Font Awesome icons
 */
const DashboardHeaderFA = ({ 
  title, 
  onExport, 
  toggleTheme, 
  currentTheme,
  onBgChange,
  onLogout,
  toggleChatCollapse,
  isChatCollapsed
}) => {
  return (
    <header className="dashboard-header-fa">
      <div className="header-left">
        <i className="fas fa-chart-line title-icon"></i>
        <h1>{title}</h1>
      </div>
      
      <div className="header-actions-fa">
        <button 
          className="icon-btn-fa" 
          onClick={() => onExport('pdf')}
          aria-label="Scarica PDF"
        >
          <i className="fas fa-file-pdf"></i>
          <span className="btn-label-fa">PDF</span>
        </button>
        
        <button 
          className="icon-btn-fa" 
          onClick={() => onExport('print')}
          aria-label="Esporta Excel"
        >
          <i className="fas fa-file-excel"></i>
          <span className="btn-label-fa">Excel</span>
        </button>
        
        <button 
          className="icon-btn-fa" 
          onClick={toggleTheme}
          aria-label={currentTheme === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
        >
          <i className={`fas ${currentTheme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          <span className="btn-label-fa">
            {currentTheme === 'dark' ? 'Chiaro' : 'Scuro'}
          </span>
        </button>
        
        {onBgChange && (
          <button 
            className="icon-btn-fa" 
            onClick={() => onBgChange(true)}
            aria-label="Cambia sfondo"
          >
            <i className="fas fa-image"></i>
            <span className="btn-label-fa">Sfondo</span>
          </button>
        )}
        
        {onLogout && (
          <button 
            className="icon-btn-fa logout-btn-fa" 
            onClick={onLogout}
            aria-label="Logout"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="btn-label-fa">Esci</span>
          </button>
        )}
        
        {toggleChatCollapse && (
          <button 
            className="icon-btn-fa chat-toggle-btn-fa" 
            onClick={toggleChatCollapse}
            aria-label={isChatCollapsed ? 'Mostra chat' : 'Nascondi chat'}
          >
            <i className="fas fa-chevron-left"></i>
            <span className="btn-label-fa">
              Chat
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

DashboardHeaderFA.propTypes = {
  title: PropTypes.string.isRequired,
  onExport: PropTypes.func.isRequired,
  toggleTheme: PropTypes.func.isRequired,
  currentTheme: PropTypes.string.isRequired,
  onBgChange: PropTypes.func,
  onLogout: PropTypes.func,
  toggleChatCollapse: PropTypes.func,
  isChatCollapsed: PropTypes.bool
};

export default DashboardHeaderFA;