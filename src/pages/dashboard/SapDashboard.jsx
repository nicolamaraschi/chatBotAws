import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import DashboardHeaderFA from "../../components/DashboardHeaderFA";
import { useTheme } from "../../context/ThemeContext";
import BackgroundSelectorEnhanced from "../BackgroundSelectorEnhanced";
import DashboardFilters from "./DashboardFilters";
import DashboardContent from "./DashboardContent";
import { cacheService } from "../../services/cache-service";
import { API_URL } from "../../config";
import axios from "axios";
import "./SapDashboard.css"; // Assicurati che l'import ci sia

// IMPORT E REGISTRAZIONE CHART.JS (come da correzioni precedenti)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

// ============================================
// STATO DI DEFAULT "ZERO"
// ============================================
const zeroDashboardData = {
  kpis: {
    totalDumps: { value: 0, trend: 0, trendLabel: 'N/A' },
    failedBackups: { value: 0, trend: 0, trendLabel: 'N/A' },
    cancelledJobs: { value: 0, trend: 0, trendLabel: 'N/A' },
    servicesKO: { value: 0, trend: 0, trendLabel: 'N/A' }
  },
  charts: {
    issuesByClient: [],
    dumpTypes: [],
    servicesTimeline: [],
    problemsTimeline: []
  },
  rawData: {
    dumps: [],
    backups: [],
    jobs: [],
    services: []
  }
};
// ============================================

