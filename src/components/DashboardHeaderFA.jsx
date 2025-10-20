import React from 'react';
import PropTypes from 'prop-types';
import './DashboardHeaderFA.css';

/**
 * Dashboard header component with Font Awesome icons - Versione modificata
 * Rimossi i bottoni PDF, Excel, Chiaro, Sfondo e Esci come richiesto
 */
const DashboardHeaderFA = ({ 
  title, 
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
  toggleChatCollapse: PropTypes.func,
  isChatCollapsed: PropTypes.bool
};

export default DashboardHeaderFA;