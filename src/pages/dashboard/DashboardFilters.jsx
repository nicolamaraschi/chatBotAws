import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './DashboardFilters.css';

const DashboardFilters = ({
  availableClients,
  availableSIDs,
  selectedClients,
  selectedSIDs,
  selectedTimeRange,
  dateRange,
  isClientRole,
  onClientSelectionChange,
  onSIDSelectionChange,
  onTimeRangeChange,
  onDateChange,
  onClearCache,
  onSelectAllClients,
  onSelectAllSIDs,
  userRole,
  dashboardData,
  theme
}) => {
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [sidSearchTerm, setSidSearchTerm] = useState('');
  
  const handleClientSearchChange = (e) => {
    setClientSearchTerm(e.target.value.toLowerCase());
  };
  
  const handleSidSearchChange = (e) => {
    setSidSearchTerm(e.target.value.toLowerCase());
  };
  
  return (
    <div className="dashboard-filters">
      <div className="filter-section">
        <div className="filter-column clients-column">
          <div className="filter-header">
            <h3>Clienti</h3>
            
            {!isClientRole && (
              <button
                className="select-all-btn"
                onClick={onSelectAllClients}
                title={availableClients.length === selectedClients.length ? "Deseleziona tutti" : "Seleziona tutti"}
              >
                {availableClients.length === selectedClients.length ? "Nessuno" : "Tutti"}
              </button>
            )}
          </div>
          
          {!isClientRole && (
            <input
              type="text"
              placeholder="Cerca cliente..."
              value={clientSearchTerm}
              onChange={handleClientSearchChange}
              className="search-input"
            />
          )}
          
          <div className="checkbox-list">
            {availableClients
              .filter(client => client.nomecliente.toLowerCase().includes(clientSearchTerm))
              .map(client => (
                <label key={client.nomecliente} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.nomecliente)}
                    onChange={() => onClientSelectionChange(client.nomecliente)}
                    disabled={isClientRole}
                  />
                  <span className="checkbox-text">{client.nomecliente}</span>
                </label>
              ))}
          </div>
        </div>
        
        <div className="filter-column sids-column">
          <div className="filter-header">
            <h3>SIDs</h3>
            <button
              className="select-all-btn"
              onClick={onSelectAllSIDs}
              title={availableSIDs.length === selectedSIDs.length ? "Deseleziona tutti" : "Seleziona tutti"}
            >
              {availableSIDs.length === selectedSIDs.length ? "Nessuno" : "Tutti"}
            </button>
          </div>
          
          <input
            type="text"
            placeholder="Cerca SID o cliente..."
            value={sidSearchTerm}
            onChange={handleSidSearchChange}
            className="search-input"
          />
          
          <div className="checkbox-list">
            {availableSIDs
              .filter(sid => 
                sid.sid.toLowerCase().includes(sidSearchTerm) || 
                (sid.nomecliente && sid.nomecliente.toLowerCase().includes(sidSearchTerm))
              )
              .sort((a, b) => {
                if (a.nomecliente < b.nomecliente) return -1;
                if (a.nomecliente > b.nomecliente) return 1;
                if (a.sid < b.sid) return -1;
                if (a.sid > b.sid) return 1;
                return 0;
              })
              .map(sid => (
                <label key={`${sid.nomecliente}-${sid.sid}`} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedSIDs.includes(sid.sid)}
                    onChange={() => onSIDSelectionChange(sid.sid)}
                  />
                  <span className="checkbox-text">
                    <strong>{sid.sid}</strong> - <span className="sid-client-name">{sid.nomecliente}</span>
                  </span>
                </label>
              ))}
          </div>
        </div>
        
        <div className="filter-column time-column">
          <h3>Periodo</h3>
          
          <div className="time-range-controls">
            <select 
              value={selectedTimeRange} 
              onChange={onTimeRangeChange}
              className="time-range-select"
            >
              <option value="1d">Ultimo giorno</option>
              <option value="1m">Ultimo mese</option>
              <option value="6m">Ultimi 6 mesi</option>
              <option value="1y">Ultimo anno</option>
              <option value="all">Tutto</option>
              {/* ======================================================== */}
              {/* CORREZIONE DEL TYPO */}
              {/* ======================================================== */}
              <option value="custom">Personalizzato</option>
              {/* ======================================================== */}
              {/* FINE CORREZIONE */}
              {/* ======================================================== */}
            </select>
            
            {selectedTimeRange === 'custom' && (
              <div className="date-inputs">
                <div className="date-input-group">
                  <label>Da:</label>
                  <input 
                    type="date" 
                    value={dateRange.startDate} 
                    onChange={(e) => onDateChange('startDate', e.target.value)} 
                  />
                </div>
                <div className="date-input-group">
                  <label>A:</label>
                  <input 
                    type="date" 
                    value={dateRange.endDate} 
                    onChange={(e) => onDateChange('endDate', e.target.value)} 
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Bottone per pulire la cache solo per admin */}
          {userRole === 'admin' && (
            <div className="cache-controls">
              <button 
                onClick={onClearCache}
                className="clear-cache-btn"
                title="Forza aggiornamento dei dati"
              >
                🔄 Aggiorna dati clienti
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

DashboardFilters.propTypes = {
  availableClients: PropTypes.array.isRequired,
  availableSIDs: PropTypes.array.isRequired,
  selectedClients: PropTypes.array.isRequired,
  selectedSIDs: PropTypes.array.isRequired,
  selectedTimeRange: PropTypes.string.isRequired,
  dateRange: PropTypes.object.isRequired,
  isClientRole: PropTypes.bool.isRequired,
  onClientSelectionChange: PropTypes.func.isRequired,
  onSIDSelectionChange: PropTypes.func.isRequired,
  onTimeRangeChange: PropTypes.func.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onClearCache: PropTypes.func.isRequired,
  onSelectAllClients: PropTypes.func.isRequired,
  onSelectAllSIDs: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  dashboardData: PropTypes.object,
  theme: PropTypes.string
};

export default DashboardFilters;