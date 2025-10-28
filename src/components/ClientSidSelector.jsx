import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { cacheService } from '../services/cache-service';
import './ClientSidSelector.css';

const ClientSidSelector = ({
  onClientSelected,
  onSidSelected,
  initialClient = '',
  initialSid = '',
  readOnly = false,
  isVisible // Riceve la prop
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clients, setClients] = useState([]);
  const [sids, setSids] = useState([]);
  const [selectedClient, setSelectedClient] = useState(initialClient);
  const [selectedSid, setSelectedSid] = useState(initialSid);

  // Usa isVisible per ricaricare i clienti quando il form appare
  useEffect(() => {
    if (isVisible) {
      console.log("ClientSidSelector is visible, loading clients...");
      loadClients();
    } else {
        // Quando non è visibile, resetta lo stato interno per la prossima apertura
        setClients([]);
        setSids([]);
        setSelectedClient(''); // Resetta anche il cliente selezionato
        setSelectedSid('');   // Resetta anche il SID selezionato
        setError(null);
        setLoading(false); // Assicura che loading sia false
    }
  }, [isVisible]); // Ricarica solo quando isVisible cambia


  // Carica i SID quando selectedClient cambia (e il componente è visibile)
  useEffect(() => {
    if (isVisible && selectedClient) {
      console.log(`Selected client changed to: ${selectedClient}, loading SIDs...`);
      loadSidsForClient(selectedClient);
    } else if (isVisible && !selectedClient) {
       // Se è visibile ma nessun cliente è selezionato, pulisci i SID
       console.log("Client deselected while visible, clearing SIDs.");
       setSids([]);
       setSelectedSid(''); // Resetta anche il sid selezionato
    }
  }, [selectedClient, isVisible]); // Dipende da entrambi


  // Aggiorna lo stato interno se le props iniziali cambiano DOPO il mount
  // Questo serve principalmente quando si modifica un task esistente
  useEffect(() => {
    // Aggiorna il cliente selezionato SOLO se la prop initialClient cambia
    // E se il componente NON è attualmente visibile (per evitare conflitti con loadClients)
    // O se è visibile ma il valore prop è DIVERSO dallo stato corrente
     if ((!isVisible && initialClient !== selectedClient) || (isVisible && initialClient !== selectedClient)) {
        console.log(`Initial client prop updated to: ${initialClient}`);
        setSelectedClient(initialClient || '');
     }
  }, [initialClient, isVisible]); // Aggiorna anche se isVisible cambia

  useEffect(() => {
    // Aggiorna il SID selezionato SOLO se la prop initialSid cambia
    // E se il componente NON è visibile
    // O se è visibile, il cliente selezionato corrisponde all'initialClient,
    // E il nuovo initialSid è diverso da quello attualmente selezionato
    if ((!isVisible && initialSid !== selectedSid) ||
        (isVisible && selectedClient === initialClient && initialSid !== selectedSid))
    {
        // Controlla anche che il SID iniziale sia presente nella lista caricata
        if (sids.some(s => s.sid === initialSid)) {
            console.log(`Initial SID prop updated to: ${initialSid}`);
            setSelectedSid(initialSid || '');
        } else if (!initialSid) {
            // Se initialSid è vuoto, resetta
             setSelectedSid('');
        }
    } else if (isVisible && selectedClient !== initialClient && selectedSid !== '') {
        // Se è visibile ma il cliente selezionato è DIVERSO dall'initialClient,
        // resetta il SID selezionato
        console.log("Client differs from initial while visible, resetting selected SID.");
        setSelectedSid('');
    }
  }, [initialSid, initialClient, selectedClient, sids, isVisible]); // Aggiorna anche se isVisible cambia


  const loadClients = async () => {
    // Non ricaricare se stiamo già caricando o se readOnly è true
    if (loading || readOnly) return;
    setLoading(true);
    setError(null);
    try {
      console.log("Calling cacheService.getClients()...");
      const clientsData = await cacheService.getClients();
      console.log("Clients received from cacheService:", clientsData);
      setClients(clientsData || []);

      // Se c'era un cliente pre-selezionato (es. da initialClient),
      // assicurati che sia ancora valido e ricarica i SID se necessario
      if (selectedClient && clientsData?.some(c => c.nomecliente === selectedClient)) {
          // Cliente ancora valido, ricarica i SID (useEffect [selectedClient] lo farà)
          console.log(`Client ${selectedClient} confirmed after reload.`);
      } else if (selectedClient) {
          // Cliente precedentemente selezionato non è più valido? Resetta.
          console.warn(`Selected client ${selectedClient} not found after reload. Resetting.`);
          setSelectedClient('');
          setSelectedSid('');
          setSids([]);
          if (onClientSelected) onClientSelected('');
          if (onSidSelected) onSidSelected('');
      } else if (initialClient && clientsData?.some(c => c.nomecliente === initialClient)) {
          // Se non c'era un selectedClient ma c'è un initialClient valido
          console.log(`Setting selected client from initial prop: ${initialClient}`);
          setSelectedClient(initialClient);
      }

    } catch (err) {
      console.error('Errore nel caricamento clienti:', err);
      setError('Impossibile caricare la lista dei clienti.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSidsForClient = async (clientName) => {
    if (!clientName || readOnly) { // Non caricare se readOnly
        setSids([]);
        return;
    };
    // Non ricaricare se stiamo già caricando
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      console.log(`Calling cacheService.getSidsForClient(${clientName})...`);
      const sidsData = await cacheService.getSidsForClient(clientName);
      console.log(`SIDs received for ${clientName}:`, sidsData);
      setSids(sidsData || []);

      // Controlla se il SID attualmente selezionato è ancora valido per questo cliente
      if (selectedSid && !sidsData?.some(s => s.sid === selectedSid)) {
        console.log(`Current selected SID (${selectedSid}) not valid for ${clientName}, resetting.`);
        setSelectedSid('');
        if (onSidSelected) onSidSelected(''); // Notifica il parent del reset
      } else if (!selectedSid && initialSid && clientName === initialClient && sidsData?.some(s => s.sid === initialSid)) {
          // Se non c'è un SID selezionato, ma c'è un initialSid valido per questo cliente
          console.log(`Setting SID from initial prop: ${initialSid}`);
          setSelectedSid(initialSid);
          // NON chiamare onSidSelected qui per evitare loop
      }

    } catch (err) {
      console.error(`Errore nel caricamento SID per ${clientName}:`, err);
      setError(`Impossibile caricare i SID per ${clientName}.`);
      setSids([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (e) => {
    if (readOnly) return; // Non fare nulla se readOnly
    const clientName = e.target.value;
    console.log(`Client dropdown changed to: ${clientName}`);
    setSelectedClient(clientName);
    setSelectedSid(''); // Reset SID quando il cliente cambia
    setSids([]); // Pulisci la lista vecchia di SID
    if (onClientSelected) onClientSelected(clientName);
    if (onSidSelected) onSidSelected('');
    // Non chiamare loadSidsForClient qui, useEffect [selectedClient] lo farà
  };

  const handleSidChange = (e) => {
    if (readOnly) return; // Non fare nulla se readOnly
    const sid = e.target.value;
    console.log(`SID dropdown changed to: ${sid}`);
    setSelectedSid(sid);
    if (onSidSelected) onSidSelected(sid);
  };

  const clientDisabled = readOnly || loading;
  const sidDisabled = !selectedClient || readOnly || loading || sids.length === 0;

  return (
    <div className="client-sid-selector">
      <div className="selector-row">
        <div className="selector-group">
          <label>Cliente</label>
          <select
            value={selectedClient}
            onChange={handleClientChange}
            disabled={clientDisabled}
            className={error ? 'error' : ''}
          >
            <option value="">Seleziona cliente</option>
            {Array.isArray(clients) && clients.map((client) => (
              <option key={client.nomecliente} value={client.nomecliente}>
                {client.nomecliente}
              </option>
            ))}
          </select>
        </div>

        <div className="selector-group">
          <label>SID</label>
          <select
            value={selectedSid}
            onChange={handleSidChange}
            disabled={sidDisabled}
            className={error ? 'error' : ''}
          >
             {!selectedClient && <option value="">Seleziona prima un cliente</option>}
             {selectedClient && loading && !sids.length && <option value="">Caricamento SID...</option>}
             {selectedClient && !loading && sids.length === 0 && <option value="">Nessun SID trovato</option>}
             {selectedClient && !loading && sids.length > 0 && (
                <>
                  <option value="">Seleziona SID</option>
                  {Array.isArray(sids) && sids.map((sid) => (
                      <option key={sid.sid} value={sid.sid}>
                          {sid.sid}
                      </option>
                  ))}
                </>
             )}
          </select>
        </div>
      </div>
      {error && <div className="selector-error">{error}</div>}
    </div>
  );
};

ClientSidSelector.propTypes = {
  onClientSelected: PropTypes.func,
  onSidSelected: PropTypes.func,
  initialClient: PropTypes.string,
  initialSid: PropTypes.string,
  readOnly: PropTypes.bool,
  isVisible: PropTypes.bool // Prop type per isVisible
};

export default ClientSidSelector;