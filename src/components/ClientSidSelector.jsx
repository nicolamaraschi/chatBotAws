import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { API_URL } from '../config';
import './ClientSidSelector.css';

const ClientSidSelector = ({ onClientSelected, onSidSelected, initialClient, initialSid }) => {
  const [clients, setClients] = useState([]);
  const [sids, setSids] = useState([]);
  const [selectedClient, setSelectedClient] = useState(initialClient || '');
  const [selectedSid, setSelectedSid] = useState(initialSid || '');
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingSids, setLoadingSids] = useState(false);
  const [error, setError] = useState(null);

  // Carica la lista dei clienti all'inizializzazione
  useEffect(() => {
    fetchClients();
  }, []);

  // Carica i SID quando viene selezionato un cliente
  useEffect(() => {
    if (selectedClient) {
      fetchSids(selectedClient);
    } else {
      setSids([]);
      setSelectedSid('');
      if (onSidSelected) onSidSelected('');
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    setLoadingClients(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/sap/clients`);
      setClients(response.data);
    } catch (err) {
      console.error('Errore nel recupero dei clienti:', err);
      setError('Impossibile caricare la lista dei clienti. Riprova più tardi.');
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchSids = async (clientName) => {
    setLoadingSids(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/sap/sids?clientName=${encodeURIComponent(clientName)}`);
      setSids(response.data);
      
      // Se c'è un SID iniziale e fa parte dei SID del cliente, usalo
      if (initialSid && response.data.some(s => s.sid === initialSid)) {
        setSelectedSid(initialSid);
        if (onSidSelected) onSidSelected(initialSid);
      } else if (response.data.length > 0) {
        // Altrimenti seleziona il primo SID disponibile
        setSelectedSid(response.data[0].sid);
        if (onSidSelected) onSidSelected(response.data[0].sid);
      } else {
        setSelectedSid('');
        if (onSidSelected) onSidSelected('');
      }
    } catch (err) {
      console.error('Errore nel recupero dei SID:', err);
      setError('Impossibile caricare la lista dei SID. Riprova più tardi.');
      setSids([]);
      setSelectedSid('');
      if (onSidSelected) onSidSelected('');
    } finally {
      setLoadingSids(false);
    }
  };

  const handleClientChange = (e) => {
    const clientName = e.target.value;
    setSelectedClient(clientName);
    if (onClientSelected) onClientSelected(clientName);
  };

  const handleSidChange = (e) => {
    const sid = e.target.value;
    setSelectedSid(sid);
    if (onSidSelected) onSidSelected(sid);
  };

  return (
    <div className="client-sid-selector">
      {error && <div className="selector-error">{error}</div>}
      
      <div className="selector-group">
        <label htmlFor="clientSelector">Cliente:</label>
        <div className="selector-wrapper">
          <select 
            id="clientSelector" 
            value={selectedClient} 
            onChange={handleClientChange}
            disabled={loadingClients}
          >
            <option value="">-- Seleziona cliente --</option>
            {clients.map((client) => (
              <option key={client.nomeCliente} value={client.nomeCliente}>
                {client.nomeCliente}
              </option>
            ))}
          </select>
          {loadingClients && <span className="selector-spinner">⟳</span>}
        </div>
      </div>
      
      <div className="selector-group">
        <label htmlFor="sidSelector">SID:</label>
        <div className="selector-wrapper">
          <select 
            id="sidSelector" 
            value={selectedSid} 
            onChange={handleSidChange}
            disabled={loadingSids || !selectedClient}
          >
            <option value="">-- Seleziona SID --</option>
            {sids.map((sidObj) => (
              <option key={sidObj.sid} value={sidObj.sid}>
                {sidObj.sid}
              </option>
            ))}
          </select>
          {loadingSids && <span className="selector-spinner">⟳</span>}
        </div>
      </div>
    </div>
  );
};

ClientSidSelector.propTypes = {
  onClientSelected: PropTypes.func,
  onSidSelected: PropTypes.func,
  initialClient: PropTypes.string,
  initialSid: PropTypes.string
};

export default ClientSidSelector;