const SapDashboard = ({
  onBackgroundChange,
  onLogout,
  userRole,
  userClientName,
  isChatCollapsed = false,
  toggleChatCollapse = () => {}
}) => {
  // Stati principali
  const [availableClients, setAvailableClients] = useState([]);
  const [availableSIDs, setAvailableSIDs] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedSIDs, setSelectedSIDs] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState('1m');
  // Inizializza dashboardData con lo stato zero
  const [dashboardData, setDashboardData] = useState(zeroDashboardData);
  const [loading, setLoading] = useState(false); // Loading solo per chiamate API
  const [error, setError] = useState(null);
  const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const isClientRole = userRole === 'cliente';
  const dashboardRef = useRef(null);

  // Funzione per calcolare le date in base al range selezionato
  const calculateDateRange = (rangeType) => {
    const today = new Date();
    let startDate;

    switch(rangeType) {
      case '1d':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 1);
        break;
      case '1m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '6m':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 6);
        break;
      case '1y':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('2000-01-01'); // O una data di inizio appropriata
        break;
      case 'custom':
        // Se è custom, non calcoliamo nulla qui, usiamo dateRange state
        return null;
      default: // Default a 1 mese
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  };


  // Effetti per inizializzare i dati
  useEffect(() => {
     // Non fare nulla finché il ruolo non è definito.
     if (userRole === undefined) {
       return;
     }

     if (isClientRole && userClientName) {
       // Se l'utente è un cliente, imposta e blocca il suo cliente
       setAvailableClients([{ nomecliente: userClientName }]);
       setSelectedClients([userClientName]);
     } else {
       // Altrimenti, carica tutti i clienti per l'admin
       loadAvailableClients();
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientRole, userClientName, userRole]); // Le dipendenze sono corrette

  useEffect(() => {
    // Carica SID solo se ci sono clienti selezionati
    if (selectedClients.length > 0) {
      loadAvailableSIDs(selectedClients);
      // Resetta SID selezionati solo se admin cambia cliente
      if (!isClientRole) {
          // Quando l'admin cambia la selezione dei clienti, è più sicuro resettare i SID
           setSelectedSIDs([]);
      }
    } else {
      // Se nessun cliente è selezionato, svuota anche i SID disponibili E selezionati
      setAvailableSIDs([]);
      setSelectedSIDs([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, isClientRole]); // Rimosso selectedSIDs dalle dipendenze, gestito altrove


  // Effetto per caricare i dati della dashboard quando cambiano le selezioni
  useEffect(() => {
    // Condizione: Carica dati SOLO se ci sono clienti E SID selezionati
    if (selectedClients.length > 0 && selectedSIDs.length > 0) {
      console.log("Clienti e SID selezionati, avvio caricamento dati...");
      loadDashboardData();
    } else {
      // Altrimenti (nessun cliente, o solo clienti senza SID), imposta i dati a zero.
      console.log("Condizione non soddisfatta (clienti e SID), imposto dati a zero.");
      setDashboardData(zeroDashboardData);
      setLoading(false); // Assicura che non sia in stato di caricamento
      setError(null);    // Resetta eventuali errori precedenti
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, selectedSIDs, dateRange]); // Dipende da tutte le selezioni che influenzano la query


  // Carica i clienti disponibili usando il servizio di caching
  const loadAvailableClients = async () => {
    // setLoading(true); // Potrebbe non essere necessario mostrare loading per i soli clienti
    setError(null);
    try {
      const clientsData = await cacheService.getClients();
      setAvailableClients(clientsData || []); // Assicura array
      // Se admin e nessun cliente è ancora selezionato, non selezionare nulla di default
      // L'utente admin deve scegliere esplicitamente
      // if (clientsData.length > 0 && !isClientRole && selectedClients.length === 0) {
      //   setSelectedClients([clientsData[0].nomecliente]); // Rimosso auto-selezione
      // }
    } catch (err) {
      console.error('Errore nel caricamento clienti:', err);
      setError('Impossibile caricare la lista dei clienti.');
      setAvailableClients([]); // Imposta array vuoto in caso di errore
    } finally {
      // setLoading(false);
    }
  };


  // Carica i SID disponibili per i clienti selezionati
  const loadAvailableSIDs = async (selectedClientsList) => {
     if (!selectedClientsList?.length) {
         setAvailableSIDs([]); // Pulisci se non ci sono clienti
         return;
     };
     // setLoading(true); // Mostra loading generale? O uno specifico per SID?
     // Usiamo loading generale per ora
     setLoading(true);
     setError(null);
     try {
         const results = await Promise.allSettled(
             selectedClientsList.map(async (client) => {
                 const sidsForClient = await cacheService.getSidsForClient(client);
                 // Aggiungi il nome cliente ad ogni oggetto SID
                 return sidsForClient.map(sidObj => ({ ...sidObj, nomecliente: client }));
             })
         );
         // Filtra risultati ok, appiattisci e rimuovi duplicati (combinazione sid/cliente)
         const allSids = results
           .filter(r => r.status === 'fulfilled').map(r => r.value).flat();
         const uniqueSids = allSids.filter((s, i, self) =>
            i === self.findIndex(o => o.sid === s.sid && o.nomecliente === s.nomecliente)
         );
         setAvailableSIDs(uniqueSids);

         // Se è un cliente, auto-seleziona tutti i suoi SID disponibili?
         // Potrebbe essere preferibile lasciare che scelga
         // if (isClientRole && uniqueSids.length > 0 && selectedSIDs.length === 0) {
         //    setSelectedSIDs(uniqueSids.map(sid => sid.sid));
         // }

     } catch (err) {
         console.error('Errore nel caricamento SID:', err);
         setError(`Impossibile caricare i SID per i clienti selezionati.`);
         setAvailableSIDs([]); // Pulisci in caso di errore
     } finally {
         setLoading(false); // Ferma caricamento (generale o specifico SID)
     }
  };

  // Funzione per caricare i dati della dashboard dall'API
  const loadDashboardData = async () => {
    // La condizione (clienti e SID selezionati) è già stata verificata nell'useEffect
    setLoading(true); // Inizia caricamento API
    setError(null);
    try {
      const url = `${API_URL}/sap/dashboard`;
      const payload = {
        clients: selectedClients,
        sids: selectedSIDs,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      };
      const response = await axios.post(url, payload);
      console.log(`Dashboard data loaded: ${response.status === 200 ? 'success' : 'error'}`);
      setDashboardData(response.data); // Imposta i dati reali ricevuti
    } catch (err) {
      console.error('Errore caricamento dashboard data:', err);
      setError('Impossibile caricare i dati della dashboard. Riprova più tardi.');
      setDashboardData(zeroDashboardData); // Torna allo stato zero in caso di errore API
    } finally {
      setLoading(false); // Finisce caricamento API
    }
  };

  // Handler per cambio selezione range predefinito
  const handleTimeRangeChange = (e) => {
    const rangeType = e.target.value;
    setSelectedTimeRange(rangeType);
    if (rangeType !== 'custom') {
      const newRange = calculateDateRange(rangeType);
      if (newRange) {
        setDateRange(newRange); // Questo triggererà l'useEffect per ricaricare i dati
      }
    }
  };

  // Handler per cambio date manuali
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
    setSelectedTimeRange('custom'); // Passa a custom se le date cambiano manualmente
    // Il cambio di dateRange triggererà l'useEffect per ricaricare i dati
  };

  // Handler per selezione/deselezione cliente
  const handleClientSelectionChange = (client) => {
    setSelectedClients(prev =>
      prev.includes(client)
        ? prev.filter(c => c !== client)
        : [...prev, client]
    );
    // Il cambio di selectedClients triggererà l'useEffect per caricare i SID e poi i dati
  };

  // Handler per selezione/deselezione SID
  const handleSIDSelectionChange = (sid) => {
    setSelectedSIDs(prev =>
      prev.includes(sid)
        ? prev.filter(s => s !== sid)
        : [...prev, sid]
    );
    // Il cambio di selectedSIDs triggererà l'useEffect per ricaricare i dati
  };

  // Handler per selezionare/deselezionare tutti i clienti visibili
  const handleSelectAllClients = () => {
    const visibleClients = availableClients.map(client => client.nomecliente); // Considera tutti disponibili
    const allSelected = visibleClients.length > 0 && visibleClients.every(client => selectedClients.includes(client));
    setSelectedClients(allSelected ? [] : visibleClients);
  };

  // Handler per selezionare/deselezionare tutti i SID visibili
  const handleSelectAllSIDs = () => {
    // Considera tutti i SID attualmente disponibili (filtrati per cliente selezionato)
    const visibleSIDs = availableSIDs.map(sid => sid.sid);
    const uniqueVisibleSIDs = [...new Set(visibleSIDs)]; // Rimuovi duplicati se necessario
    const allSelected = uniqueVisibleSIDs.length > 0 && uniqueVisibleSIDs.every(sid => selectedSIDs.includes(sid));
    setSelectedSIDs(allSelected ? [] : uniqueVisibleSIDs);
  };

  // Handler per pulire la cache (solo admin)
  const handleClearCache = () => {
    if (userRole !== 'admin') return;
    cacheService.clearAllCache();
    alert('Cache pulita. Ricarica clienti e SID.');
    // Ricarica clienti (che poi triggererà ricarica SID e dati)
    setSelectedClients([]); // Resetta selezione per forzare ricarica
    setAvailableClients([]); // Pulisci disponibili
    loadAvailableClients();
  };

  // Render principale
  return (
    <div className={`sap-dashboard ${theme} ${isChatCollapsed ? 'full-width' : ''}`}>
      <DashboardHeaderFA
        onLogout={onLogout}
        toggleTheme={toggleTheme}
        theme={theme}
        title="Dashboard SAP"
        toggleBackgroundSelector={() => setIsBgSelectorOpen(!isBgSelectorOpen)}
        isChatCollapsed={isChatCollapsed}
        toggleChatCollapse={toggleChatCollapse}
      />

      <DashboardFilters
        availableClients={availableClients}
        availableSIDs={availableSIDs}
        selectedClients={selectedClients}
        selectedSIDs={selectedSIDs}
        selectedTimeRange={selectedTimeRange}
        dateRange={dateRange}
        isClientRole={isClientRole}
        onClientSelectionChange={handleClientSelectionChange}
        onSIDSelectionChange={handleSIDSelectionChange}
        onTimeRangeChange={handleTimeRangeChange}
        onDateChange={handleDateChange}
        onClearCache={handleClearCache}
        onSelectAllClients={handleSelectAllClients}
        onSelectAllSIDs={handleSelectAllSIDs}
        userRole={userRole}
        dashboardData={dashboardData} // Passa i dati (reali o zero)
        theme={theme}
      />

      {/* Area Contenuto: Mostra errore O caricamento O dati */}
      <div className="dashboard-content-area">
          {error && <div className="error-message">{error}</div>}

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Caricamento dati dashboard...</p>
            </div>
          )}

          {/* Mostra contenuto SOLO se NON c'è errore e NON sta caricando */}
          {/* DashboardContent ora riceverà sempre un oggetto valido */}
          {!loading && !error && (
             <DashboardContent
                dashboardData={dashboardData}
                dashboardRef={dashboardRef}
                theme={theme}
              />
          )}
      </div>


      {isBgSelectorOpen && (
          <BackgroundSelectorEnhanced
            onBackgroundChange={onBackgroundChange}
            onClose={() => setIsBgSelectorOpen(false)} // Usa false per chiudere
          />
      )}
    </div>
  );
};

SapDashboard.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
  isChatCollapsed: PropTypes.bool,
  toggleChatCollapse: PropTypes.func,
};

// Funzione helper fuori dal componente (se necessario)
// calculateDateRange può stare qui se non serve altrove
// const calculateDateRange = (rangeType) => { ... };

export default SapDashboard;

