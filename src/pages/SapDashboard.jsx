import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { API_URL } from '../config';
import './SapDashboard.css';
import BackgroundSelector from './BackgroundSelector'; // Importa il nuovo componente
import { useTheme } from '../context/ThemeContext'; // Importa il hook useTheme
// Aggiungi questa importazione all'inizio del file SapDashboard.jsx
import { setupChartLegendObserver } from '../utils/chart-legend-fix';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

// ============ FUNZIONE HELPER PER GENERARE TUTTE LE DATE NEL RANGE ============
const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

const SAPDashboard = ({ onBackgroundChange, onLogout, userRole, userClientName, isChatCollapsed, toggleChatCollapse }) => {
  const [availableClients, setAvailableClients] = useState([]);
  const [availableSIDs, setAvailableSIDs] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedSIDs, setSelectedSIDs] = useState([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1m');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dashboardRef = useRef(null);
  const [isBgSelectorOpen, setIsBgSelectorOpen] = useState(false); // Stato per il popup
  const { theme, toggleTheme } = useTheme(); // Ottieni theme e toggleTheme dal contesto

  const isClientRole = userRole === 'cliente';

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
        startDate = new Date('2000-01-01');
        break;
      case 'custom':
        return null;
      default:
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    };
  };

  // Handler per il cambio del range predefinito
  const handleTimeRangeChange = (e) => {
    const rangeType = e.target.value;
    setSelectedTimeRange(rangeType);
    
    if (rangeType !== 'custom') {
      const newRange = calculateDateRange(rangeType);
      if (newRange) {
        setDateRange(newRange);
      }
    }
  };

  // Handler per la modifica manuale delle date
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

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
  }, [isClientRole, userClientName, userRole]);
  
  useEffect(() => {
    if (selectedClients.length > 0) {
      loadAvailableSIDs(selectedClients);
      // FIX: Quando cambi clienti, resetta i SID selezionati
      if (!isClientRole) {
        setSelectedSIDs([]);
      }
    } else {
      setAvailableSIDs([]);
      setSelectedSIDs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients]);
  
  useEffect(() => {
    if (selectedClients.length > 0) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, selectedSIDs, dateRange]);
  
// Nuovo useEffect POTENZIATO per il fix delle legende dei grafici in dark mode
useEffect(() => {
  // Funzione NUCLEARE per forzare l'aggiornamento dei colori
  const forceUpdateLegends = () => {
    // 1. Target TUTTI gli span e li all'interno di chart containers
    const allChartElements = document.querySelectorAll(
      '.chart-container span, ' +
      '.chart-card span, ' +
      '.chart-container li, ' +
      '.chart-card li, ' +
      'canvas + div span, ' +
      'canvas ~ * span, ' +
      'canvas ~ * li'
    );
    
    allChartElements.forEach(el => {
      if (theme === 'dark') {
        el.style.setProperty('color', '#e0e0e0', 'important');
      } else {
        el.style.setProperty('color', '#333333', 'important');
      }
    });
    
    // 2. Target specifico per canvas[role="img"] 
    const canvases = document.querySelectorAll('canvas[role="img"]');
    
    canvases.forEach(canvas => {
      // Trova il nodo padre
      const parent = canvas.parentNode;
      if (!parent) return;
      
      // Cerca i fratelli del canvas
      let sibling = parent.nextElementSibling;
      while (sibling) {
        const textElements = sibling.querySelectorAll('span, li, ul');
        textElements.forEach(el => {
          if (theme === 'dark') {
            el.style.setProperty('color', '#e0e0e0', 'important');
          } else {
            el.style.setProperty('color', '#333333', 'important');
          }
        });
        sibling = sibling.nextElementSibling;
      }
      
      // Cerca anche nei contenitori esterni (chart-card)
      let chartCard = parent;
      while (chartCard && !chartCard.classList.contains('chart-card')) {
        chartCard = chartCard.parentNode;
      }
      
      if (chartCard) {
        const legendElements = chartCard.querySelectorAll('ul li, span');
        legendElements.forEach(el => {
          if (theme === 'dark') {
            el.style.setProperty('color', '#e0e0e0', 'important');
          } else {
            el.style.setProperty('color', '#333333', 'important');
          }
        });
      }
    });
    
    // 3. Approccio aggressivo per QUALSIASI elemento che potrebbe essere una legenda
    const potentialLegends = document.querySelectorAll(
      '.chart-container ~ *, ' +
      '.chart-container + *, ' +
      '[class*="legend"], ' +
      '[class*="Legend"], ' +
      '[class*="chartjs"]'
    );
    
    potentialLegends.forEach(el => {
      const spans = el.querySelectorAll('span, li');
      spans.forEach(span => {
        if (theme === 'dark') {
          span.style.setProperty('color', '#e0e0e0', 'important');
        } else {
          span.style.setProperty('color', '#333333', 'important');
        }
      });
    });
    
    console.log(`🎨 Force-updated legend colors for ${canvases.length} charts in ${theme} mode`);
  };
  
  // Esegui IMMEDIATAMENTE al caricamento
  forceUpdateLegends();
  
  // Array per tenere traccia di tutti gli intervalli
  const intervals = [];
  
  // Esegui a intervalli nei primi 5 secondi per catturare render ritardati
  for (let i = 1; i <= 10; i++) {
    intervals.push(setTimeout(forceUpdateLegends, i * 500));
  }
  
  // Esegui quando cambiano i dati
  if (dashboardData) {
    setTimeout(forceUpdateLegends, 100);
    setTimeout(forceUpdateLegends, 300);
    setTimeout(forceUpdateLegends, 600);
  }
  
  // MutationObserver per intercettare QUALSIASI modifica al DOM
  const observer = new MutationObserver((mutations) => {
    // Verifica se sono stati aggiunti nuovi nodi
    const hasNodeAdditions = mutations.some(mutation => 
      mutation.addedNodes.length > 0
    );
    
    // Verifica se ci sono modifiche agli attributi che potrebbero indicare un re-render
    const hasAttributeChanges = mutations.some(mutation => 
      mutation.type === 'attributes'
    );
    
    if (hasNodeAdditions || hasAttributeChanges) {
      // Ritarda leggermente per permettere a Chart.js di completare il rendering
      setTimeout(forceUpdateLegends, 50);
    }
  });
  
  // Osserva l'intera dashboard per qualsiasi modifica
  const dashboardElement = document.querySelector('.sap-dashboard');
  if (dashboardElement) {
    observer.observe(dashboardElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }
  
  // Cleanup quando il componente viene smontato o cambiano le dipendenze
  return () => {
    observer.disconnect();
    intervals.forEach(id => clearTimeout(id));
    console.log('🧹 Cleaned up legend fix observers and intervals');
  };
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [theme, dashboardData]);

  const loadAvailableClients = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sap/clients`);
      setAvailableClients(response.data);
    } catch (err) {
      console.error('Errore nel caricamento dei clienti:', err);
    }
  };

  const loadAvailableSIDs = async (clients) => {
    try {
      const response = await axios.post(`${API_URL}/api/sap/sids`, { clients });
      setAvailableSIDs(response.data);
    } catch (err) {
      console.error('Errore nel caricamento dei SID:', err);
      setAvailableSIDs([]);
    }
  };

  const loadDashboardData = async () => {
    if (selectedClients.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const filters = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        clients: selectedClients,
        sids: selectedSIDs
      };
      
      console.log('📊 Invio filtri al backend:', filters);
      
      const response = await axios.post(`${API_URL}/api/sap/dashboard`, filters);
      setDashboardData(response.data);
    } catch (err) {
      setError('Errore nel caricamento dei dati. Verifica la connessione al backend.');
      console.error('Errore dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClientToggle = (client) => {
    if (isClientRole) return; // Non permettere la modifica se il ruolo è cliente
    setSelectedClients(prev => 
      prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]
    );
  };

  const handleSIDToggle = (sid) => {
    setSelectedSIDs(prev => 
      prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]
    );
  };

  const handleSelectAllClients = () => {
    if (isClientRole) return; // Non permettere la modifica se il ruolo è cliente
    if (selectedClients.length === availableClients.length) {
      setSelectedClients([]);
    }
    else {
      setSelectedClients(availableClients.map(c => c.nomecliente));
    }
  };

  const handleSelectAllSIDs = () => {
    if (selectedSIDs.length === availableSIDs.length) {
      setSelectedSIDs([]);
    }
    else {
      setSelectedSIDs(availableSIDs.map(s => s.sid));
    }
  };

  const getIssuesByClientChartData = () => {
    if (!dashboardData?.charts?.issuesByClient) return null;
    const data = dashboardData.charts.issuesByClient;
    
    const clientMap = {};
    data.forEach(item => {
      const client = item.nomecliente;
      if (!clientMap[client]) {
        clientMap[client] = { dumps: 0, failed_backups: 0, cancelled_jobs: 0 };
      }
      clientMap[client].dumps += parseInt(item.dumps || 0);
      clientMap[client].failed_backups += parseInt(item.failed_backups || 0);
      clientMap[client].cancelled_jobs += parseInt(item.cancelled_jobs || 0);
    });
    
    const labels = Object.keys(clientMap);
    const dumps = labels.map(client => clientMap[client].dumps);
    const backups = labels.map(client => clientMap[client].failed_backups);
    const jobs = labels.map(client => clientMap[client].cancelled_jobs);

    return {
      labels,
      datasets: [
        { label: 'Dumps', data: dumps, backgroundColor: 'rgba(255, 99, 132, 0.7)' },
        { label: 'Backup Falliti', data: backups, backgroundColor: 'rgba(255, 159, 64, 0.7)' },
        { label: 'Job Cancellati', data: jobs, backgroundColor: 'rgba(255, 205, 86, 0.7)' }
      ]
    };
  };

  const getIssuesBySIDChartData = () => {
    if (!dashboardData?.charts?.issuesByClient) return null;
    const data = dashboardData.charts.issuesByClient;
    
    const labels = data.map(item => `${item.nomecliente} - ${item.sid}`);
    const dumps = data.map(item => parseInt(item.dumps || 0));
    const backups = data.map(item => parseInt(item.failed_backups || 0));
    const jobs = data.map(item => parseInt(item.cancelled_jobs || 0));

    return {
      labels,
      datasets: [
        { label: 'Dumps', data: dumps, backgroundColor: 'rgba(255, 99, 132, 0.7)' },
        { label: 'Backup Falliti', data: backups, backgroundColor: 'rgba(255, 159, 64, 0.7)' },
        { label: 'Job Cancellati', data: jobs, backgroundColor: 'rgba(255, 205, 86, 0.7)' }
      ]
    };
  };

  const getDumpTypesChartData = () => {
    if (!dashboardData?.charts?.dumpTypes) return null;
    const data = dashboardData.charts.dumpTypes;
    
    const formatDumpName = (techName) => {
      if (!techName) return 'Unknown';
      const nameMap = {
        'CONVERT_TSTMP_INCONSISTENT_TAB': 'Timestamp Conversion Error',
        'CALL_FUNCTION_REMOTE_ERROR': 'Remote Function Call Error',
        'UNCAUGHT_EXCEPTION': 'Uncaught Exception',
        'ITAB_DUPLICATE_KEY': 'Duplicate Key in Table',
      };
      if (nameMap[techName]) return nameMap[techName];
      return techName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };
    
    const typeMap = {};
    data.forEach(item => {
      const rawType = item.dump_type || 'Unknown';
      const displayName = formatDumpName(rawType);
      typeMap[displayName] = (typeMap[displayName] || 0) + parseInt(item.count || 0);
    });
    
    const sortedEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
    
    const totalEntries = Object.entries(typeMap);
    if (totalEntries.length > 15) {
      const othersCount = totalEntries.slice(15).reduce((sum, entry) => sum + entry[1], 0);
      if (othersCount > 0) sortedEntries.push(['Others', othersCount]);
    }
    
    const labels = sortedEntries.map(entry => entry[0]);
    const counts = sortedEntries.map(entry => entry[1]);
    
    const backgroundColors = [
      'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)', 'rgba(83, 102, 255, 0.8)', 'rgba(255, 102, 178, 0.8)', 
      'rgba(102, 255, 178, 0.8)', 'rgba(255, 193, 7, 0.8)', 'rgba(156, 39, 176, 0.8)',
      'rgba(33, 150, 243, 0.8)', 'rgba(76, 175, 80, 0.8)', 'rgba(244, 67, 54, 0.8)',
      'rgba(158, 158, 158, 0.8)'
    ];
    
    return { 
      labels, 
      datasets: [{ 
        data: counts, 
        backgroundColor: backgroundColors.slice(0, labels.length), 
        borderWidth: 2, 
        borderColor: 'rgba(255, 255, 255, 0.8)' 
      }] 
    };
  };

  const getServicesTimelineChartData = () => {
    if (!dashboardData?.charts?.servicesTimeline) return null;
    const allDates = generateDateRange(dateRange.startDate, dateRange.endDate);
    const data = dashboardData.charts.servicesTimeline;
    const dataMap = {};
    data.forEach(item => {
      const date = item.datacontrollo;
      if (!dataMap[date]) dataMap[date] = { dump_ko: 0, job_ko: 0, processi_ko: 0, db_ko: 0, log_ko: 0 };
      dataMap[date].dump_ko += parseInt(item.dump_ko || 0);
      dataMap[date].job_ko += parseInt(item.job_ko || 0);
      dataMap[date].processi_ko += parseInt(item.processi_ko || 0);
      dataMap[date].db_ko += parseInt(item.db_ko || 0);
      dataMap[date].log_ko += parseInt(item.log_ko || 0);
    });
    const labels = allDates.map(date => new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    const dump_ko_data = allDates.map(date => dataMap[date]?.dump_ko || 0);
    const job_ko_data = allDates.map(date => dataMap[date]?.job_ko || 0);
    const db_ko_data = allDates.map(date => dataMap[date]?.db_ko || 0);
    const log_ko_data = allDates.map(date => dataMap[date]?.log_ko || 0);
    return { labels, datasets: [ { label: 'Dump KO', data: dump_ko_data, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.1)', tension: 0.3, fill: true }, { label: 'Job in Errore', data: job_ko_data, borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.1)', tension: 0.3, fill: true }, { label: 'Database KO', data: db_ko_data, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.1)', tension: 0.3, fill: true }, { label: 'Log Space KO', data: log_ko_data, borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.1)', tension: 0.3, fill: true } ] };
  };

  const getProblemsTimelineChartData = () => {
    if (!dashboardData?.charts?.problemsTimeline) return null;
    const allDates = generateDateRange(dateRange.startDate, dateRange.endDate);
    const data = dashboardData.charts.problemsTimeline;
    const dataMap = {};
    data.forEach(item => { dataMap[item.datacontrollo] = { dumps: parseInt(item.dumps || 0), failed_backups: parseInt(item.failed_backups || 0), cancelled_jobs: parseInt(item.cancelled_jobs || 0) }; });
    const labels = allDates.map(date => new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
    const dumps_data = allDates.map(date => dataMap[date]?.dumps || 0);
    const backups_data = allDates.map(date => dataMap[date]?.failed_backups || 0);
    const jobs_data = allDates.map(date => dataMap[date]?.cancelled_jobs || 0);
    return { labels, datasets: [ { label: 'Dumps', data: dumps_data, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.1)', tension: 0.3, fill: true }, { label: 'Backup Falliti', data: backups_data, borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.1)', tension: 0.3, fill: true }, { label: 'Job Cancellati', data: jobs_data, borderColor: 'rgba(255, 205, 86, 1)', backgroundColor: 'rgba(255, 205, 86, 0.1)', tension: 0.3, fill: true } ] };
  };

  const KPICard = ({ title, value, trend, trendLabel, status }) => {
    const getTrendIcon = () => { if (trend > 0) return '↑'; if (trend < 0) return '↓'; return '→'; };
    const getTrendColor = () => { if (title.includes('Dumps') || title.includes('Backup') || title.includes('Job')) { if (trend > 0) return '#dc3545'; if (trend < 0) return '#28a745'; } return '#666'; };
    return ( <div className="kpi-card"> <h3>{title}</h3> <div className="kpi-value">{value}</div> {trend !== 0 && ( <div className="kpi-trend" style={{ color: getTrendColor() }}> <span className="trend-icon">{getTrendIcon()}</span> <span className="trend-label">{trendLabel}</span> <span className="trend-period"> dal periodo precedente</span> </div> )} {status && <div className="kpi-status">{status}</div>} </div> );
  };

  const handleExport = async (exportType) => {
    const dashboard = dashboardRef.current; if (!dashboard) return;
    const exportButtons = dashboard.querySelector('.export-buttons'); if (exportButtons) exportButtons.style.display = 'none';
    const canvas = await html2canvas(dashboard, { scale: 2, useCORS: true, logging: true, width: dashboard.scrollWidth, height: dashboard.scrollHeight, windowWidth: dashboard.scrollWidth, windowHeight: dashboard.scrollHeight });
    if (exportButtons) exportButtons.style.display = 'block';
    const generatePdf = () => {
      const imgData = canvas.toDataURL('image/png'); const imgWidth = canvas.width; const imgHeight = canvas.height;
      const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth(); const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = imgWidth / pdfWidth; const scaledImgHeight = imgHeight / ratio;
      let position = 0; let page = 1;
      while (position < scaledImgHeight) {
        if (page > 1) pdf.addPage();
        const pageCanvas = document.createElement('canvas'); pageCanvas.width = imgWidth; pageCanvas.height = pdfHeight * ratio;
        const pageContext = pageCanvas.getContext('2d');
        pageContext.drawImage(canvas, 0, position * ratio, imgWidth, pdfHeight * ratio, 0, 0, imgWidth, pdfHeight * ratio);
        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        position += pdfHeight; page++;
      }
      return pdf;
    };
    if (exportType === 'pdf') { const pdf = generatePdf(); pdf.save(`sap-dashboard-${new Date().toISOString().split('T')[0]}.pdf`); }
  };
  
  // Funzione per l'esportazione in Excel
 // Funzione per l'esportazione in Excel
// Funzione migliorata per l'esportazione in Excel
const handleExportToExcel = () => {
  try {
    // Importa la libreria xlsx in modo dinamico
    import('xlsx').then(XLSX => {
      // Mostra messaggio di avviso iniziale
      console.log('Starting Excel export...');
      
      // Crea un nuovo workbook
      const workbook = XLSX.utils.book_new();
      
      // Prepara i dati di intestazione
      const headerSheet = [
        ['Dashboard SAP - Report Giornalieri'],
        ['Data esportazione:', new Date().toLocaleString('it-IT')],
        ['Periodo analizzato:', `${dateRange.startDate} - ${dateRange.endDate}`],
        ['Clienti selezionati:', selectedClients.join(', ')],
        ['SID selezionati:', selectedSIDs.length > 0 ? selectedSIDs.join(', ') : 'Tutti']
      ];
      
      // Foglio di intestazione
      const headerWorksheet = XLSX.utils.aoa_to_sheet(headerSheet);
      XLSX.utils.book_append_sheet(workbook, headerWorksheet, 'Informazioni');
      
      // ESPORTA I DATI DIRETTAMENTE DALLA TABELLA RIEPILOGATIVA
      if (dashboardData?.charts?.issuesByClient && dashboardData.charts.issuesByClient.length > 0) {
        // Prepara i dati
        const tableData = [
          ['Cliente', 'SID', 'Dumps', 'Backup Falliti', 'Job Cancellati', 'Totale Issues']
        ];
        
        dashboardData.charts.issuesByClient.forEach(item => {
          const total = parseInt(item.dumps || 0) + parseInt(item.failed_backups || 0) + parseInt(item.cancelled_jobs || 0);
          tableData.push([
            item.nomecliente || '',
            item.sid || '',
            parseInt(item.dumps || 0),
            parseInt(item.failed_backups || 0),
            parseInt(item.cancelled_jobs || 0),
            total
          ]);
        });
        
        // Crea il foglio
        const detailsWorksheet = XLSX.utils.aoa_to_sheet(tableData);
        
        // Formatta il foglio
        detailsWorksheet['!cols'] = [
          { wch: 20 }, // Cliente
          { wch: 15 }, // SID
          { wch: 10 }, // Dumps
          { wch: 15 }, // Backup Falliti
          { wch: 15 }, // Job Cancellati
          { wch: 15 }  // Totale
        ];
        
        // Aggiungi il foglio al workbook
        XLSX.utils.book_append_sheet(workbook, detailsWorksheet, 'Riepilogo Dettagliato');
      }
      
      // ESPORTA I DATI GREZZI (se disponibili)
      // Foglio Dumps
      if (dashboardData?.rawData?.dumps) {
        try {
          // Estrai i campi univoci per creare le intestazioni
          const allKeys = new Set();
          dashboardData.rawData.dumps.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          
          // Crea l'intestazione e i dati
          const headers = Array.from(allKeys);
          const dumpsData = [headers];
          
          // Aggiungi le righe di dati
          dashboardData.rawData.dumps.forEach(row => {
            const rowData = headers.map(header => row[header] || '');
            dumpsData.push(rowData);
          });
          
          // Crea e aggiungi il foglio
          const dumpsWorksheet = XLSX.utils.aoa_to_sheet(dumpsData);
          XLSX.utils.book_append_sheet(workbook, dumpsWorksheet, 'Dumps Raw');
        } catch (err) {
          console.error('Error exporting dumps data:', err);
        }
      }
      
      // Foglio Backups
      if (dashboardData?.rawData?.backups) {
        try {
          // Estrai i campi univoci per creare le intestazioni
          const allKeys = new Set();
          dashboardData.rawData.backups.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          
          // Crea l'intestazione e i dati
          const headers = Array.from(allKeys);
          const backupsData = [headers];
          
          // Aggiungi le righe di dati
          dashboardData.rawData.backups.forEach(row => {
            const rowData = headers.map(header => row[header] || '');
            backupsData.push(rowData);
          });
          
          // Crea e aggiungi il foglio
          const backupsWorksheet = XLSX.utils.aoa_to_sheet(backupsData);
          XLSX.utils.book_append_sheet(workbook, backupsWorksheet, 'Backups Raw');
        } catch (err) {
          console.error('Error exporting backups data:', err);
        }
      }
      
      // Foglio Jobs
      if (dashboardData?.rawData?.jobs) {
        try {
          // Estrai i campi univoci per creare le intestazioni
          const allKeys = new Set();
          dashboardData.rawData.jobs.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          
          // Crea l'intestazione e i dati
          const headers = Array.from(allKeys);
          const jobsData = [headers];
          
          // Aggiungi le righe di dati
          dashboardData.rawData.jobs.forEach(row => {
            const rowData = headers.map(header => row[header] || '');
            jobsData.push(rowData);
          });
          
          // Crea e aggiungi il foglio
          const jobsWorksheet = XLSX.utils.aoa_to_sheet(jobsData);
          XLSX.utils.book_append_sheet(workbook, jobsWorksheet, 'Jobs Raw');
        } catch (err) {
          console.error('Error exporting jobs data:', err);
        }
      }
      
      // Foglio Services
      if (dashboardData?.rawData?.services) {
        try {
          // Estrai i campi univoci per creare le intestazioni
          const allKeys = new Set();
          dashboardData.rawData.services.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          
          // Crea l'intestazione e i dati
          const headers = Array.from(allKeys);
          const servicesData = [headers];
          
          // Aggiungi le righe di dati
          dashboardData.rawData.services.forEach(row => {
            const rowData = headers.map(header => row[header] || '');
            servicesData.push(rowData);
          });
          
          // Crea e aggiungi il foglio
          const servicesWorksheet = XLSX.utils.aoa_to_sheet(servicesData);
          XLSX.utils.book_append_sheet(workbook, servicesWorksheet, 'Services Raw');
        } catch (err) {
          console.error('Error exporting services data:', err);
        }
      }
      
      // Aggiungi i KPI Summary
      if (dashboardData?.kpis) {
        const kpiData = [
          ['KPI Summary', '', '', ''],
          ['Indicatore', 'Valore', 'Trend', 'Note'],
          ['Total Dumps', dashboardData.kpis.totalDumps?.value || 0, dashboardData.kpis.totalDumps?.trendLabel || '0%', ''],
          ['Failed Backups', dashboardData.kpis.failedBackups?.value || 0, dashboardData.kpis.failedBackups?.trendLabel || '0%', dashboardData.kpis.failedBackups?.value > 0 ? 'Richiede attenzione' : ''],
          ['Cancelled Jobs', dashboardData.kpis.cancelledJobs?.value || 0, dashboardData.kpis.cancelledJobs?.trendLabel || '0%', ''],
          ['Services KO', dashboardData.kpis.servicesKO?.value || 0, 'N/A', dashboardData.kpis.servicesKO?.value > 0 ? 'Problemi rilevati' : 'Tutti OK']
        ];
        
        const kpiWorksheet = XLSX.utils.aoa_to_sheet(kpiData);
        XLSX.utils.book_append_sheet(workbook, kpiWorksheet, 'KPI Summary');
      }
      
      // Genera il file e avvia il download
      const fileName = `sap-dashboard-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      console.log('Excel export completed successfully');
      
    }).catch(err => {
      console.error('Error loading XLSX library:', err);
      alert('Errore durante il caricamento della libreria Excel.');
    });
  } catch (error) {
    console.error('Error in Excel export function:', error);
    alert('Si è verificato un errore durante l\'esportazione in Excel.');
  }
};

  return (
    <div className="sap-dashboard" ref={dashboardRef}>
      <div className="dashboard-header">
        <h1>Dashboard SAP - Report Giornalieri</h1>
        <div className="header-actions">
        <button onClick={toggleTheme} className="icon-btn" title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>{theme === 'light' ? '🌙' : '☀️'}</button>
        <button onClick={() => setIsBgSelectorOpen(true)} className="icon-btn" title="Change Background">🎨</button>
        <button onClick={onLogout} className="icon-btn" title="Logout">⏻</button>
        <button onClick={toggleChatCollapse} className="icon-btn" title={isChatCollapsed ? 'Open Chat' : 'Close Chat'}>{isChatCollapsed ? '«' : '»'}</button>
        <div className="export-buttons">
          <button onClick={() => handleExport('pdf')} className="export-btn">Download PDF</button>
          <button onClick={handleExportToExcel} className="export-btn excel-btn">Export Excel</button>
        </div>
      </div>
      </div>
      
      <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '20px', borderRadius: '5px', fontSize: '12px' }}>
        <strong>🔍 Debug Info:</strong><br/>
        Ruolo: {userRole || 'N/D'}, Cliente: {userClientName || 'N/D'}<br/>
        Clienti Selezionati: {selectedClients.length > 0 ? selectedClients.join(', ') : 'Nessuno'}<br/>
        SID Selezionati: {selectedSIDs.length > 0 ? selectedSIDs.join(', ') : 'Tutti (nessun filtro)'}
      </div>
      
      <div className={`filters-container ${isClientRole ? 'disabled-filters' : ''}`}>
        <div className="filter-section">
          <label>Periodo Temporale</label>
          <select value={selectedTimeRange} onChange={handleTimeRangeChange} className="time-range-select">
            <option value="1d">Ultimo Giorno</option>
            <option value="1m">Ultimo Mese</option>
            <option value="6m">Ultimi 6 Mesi</option>
            <option value="1y">Ultimo Anno</option>
            <option value="all">Tutti i Dati</option>
            <option value="custom">Personalizzato</option>
          </select>
        </div>
        
        {selectedTimeRange === 'custom' && (
          <div className="filter-section">
            <label>Date Personalizzate</label>
            <div className="date-inputs">
              <input type="date" value={dateRange.startDate} onChange={(e) => handleDateChange('startDate', e.target.value)} />
              <span>→</span>
              <input type="date" value={dateRange.endDate} onChange={(e) => handleDateChange('endDate', e.target.value)} />
            </div>
          </div>
        )}
        
        <div className={`filter-section ${isClientRole ? 'disabled' : ''}`}>
          <label>
            Clients ({selectedClients.length})
            {!isClientRole && (
              <button onClick={handleSelectAllClients} className="select-all-btn">
                {selectedClients.length === availableClients.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
              </button>
            )}
          </label>
          <div className="filter-options">
            {availableClients.map(client => (
              <label key={client.nomecliente} className={`checkbox-label ${isClientRole ? 'disabled' : ''}`}>
                <input type="checkbox" checked={selectedClients.includes(client.nomecliente)} onChange={() => handleClientToggle(client.nomecliente)} disabled={isClientRole} />
                {client.nomecliente}
              </label>
            ))}
          </div>
        </div>
        <div className="filter-section">
          <label>
            SIDs ({selectedSIDs.length > 0 ? selectedSIDs.length : 'Tutti'})
            {availableSIDs.length > 0 && (
              <button onClick={handleSelectAllSIDs} className="select-all-btn">
                {selectedSIDs.length === availableSIDs.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
              </button>
            )}
          </label>
          <div className="filter-options">
            {availableSIDs.length === 0 ? (
              <p className="no-data">Seleziona un cliente</p>
            ) : (
              availableSIDs.map(sid => (
                <label key={`${sid.sid}-${sid.nomecliente}`} className="checkbox-label">
                  <input type="checkbox" checked={selectedSIDs.includes(sid.sid)} onChange={() => handleSIDToggle(sid.sid)} />
                  {sid.sid} ({sid.nomecliente})
                </label>
              ))
            )}
          </div>
        </div>
      </div>
      
      {loading ? ( <div className="loading-overlay"> <div className="loader"></div> <p>Caricamento dati...</p> </div> ) : null}
      {error && <div className="error-message">{error}</div>}
      
      {dashboardData && (
        <>
      <div className="kpi-grid">
  <KPICard title="Total Dumps" value={dashboardData.kpis.totalDumps.value} trend={dashboardData.kpis.totalDumps.trend} trendLabel={dashboardData.kpis.totalDumps.trendLabel} />
  <KPICard title="Failed Backups" value={dashboardData.kpis.failedBackups.value} trend={dashboardData.kpis.failedBackups.trend} trendLabel={dashboardData.kpis.failedBackups.trendLabel} status={dashboardData.kpis.failedBackups.value > 0 ? 'Richiede attenzione' : null} />
  <KPICard title="Cancelled Jobs" value={dashboardData.kpis.cancelledJobs.value} trend={dashboardData.kpis.cancelledJobs.trend} trendLabel={dashboardData.kpis.cancelledJobs.trendLabel} />
  <KPICard title="Services KO" value={dashboardData.kpis.servicesKO.value} trend={0} trendLabel="N/A" status={dashboardData.kpis.servicesKO.value > 0 ? 'Problemi rilevati' : 'Tutti OK'} />
</div>

<div className="charts-grid">
  {/* GRAFICO 1: Andamento Servizi nel Tempo */}
  <div className="chart-card full-width">
    <h2>Andamento Servizi nel Tempo</h2>
    <p className="chart-subtitle">Evoluzione dello stato dei servizi nel periodo selezionato ({dateRange.startDate} → {dateRange.endDate})</p>
    {getServicesTimelineChartData() ? (
      <div className="chart-container-timeline">
        <Line 
          key={`line-timeline-${theme}`}
          data={getProblemsTimelineChartData()} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              legend: { 
                position: 'top',
                labels: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333',
                  font: {
                    size: 12,
                    family: 'Inter, system-ui, sans-serif'
                  }
                }
              },
              tooltip: {
                bodyColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                borderColor: theme === 'dark' ? '#555555' : '#cccccc',
                borderWidth: 1
              }
            }, 
            scales: { 
              y: { 
                beginAtZero: true, 
                title: { 
                  display: true, 
                  text: 'Numero di occorrenze',
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              }, 
              x: { 
                title: { 
                  display: true, 
                  text: 'Data',
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              } 
            }, 
            interaction: { 
              mode: 'index', 
              intersect: false 
            } 
          }} 
        />
      </div>
    ) : (
      <div className="no-data">Nessun dato disponibile</div>
    )}
  </div>

  {/* GRAFICO 2: Issues by Client */}
  <div className="chart-card">
    <h2>Issues by Client (Aggregato)</h2>
    <p className="chart-subtitle">Totale problemi per cliente (somma tutti i SID)</p>
    {getIssuesByClientChartData() ? (
      <div className="chart-container">
        <Bar 
          key={`bar-client-${theme}`}
          data={getIssuesByClientChartData()} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              legend: { 
                position: 'top',
                labels: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333',
                  font: {
                    size: 12,
                    family: 'Inter, system-ui, sans-serif'
                  }
                }
              },
              tooltip: {
                bodyColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                borderColor: theme === 'dark' ? '#555555' : '#cccccc',
                borderWidth: 1
              }
            }, 
            scales: { 
              y: { 
                beginAtZero: true,
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              },
              x: {
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              }
            } 
          }} 
        />
      </div>
    ) : (
      <div className="no-data">Nessun dato disponibile</div>
    )}
  </div>

  {/* GRAFICO 3: Issues by SID */}
  <div className="chart-card">
    <h2>Issues by SID (Dettagliato)</h2>
    <p className="chart-subtitle">Problemi divisi per ogni SID selezionato</p>
    {getIssuesBySIDChartData() ? (
      <div className="chart-container" style={{ height: `${Math.max(400, dashboardData.charts.issuesByClient.length * 50)}px` }}>
        <Bar 
          key={`bar-sid-${theme}`}
          data={getIssuesBySIDChartData()} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false, 
            indexAxis: 'y', 
            plugins: { 
              legend: { 
                position: 'top',
                labels: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333',
                  font: {
                    size: 12,
                    family: 'Inter, system-ui, sans-serif'
                  }
                }
              }, 
              tooltip: { 
                callbacks: { 
                  title: function(context) { 
                    return context[0].label; 
                  } 
                },
                bodyColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                borderColor: theme === 'dark' ? '#555555' : '#cccccc',
                borderWidth: 1
              } 
            }, 
            scales: { 
              x: { 
                beginAtZero: true, 
                title: { 
                  display: true, 
                  text: 'Numero di Issues',
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              }, 
              y: { 
                title: { 
                  display: true, 
                  text: 'Cliente - SID',
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                ticks: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333333'
                },
                grid: {
                  color: theme === 'dark' ? '#444444' : '#e0e0e0'
                }
              } 
            } 
          }} 
        />
      </div>
    ) : (
      <div className="no-data">Nessun dato disponibile</div>
    )}
  </div>

  {/* GRAFICO 4: Dump Type Distribution - IL PIÙ IMPORTANTE */}
  <div className="chart-card">
    <h2>Dump Type Distribution</h2>
    <p className="chart-subtitle">Tipi di dump più frequenti (Top 15)</p>
    {getDumpTypesChartData() ? (
      <div className="chart-container">
        <Doughnut 
          key={`doughnut-${theme}-${dashboardData?.charts?.dumpTypes?.length || 0}`}
          data={getDumpTypesChartData()} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              legend: { 
                position: 'right', 
                labels: { 
                  boxWidth: 15, 
                  padding: 8, 
                  font: { 
                    size: 11,
                    family: 'Inter, system-ui, sans-serif'
                  }, 
                  color: theme === 'dark' ? '#e0e0e0' : '#333333',
                  generateLabels: (chart) => { 
                    const data = chart.data; 
                    if (data.labels.length && data.datasets.length) { 
                      return data.labels.slice(0, 15).map((label, i) => ({ 
                        text: label.length > 25 ? label.substring(0, 22) + '...' : label, 
                        fillStyle: data.datasets[0].backgroundColor[i], 
                        hidden: false, 
                        index: i,
                        fontColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                        strokeStyle: theme === 'dark' ? '#e0e0e0' : '#333333'
                      })); 
                    } 
                    return []; 
                  } 
                } 
              }, 
              tooltip: { 
                callbacks: { 
                  label: function(context) { 
                    const label = context.label || ''; 
                    const value = context.parsed || 0; 
                    const total = context.dataset.data.reduce((a, b) => a + b, 0); 
                    const percentage = ((value / total) * 100).toFixed(1); 
                    return `${label}: ${value} (${percentage}%)`; 
                  } 
                },
                bodyColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                titleColor: theme === 'dark' ? '#e0e0e0' : '#333333',
                backgroundColor: theme === 'dark' ? '#333333' : '#ffffff',
                borderColor: theme === 'dark' ? '#555555' : '#cccccc',
                borderWidth: 1
              } 
            },
            animation: {
              onComplete: function() {
                setTimeout(() => {
                  const isDark = document.body.getAttribute('data-theme') === 'dark';
                  const color = isDark ? '#e0e0e0' : '#333333';
                  document.querySelectorAll('.chart-card span, .chart-container span').forEach(el => {
                    el.style.setProperty('color', color, 'important');
                  });
                }, 100);
              }
            }
          }} 
        />
      </div>
    ) : (
      <div className="no-data">Nessun dato disponibile</div>
    )}
  </div>
