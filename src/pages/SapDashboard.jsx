import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { API_URL } from '../config';
import './SapDashboard.css';

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

const SAPDashboard = () => {
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
    loadAvailableClients();
  }, []);

  useEffect(() => {
    if (selectedClients.length > 0) {
      loadAvailableSIDs(selectedClients);
      // FIX: Quando cambi clienti, resetta i SID selezionati
      setSelectedSIDs([]);
    } else {
      setAvailableSIDs([]);
      setSelectedSIDs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients]);

  useEffect(() => {
    if (availableClients.length > 0) {
      const allClients = availableClients.map(c => c.nomecliente);
      setSelectedClients(allClients);
    }
  }, [availableClients]);

  useEffect(() => {
    if (selectedClients.length > 0) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, selectedSIDs, dateRange]);

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
        // FIX CRITICO: Passa sempre l'array di SID, anche se vuoto
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
    if (selectedClients.length === availableClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(availableClients.map(c => c.nomecliente));
    }
  };

  const handleSelectAllSIDs = () => {
    if (selectedSIDs.length === availableSIDs.length) {
      setSelectedSIDs([]);
    } else {
      setSelectedSIDs(availableSIDs.map(s => s.sid));
    }
  };

  const getIssuesByClientChartData = () => {
    if (!dashboardData?.charts?.issuesByClient) return null;
    const data = dashboardData.charts.issuesByClient;
    
    // Aggrega per cliente (somma di tutti i SID)
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
    
    // Crea label "Cliente - SID"
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
    
    // Funzione per formattare i nomi tecnici SAP in nomi leggibili
    const formatDumpName = (techName) => {
      if (!techName) return 'Unknown';
      
      // Mappa dei nomi tecnici più comuni
      const nameMap = {
        'CONVERT_TSTMP_INCONSISTENT_TAB': 'Timestamp Conversion Error',
        'CALL_FUNCTION_REMOTE_ERROR': 'Remote Function Call Error',
        'UNCAUGHT_EXCEPTION': 'Uncaught Exception',
        'ITAB_DUPLICATE_KEY': 'Duplicate Key in Table',
        'DBSQL_NO_MORE_CONNECTION': 'Database Connection Limit',
        'LOAD_PROGRAM_TABLE_MISMATCH': 'Program Table Mismatch',
        'RAISE_EXCEPTION': 'Raised Exception',
        'DBSQL_DUPLICATE_KEY_ERROR': 'Database Duplicate Key',
        'RFC_NO_AUTHORITY': 'RFC No Authorization',
        'TIME_OUT': 'Timeout',
        'MESSAGE_TYPE_X': 'Error Message Type X',
        'DYNPRO_MSG_IN_HELP': 'Dynpro Message in Help',
        'LIST_TOO_MANY_LPROS': 'Too Many List Processors',
        'GETWA_NOT_ASSIGNED': 'Work Area Not Assigned',
        'TSV_TNEW_PAGE_ALLOC_FAILED': 'Page Allocation Failed',
        'DBIF_DSQL2_OBJ_UNKNOWN': 'Database Object Unknown',
        'DATASET_NOT_OPEN': 'Dataset Not Open',
        'RAISE_SHORTDUMP': 'Short Dump Raised',
        'CALL_FUNCTION_SEND_ERROR': 'Function Send Error',
        'ITS_ERRMSG_EXCEPTION': 'ITS Error Message Exception',
        'DBIF_RSQL_SQL_ERROR': 'Database SQL Error',
        'SQL_CAUGHT_RABAX': 'SQL Exception Caught',
        'COMPUTE_INT_ZERODIVIDE': 'Division by Zero',
        'SYSTEM_FAILURE': 'System Failure',
        'STORAGE_PARAMETERS_WRONG_SET': 'Storage Parameters Wrong',
        'OBJECTS_OBJREF_NOT_ASSIGNED': 'Object Reference Not Assigned',
      };
      
      // Se esiste una traduzione, usala
      if (nameMap[techName]) {
        return nameMap[techName];
      }
      
      // Altrimenti formatta automaticamente:
      // ITAB_DUPLICATE_KEY -> Itab Duplicate Key
      return techName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    const typeMap = {};
    data.forEach(item => {
      const rawType = item.dump_type || 'Unknown';
      const displayName = formatDumpName(rawType);
      typeMap[displayName] = (typeMap[displayName] || 0) + parseInt(item.count || 0);
    });
    
    // Ordina per occorrenze e prendi solo i top 15
    const sortedEntries = Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    // Calcola "Altri" se ci sono più di 15 tipi
    const totalEntries = Object.entries(typeMap);
    if (totalEntries.length > 15) {
      const othersCount = totalEntries
        .slice(15)
        .reduce((sum, entry) => sum + entry[1], 0);
      
      if (othersCount > 0) {
        sortedEntries.push(['Others', othersCount]);
      }
    }
    
    const labels = sortedEntries.map(entry => entry[0]);
    const counts = sortedEntries.map(entry => entry[1]);
    
    const backgroundColors = [
      'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
      'rgba(199, 199, 199, 0.8)', 'rgba(83, 102, 255, 0.8)', 'rgba(255, 102, 178, 0.8)', 
      'rgba(102, 255, 178, 0.8)', 'rgba(255, 193, 7, 0.8)', 'rgba(156, 39, 176, 0.8)',
      'rgba(33, 150, 243, 0.8)', 'rgba(76, 175, 80, 0.8)', 'rgba(244, 67, 54, 0.8)',
      'rgba(158, 158, 158, 0.8)' // Grigio per "Others"
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

  // ============ FIX CRITICO: Grafici temporali con TUTTE le date nel range ============
  const getServicesTimelineChartData = () => {
    if (!dashboardData?.charts?.servicesTimeline) return null;
    
    // Genera TUTTE le date nel range selezionato
    const allDates = generateDateRange(dateRange.startDate, dateRange.endDate);
    
    // Crea una mappa con i dati ricevuti
    const data = dashboardData.charts.servicesTimeline;
    const dataMap = {};
    
    data.forEach(item => {
      const date = item.datacontrollo;
      if (!dataMap[date]) {
        dataMap[date] = { dump_ko: 0, job_ko: 0, processi_ko: 0, db_ko: 0, log_ko: 0 };
      }
      dataMap[date].dump_ko += parseInt(item.dump_ko || 0);
      dataMap[date].job_ko += parseInt(item.job_ko || 0);
      dataMap[date].processi_ko += parseInt(item.processi_ko || 0);
      dataMap[date].db_ko += parseInt(item.db_ko || 0);
      dataMap[date].log_ko += parseInt(item.log_ko || 0);
    });
    
    // Crea i labels e i dati per TUTTE le date
    const labels = allDates.map(date => {
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    
    const dump_ko_data = allDates.map(date => dataMap[date]?.dump_ko || 0);
    const job_ko_data = allDates.map(date => dataMap[date]?.job_ko || 0);
    const db_ko_data = allDates.map(date => dataMap[date]?.db_ko || 0);
    const log_ko_data = allDates.map(date => dataMap[date]?.log_ko || 0);
    
    return {
      labels,
      datasets: [
        { label: 'Dump KO', data: dump_ko_data, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.1)', tension: 0.3, fill: true },
        { label: 'Job in Errore', data: job_ko_data, borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.1)', tension: 0.3, fill: true },
        { label: 'Database KO', data: db_ko_data, borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.1)', tension: 0.3, fill: true },
        { label: 'Log Space KO', data: log_ko_data, borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.1)', tension: 0.3, fill: true }
      ]
    };
  };

  const getProblemsTimelineChartData = () => {
    if (!dashboardData?.charts?.problemsTimeline) return null;
    
    // Genera TUTTE le date nel range selezionato
    const allDates = generateDateRange(dateRange.startDate, dateRange.endDate);
    
    // Crea una mappa con i dati ricevuti
    const data = dashboardData.charts.problemsTimeline;
    const dataMap = {};
    
    data.forEach(item => {
      dataMap[item.datacontrollo] = {
        dumps: parseInt(item.dumps || 0),
        failed_backups: parseInt(item.failed_backups || 0),
        cancelled_jobs: parseInt(item.cancelled_jobs || 0)
      };
    });
    
    // Crea i labels e i dati per TUTTE le date
    const labels = allDates.map(date => {
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    
    const dumps_data = allDates.map(date => dataMap[date]?.dumps || 0);
    const backups_data = allDates.map(date => dataMap[date]?.failed_backups || 0);
    const jobs_data = allDates.map(date => dataMap[date]?.cancelled_jobs || 0);
    
    return {
      labels,
      datasets: [
        { label: 'Dumps', data: dumps_data, borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.1)', tension: 0.3, fill: true },
        { label: 'Backup Falliti', data: backups_data, borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.1)', tension: 0.3, fill: true },
        { label: 'Job Cancellati', data: jobs_data, borderColor: 'rgba(255, 205, 86, 1)', backgroundColor: 'rgba(255, 205, 86, 0.1)', tension: 0.3, fill: true }
      ]
    };
  };

  const KPICard = ({ title, value, trend, trendLabel, status }) => {
    const getTrendIcon = () => {
      if (trend > 0) return '↑';
      if (trend < 0) return '↓';
      return '→';
    };
    const getTrendColor = () => {
      if (title.includes('Dumps') || title.includes('Backup') || title.includes('Job')) {
        if (trend > 0) return '#dc3545';
        if (trend < 0) return '#28a745';
      }
      return '#666';
    };
    return (
      <div className="kpi-card">
        <h3>{title}</h3>
        <div className="kpi-value">{value}</div>
        {trend !== 0 && (
          <div className="kpi-trend" style={{ color: getTrendColor() }}>
            <span className="trend-icon">{getTrendIcon()}</span>
            <span className="trend-label">{trendLabel}</span>
            <span className="trend-period"> dal periodo precedente</span>
          </div>
        )}
        {status && <div className="kpi-status">{status}</div>}
      </div>
    );
  };

  const handleExport = async (exportType) => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    // Temporarily remove the export buttons from the capture
    const exportButtons = dashboard.querySelector('.export-buttons');
    if (exportButtons) {
      exportButtons.style.display = 'none';
    }

    const canvas = await html2canvas(dashboard, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // To handle images from other origins
      logging: true,
      width: dashboard.scrollWidth,
      height: dashboard.scrollHeight,
      windowWidth: dashboard.scrollWidth,
      windowHeight: dashboard.scrollHeight,
    });

    // Restore the export buttons
    if (exportButtons) {
      exportButtons.style.display = 'block';
    }

    const generatePdf = () => {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = imgWidth / pdfWidth;
      const scaledImgHeight = imgHeight / ratio;

      let position = 0;
      let page = 1;

      while (position < scaledImgHeight) {
        if (page > 1) {
          pdf.addPage();
        }

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = pdfHeight * ratio;

        const pageContext = pageCanvas.getContext('2d');
        pageContext.drawImage(
          canvas,
          0,
          position * ratio,
          imgWidth,
          pdfHeight * ratio,
          0,
          0,
          imgWidth,
          pdfHeight * ratio
        );

        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        position += pdfHeight;
        page++;
      }
      return pdf;
    };

    if (exportType === 'pdf') {
      const pdf = generatePdf();
      pdf.save(`sap-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
    } else if (exportType === 'email') {
      const pdf = generatePdf();
      pdf.save(`sap-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);

      const subject = `SAP Dashboard Report - ${new Date().toISOString().split('T')[0]}`;
      const body = `The SAP Dashboard PDF report has been downloaded to your computer (usually in the 'Downloads' folder).

Please attach the file to this email before sending.

Generated on: ${new Date().toLocaleString()}`;
      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');
    }
  };

  return (
    <div className="sap-dashboard" ref={dashboardRef}>
      <div className="dashboard-header">
        <h1>Dashboard SAP - Report Giornalieri</h1>
        <div className="export-buttons">
          <button onClick={() => handleExport('pdf')} className="export-btn">
            Download PDF
          </button>
          <button onClick={() => handleExport('email')} className="export-btn">
            Send Email
          </button>
        </div>
      </div>
      
      {/* Debug Info */}
      <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '20px', borderRadius: '5px', fontSize: '12px' }}>
        <strong>🔍 Debug Filtri:</strong><br/>
        Range: {dateRange.startDate} → {dateRange.endDate}<br/>
        Clienti: {selectedClients.length > 0 ? selectedClients.join(', ') : 'Nessuno'}<br/>
        SID: {selectedSIDs.length > 0 ? selectedSIDs.join(', ') : 'Tutti (nessun filtro)'}
      </div>
      
      <div className="filters-container">
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
              <input 
                type="date" 
                value={dateRange.startDate} 
                onChange={(e) => handleDateChange('startDate', e.target.value)} 
              />
              <span>→</span>
              <input 
                type="date" 
                value={dateRange.endDate} 
                onChange={(e) => handleDateChange('endDate', e.target.value)} 
              />
            </div>
          </div>
        )}
        
        <div className="filter-section">
          <label>
            Clients ({selectedClients.length})
            <button onClick={handleSelectAllClients} className="select-all-btn">
              {selectedClients.length === availableClients.length ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
            </button>
          </label>
          <div className="filter-options">
            {availableClients.map(client => (
              <label key={client.nomecliente} className="checkbox-label">
                <input type="checkbox" checked={selectedClients.includes(client.nomecliente)} onChange={() => handleClientToggle(client.nomecliente)} />
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
      
      {loading ? (
        <div className="loading-overlay">
          <div className="loader"></div>
          <p>Caricamento dati...</p>
        </div>
      ) : null}
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
            <div className="chart-card full-width">
              <h2>Andamento Servizi nel Tempo</h2>
              <p className="chart-subtitle">Evoluzione dello stato dei servizi nel periodo selezionato ({dateRange.startDate} → {dateRange.endDate})</p>
              {getServicesTimelineChartData() ? (
                <div className="chart-container-timeline">
                  <Line data={getServicesTimelineChartData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Numero di servizi in KO' } }, x: { title: { display: true, text: 'Data' } } } }} />
                </div>
              ) : (
                <div className="no-data">Nessun dato disponibile</div>
              )}
            </div>
            <div className="chart-card full-width">
              <h2>Andamento Problemi nel Tempo</h2>
              <p className="chart-subtitle">Trend di dumps, backup falliti e job cancellati ({dateRange.startDate} → {dateRange.endDate})</p>
              {getProblemsTimelineChartData() ? (
                <div className="chart-container-timeline">
                  <Line data={getProblemsTimelineChartData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Numero di occorrenze' } }, x: { title: { display: true, text: 'Data' } } }, interaction: { mode: 'index', intersect: false } }} />
                </div>
              ) : (
                <div className="no-data">Nessun dato disponibile</div>
              )}
            </div>
            <div className="chart-card">
              <h2>Issues by Client (Aggregato)</h2>
              <p className="chart-subtitle">Totale problemi per cliente (somma tutti i SID)</p>
              {getIssuesByClientChartData() ? (
                <div className="chart-container">
                  <Bar data={getIssuesByClientChartData()} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
                </div>
              ) : (
                <div className="no-data">Nessun dato disponibile</div>
              )}
            </div>
            <div className="chart-card">
              <h2>Issues by SID (Dettagliato)</h2>
              <p className="chart-subtitle">Problemi divisi per ogni SID selezionato</p>
              {getIssuesBySIDChartData() ? (
                <div className="chart-container" style={{ height: `${Math.max(400, dashboardData.charts.issuesByClient.length * 50)}px` }}>
                  <Bar 
                    data={getIssuesBySIDChartData()} 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      indexAxis: 'y',
                      plugins: { 
                        legend: { position: 'top' },
                        tooltip: {
                          callbacks: {
                            title: function(context) {
                              return context[0].label;
                            }
                          }
                        }
                      }, 
                      scales: { 
                        x: { beginAtZero: true, title: { display: true, text: 'Numero di Issues' } },
                        y: { title: { display: true, text: 'Cliente - SID' } }
                      } 
                    }} 
                  />
                </div>
              ) : (
                <div className="no-data">Nessun dato disponibile</div>
              )}
            </div>
            <div className="chart-card">
              <h2>Dump Type Distribution</h2>
              <p className="chart-subtitle">Tipi di dump più frequenti (Top 15)</p>
              {getDumpTypesChartData() ? (
                <div className="chart-container">
                  <Doughnut 
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
                              size: 11
                            },
                            // Limita le label troppo lunghe
                            generateLabels: (chart) => {
                              const data = chart.data;
                              if (data.labels.length && data.datasets.length) {
                                return data.labels.slice(0, 15).map((label, i) => ({
                                  text: label.length > 25 ? label.substring(0, 22) + '...' : label,
                                  fillStyle: data.datasets[0].backgroundColor[i],
                                  hidden: false,
                                  index: i
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
                    
                    // Determina se è la prima riga del cliente (per raggruppamento visivo)
                    const prevItem = index > 0 ? dashboardData.charts.issuesByClient[index - 1] : null;
                    const isFirstOfClient = !prevItem || prevItem.nomecliente !== item.nomecliente;
                    
                    return (
                      <tr key={`${item.nomecliente}-${item.sid}`} className={isFirstOfClient ? 'first-of-client' : ''}>
                        <td>
                          {isFirstOfClient && <strong>{item.nomecliente}</strong>}
                        </td>
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
    </div>
  );
};

export default SAPDashboard;