</div>
{dashboardData.charts.issuesByClient && dashboardData.charts.issuesByClient.length > 0 && (
  <div className="details-table">
    <h2>Riepilogo Dettagliato per Cliente e SID</h2>
    <table>
      <thead>
        <tr>
          <th>Cliente</th>
          <th>SID</th>
          <th>Dumps</th>
          <th>Backup Falliti</th>
          <th>Job Cancellati</th>
          <th>Totale Issues</th>
        </tr>
      </thead>
      <tbody>
        {dashboardData.charts.issuesByClient.map((item, index) => {
          const total = parseInt(item.dumps || 0) + parseInt(item.failed_backups || 0) + parseInt(item.cancelled_jobs || 0);
          const prevItem = index > 0 ? dashboardData.charts.issuesByClient[index - 1] : null;
          const isFirstOfClient = !prevItem || prevItem.nomecliente !== item.nomecliente;
          return (
            <tr key={`${item.nomecliente}-${item.sid}`} className={isFirstOfClient ? 'first-of-client' : ''}>
              <td>{isFirstOfClient && <strong>{item.nomecliente}</strong>}</td>
              <td><em>{item.sid}</em></td>
              <td className={item.dumps > 0 ? 'warning' : ''}>{item.dumps || 0}</td>
              <td className={item.failed_backups > 0 ? 'error' : ''}>{item.failed_backups || 0}</td>
              <td className={item.cancelled_jobs > 0 ? 'warning' : ''}>{item.cancelled_jobs || 0}</td>
              <td><strong>{total}</strong></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
        </>
      )}
      {isBgSelectorOpen && ( <BackgroundSelector onBackgroundChange={onBackgroundChange} onClose={() => setIsBgSelectorOpen(false)} /> )}
    </div>
  );
};

SAPDashboard.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
  isChatCollapsed: PropTypes.bool.isRequired,
  toggleChatCollapse: PropTypes.func.isRequired,
};

export default SAPDashboard; 