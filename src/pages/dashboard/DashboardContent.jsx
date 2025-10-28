import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import './DashboardContent.css'; // Assicurati che questo import sia presente

// ============ FUNZIONE HELPER PER GENERARE TUTTE LE DATE NEL RANGE ============
const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    console.warn("generateDateRange chiamato con date non valide:", startDate, endDate);
    return [];
  }
  const dates = [];
  try {
      // Usiamo UTC per evitare problemi di timezone nel confronto e incremento
      const current = new Date(Date.UTC(
          parseInt(startDate.substring(0, 4)),
          parseInt(startDate.substring(5, 7)) - 1, // Mese è 0-based
          parseInt(startDate.substring(8, 10))
      ));
      const end = new Date(Date.UTC(
          parseInt(endDate.substring(0, 4)),
          parseInt(endDate.substring(5, 7)) - 1,
          parseInt(endDate.substring(8, 10))
      ));

      if (isNaN(current.getTime()) || isNaN(end.getTime())) {
          console.error("Date non valide dopo parsing UTC:", startDate, endDate);
          return [];
      }

      let iterations = 0;
      const maxIterations = 365 * 3; // Limite aumentato a 3 anni per sicurezza

      // Aggiungi controllo per data di inizio > data di fine
      if (current > end) {
          console.warn("generateDateRange: startDate è successiva a endDate.");
          return [];
      }

      while (current <= end && iterations < maxIterations) {
          // Formatta la data UTC in YYYY-MM-DD
          const year = current.getUTCFullYear();
          const month = String(current.getUTCMonth() + 1).padStart(2, '0');
          const day = String(current.getUTCDate()).padStart(2, '0');
          dates.push(`${year}-${month}-${day}`);

          // Incrementa giorno in UTC
          current.setUTCDate(current.getUTCDate() + 1);
          iterations++;
      }
      if (iterations >= maxIterations) {
          console.warn("generateDateRange interrotto per superamento limite iterazioni.");
      }
  } catch (e) {
      console.error("Errore critico in generateDateRange:", e, "Input:", startDate, endDate);
      return []; // Ritorna array vuoto in caso di errore
  }
  return dates;
};


// Funzione Observer per colori legenda
const setupChartLegendObserver = (theme) => {
    // Disconnetti l'osservatore precedente se esiste
    if (window.chartLegendObserverInstance) {
      // console.log("Disconnecting previous legend observer");
      window.chartLegendObserverInstance.disconnect();
    }
    const updateLegendColors = () => {
        const color = theme === 'dark' ? '#e0e0e0' : '#333333';
        // Seleziona elementi testo specifici delle legende e degli assi
        // Usa selettori più robusti se possibile
        document.querySelectorAll(
            '.chartjs-legend li span, text[class*="chartjs-axis-label"], text[class*="chartjs-tick-label"]'
        ).forEach(el => {
            // Per elementi HTML (span, li)
            if (el.style && el.style.color !== color) {
                // console.log("Updating color for:", el);
                el.style.setProperty('color', color); // No !important
            }
            // Per elementi SVG (text)
            if (el.tagName === 'text' && el.getAttribute('fill') !== color) {
                // console.log("Updating fill for:", el);
                el.setAttribute('fill', color);
            }
        });
    };

    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        for (const mutation of mutations) {
             // Controlla aggiunta nodi rilevanti o cambio attributi stile/fill/class
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 shouldUpdate = Array.from(mutation.addedNodes).some(node => node.nodeType === 1 && node.matches('canvas, ul, li, span, text, div[class*="tooltip"]'));
                 if (shouldUpdate) break; // Esci presto se trovato
            } else if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'fill' || mutation.attributeName === 'class')) {
                // Ottimizzazione: controlla se l'elemento target è rilevante
                 if (mutation.target && mutation.target.closest && mutation.target.closest('.chart-card, .chartjs-tooltip')) {
                     shouldUpdate = true;
                     break; // Esci presto
                 }
            }
        }

        if (shouldUpdate) {
           // console.log("Legend observer triggered update");
           // Usa requestAnimationFrame per eseguire l'aggiornamento nel prossimo ciclo di rendering
           requestAnimationFrame(() => {
               setTimeout(updateLegendColors, 50); // Piccolo delay aggiuntivo
           });
        }
    });
    // Osserva body ma anche specifici contenitori se necessario
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'fill', 'class'] });
    window.chartLegendObserverInstance = observer; // Salva istanza
    // console.log("Legend observer attached");
    requestAnimationFrame(() => {
        setTimeout(updateLegendColors, 150); // Aggiorna dopo un po'
    });
    return observer;
};


const DashboardContent = ({ dashboardData, dashboardRef, theme }) => {

  useEffect(() => {
    // useEffect per aggiornare i colori quando tema o dati cambiano
    const forceUpdateLegends = () => {
      const color = theme === 'dark' ? '#e0e0e0' : '#333333';
      // console.log(`Force updating legends/axes color to ${color} for theme ${theme}`);
      document.querySelectorAll(
          '.chartjs-legend li span, text[class*="chartjs-axis-label"], text[class*="chartjs-tick-label"]'
      ).forEach(el => {
         if (el.style && el.style.color !== color) {
              el.style.setProperty('color', color); // No !important
          }
           if (el.tagName === 'text' && el.getAttribute('fill') !== color) {
              el.setAttribute('fill', color);
          }
      });
    };
    forceUpdateLegends(); // Applica subito
    // Usiamo requestAnimationFrame per eseguire aggiornamenti successivi in modo più efficiente
    const raf1 = requestAnimationFrame(() => setTimeout(forceUpdateLegends, 150));
    const raf2 = requestAnimationFrame(() => setTimeout(forceUpdateLegends, 600));

    const observer = setupChartLegendObserver(theme); // Attiva l'observer
    // Funzione di cleanup
    return () => {
        // console.log("Cleaning up legend observer and timers");
        cancelAnimationFrame(raf1); // Cancella i frame richiesti
        cancelAnimationFrame(raf2);
        if (observer) observer.disconnect();
        window.chartLegendObserverInstance = null; // Pulisci riferimento globale
    }
  }, [theme, dashboardData]); // Dipendenze: tema e dati

  // --- useMemo per calcolare i dati dei grafici ---

  // MODIFICATO: issuesByTimeChartData ora include TOTALE Servizi KO
  const issuesByTimeChartData = useMemo(() => {
    // console.log("Recalculating issuesByTimeChartData (including Total KO Services)");
    const problemsData = dashboardData?.charts?.problemsTimeline;
    const servicesData = dashboardData?.charts?.servicesTimeline;

    if (!problemsData?.length && !servicesData?.length) return null; // Se mancano entrambi i dati

    // Trova range date comune o massimo
    const problemDates = problemsData?.map(item => item.datacontrollo).filter(Boolean).sort() || [];
    const serviceDates = servicesData?.map(item => item.datacontrollo).filter(Boolean).sort() || [];
    const allSortedDates = [...new Set([...problemDates, ...serviceDates])].sort();

    if (!allSortedDates.length) return null;
    const startDate = allSortedDates[0];
    const endDate = allSortedDates[allSortedDates.length - 1];

    if (!startDate || !endDate) return null;
    const allDates = generateDateRange(startDate, endDate);
    if (!allDates?.length) return null;

    // Mappa per problemi
    const problemsMap = (problemsData || []).reduce((map, item) => (map[item.datacontrollo] = item, map), {});
    // Mappa per servizi KO (sommando per data)
    const servicesKoMap = allDates.reduce((map, date) => (map[date] = 0, map), {}); // Inizializza a 0
    (servicesData || []).forEach(item => {
        if (servicesKoMap[item.datacontrollo] !== undefined) {
             const dailyTotalKo = (parseInt(item.dump_ko || 0) + parseInt(item.job_ko || 0) +
                                  parseInt(item.processi_ko || 0) + parseInt(item.db_ko || 0) +
                                  parseInt(item.log_ko || 0) + parseInt(item.cert_ko || 0) +
                                  parseInt(item.update_ko || 0) + parseInt(item.spool_ko || 0));
             servicesKoMap[item.datacontrollo] += dailyTotalKo; // Somma i totali KO per giorno
        }
    });


    const datasets = [
        { label: 'Dumps Totali', data: [], backgroundColor: 'rgba(75, 192, 192, 0.5)', borderColor: 'rgb(75, 192, 192)', tension: 0.1 },
        { label: 'Backup Falliti', data: [], backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
        { label: 'Job Cancellati', data: [], backgroundColor: 'rgba(255, 206, 86, 0.5)', borderColor: 'rgb(255, 206, 86)', tension: 0.1 },
        // Aggiungi dataset per Servizi KO Totali
        { label: 'Servizi KO (Totali)', data: [], backgroundColor: 'rgba(111, 66, 193, 0.5)', borderColor: 'rgb(111, 66, 193)', tension: 0.1 }
    ];

    // Popola i dati
    datasets[0].data = allDates.map(date => parseInt(problemsMap[date]?.dumps || 0));
    datasets[1].data = allDates.map(date => parseInt(problemsMap[date]?.failed_backups || 0));
    datasets[2].data = allDates.map(date => parseInt(problemsMap[date]?.cancelled_jobs || 0));
    datasets[3].data = allDates.map(date => servicesKoMap[date] ?? 0); // Usa ?? 0 per sicurezza

    // Logica displayIndices
    let displayIndices = allDates.map((_, index) => index);
    if (allDates.length > 30) {
        const interval = Math.ceil(allDates.length / 15);
        displayIndices = allDates.map((date, index) => index % interval === 0 ? index : -1).filter(index => index !== -1);
        const lastIndex = allDates.length - 1;
        if (displayIndices.indexOf(lastIndex) === -1) displayIndices.push(lastIndex); // Usa indexOf
    }
    // console.log("issuesByTimeChartData (con Total KO) calcolato:", { labels: allDates.length, datasets: datasets.map(d=>d.data.length), displayIndices: displayIndices.length });
    return { labels: allDates, datasets, _config: { displayIndices } };
  }, [dashboardData]);


  // Grafici Clienti, SID, Tipi Dump
  const issuesByClientChartData = useMemo(() => {
    // console.log("Recalculating issuesByClientChartData");
    if (!dashboardData?.charts?.issuesByClient?.length) return null;
    const clientData = {};
    dashboardData.charts.issuesByClient.forEach(item => {
        const clientName = item.nomecliente || 'N/D'; // Gestisce cliente nullo
        if (!clientData[clientName]) clientData[clientName] = { dumps: 0, failed_backups: 0, cancelled_jobs: 0 };
        clientData[clientName].dumps += parseInt(item.dumps || 0);
        clientData[clientName].failed_backups += parseInt(item.failed_backups || 0);
        clientData[clientName].cancelled_jobs += parseInt(item.cancelled_jobs || 0);
    });
    const clientNames = Object.keys(clientData);
    if (!clientNames.length) return null;
    // console.log("issuesByClientChartData calculated:", clientNames);
    return {
        labels: clientNames,
        datasets: [
            { label: 'Dumps', data: clientNames.map(c => clientData[c].dumps), backgroundColor: 'rgba(75, 192, 192, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' },
            { label: 'Backup Falliti', data: clientNames.map(c => clientData[c].failed_backups), backgroundColor: 'rgba(255, 99, 132, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' },
            { label: 'Job Cancellati', data: clientNames.map(c => clientData[c].cancelled_jobs), backgroundColor: 'rgba(255, 206, 86, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' }
        ]
    };
  }, [dashboardData, theme]); // Aggiunto theme per borderColor

  const issuesBySIDChartData = useMemo(() => {
    // console.log("Recalculating issuesBySIDChartData");
    if (!dashboardData?.charts?.issuesByClient?.length) return null;
    const sortedData = [...dashboardData.charts.issuesByClient]
      .filter(item => item.nomecliente && item.sid) // Filtra dati incompleti
      .sort((a, b) => (parseInt(b.dumps||0)+parseInt(b.failed_backups||0)+parseInt(b.cancelled_jobs||0))-(parseInt(a.dumps||0)+parseInt(a.failed_backups||0)+parseInt(a.cancelled_jobs||0)));
    const limitedData = sortedData.slice(0, 20);
    if (!limitedData.length) return null;
    const limitedLabels = limitedData.map(item => `${item.nomecliente} - ${item.sid}`);
    // console.log("issuesBySIDChartData calculated:", limitedLabels);
    return {
        labels: limitedLabels,
        datasets: [
            { label: 'Dumps', data: limitedData.map(item => parseInt(item.dumps || 0)), backgroundColor: 'rgba(75, 192, 192, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' },
            { label: 'Backup Falliti', data: limitedData.map(item => parseInt(item.failed_backups || 0)), backgroundColor: 'rgba(255, 99, 132, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' },
            { label: 'Job Cancellati', data: limitedData.map(item => parseInt(item.cancelled_jobs || 0)), backgroundColor: 'rgba(255, 206, 86, 0.7)', borderWidth: 1, borderColor: theme === 'dark' ? '#333' : '#fff' }
        ]
    };
  }, [dashboardData, theme]); // Aggiunto theme per borderColor

  const dumpTypesChartData = useMemo(() => {
    // console.log("Recalculating dumpTypesChartData");
    if (!dashboardData?.charts?.dumpTypes?.length) return null;
    // Filtra tipi nulli o vuoti PRIMA di ordinare
    const validTypes = dashboardData.charts.dumpTypes.filter(item => item.dump_type);
    if (!validTypes.length) return null;

    const sortedTypes = validTypes.sort((a, b) => parseInt(b.count) - parseInt(a.count)).slice(0, 15);
    const baseColors = ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#C9CBCF','#537BFF','#4ECDC4','#FFA765','#FF82B3','#A15FE2','#45B39D','#EC7063','#F1C40F'];
    const generateColors = (count) => {
        if (count <= baseColors.length) return baseColors.slice(0, count);
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) colors.push(`rgba(${Math.floor(Math.random()*200+55)}, ${Math.floor(Math.random()*200+55)}, ${Math.floor(Math.random()*200+55)}, 0.8)`);
        return colors;
    };
    const colors = generateColors(sortedTypes.length);
    // console.log("dumpTypesChartData calculated:", sortedTypes.map(t=>t.dump_type));
    return {
        labels: sortedTypes.map(item => item.dump_type), // Non serve più il fallback 'N/D'
        datasets: [{
            data: sortedTypes.map(item => parseInt(item.count)),
            backgroundColor: colors.map(c => c.replace(/, ?(0\.\d+|1)\)/, ', 0.8)')), // Assicura opacità 0.8
            borderColor: colors.map(c => c.replace(/, ?(0\.\d+|1)\)/, ', 1)')),    // Assicura opacità 1
            borderWidth: 1,
        }]
    };
  }, [dashboardData]);

  // Grafico Timeline Servizi KO Dettaglio
  const servicesTimelineChartData = useMemo(() => {
    // console.log("Recalculating servicesTimelineChartData");
    if (!dashboardData?.charts?.servicesTimeline?.length) return null;
    const timelineData = dashboardData.charts.servicesTimeline;
    const datesInData = timelineData.map(item => item.datacontrollo).filter(Boolean).sort();
     if (!datesInData.length) return null;
    const startDate = datesInData[0];
    const endDate = datesInData[datesInData.length - 1];
    if (!startDate || !endDate) return null;
    const allDates = generateDateRange(startDate, endDate);
    if (!allDates?.length) return null;
    const dataMap = allDates.reduce((map, date) => (map[date] = { dump_ko: 0, job_ko: 0, processi_ko: 0, db_ko: 0, log_ko: 0, cert_ko: 0, update_ko: 0, spool_ko: 0 }, map), {});
    timelineData.forEach(item => {
        if (dataMap[item.datacontrollo]) {
            dataMap[item.datacontrollo].dump_ko += parseInt(item.dump_ko || 0);
            dataMap[item.datacontrollo].job_ko += parseInt(item.job_ko || 0);
            dataMap[item.datacontrollo].processi_ko += parseInt(item.processi_ko || 0);
            dataMap[item.datacontrollo].db_ko += parseInt(item.db_ko || 0);
            dataMap[item.datacontrollo].log_ko += parseInt(item.log_ko || 0);
            dataMap[item.datacontrollo].cert_ko += parseInt(item.cert_ko || 0);
            dataMap[item.datacontrollo].update_ko += parseInt(item.update_ko || 0);
            dataMap[item.datacontrollo].spool_ko += parseInt(item.spool_ko || 0);
        }
    });
    // Rimosso hidden: true
    const datasets = [
        { label: 'Dump KO', data: allDates.map(d => dataMap[d].dump_ko), borderColor: '#dc3545', backgroundColor: 'rgba(220, 53, 69, 0.5)', tension: 0.1 },
        { label: 'Job KO', data: allDates.map(d => dataMap[d].job_ko), borderColor: '#fd7e14', backgroundColor: 'rgba(253, 126, 20, 0.5)', tension: 0.1 },
        { label: 'DB Space KO', data: allDates.map(d => dataMap[d].db_ko), borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.5)', tension: 0.1 },
        { label: 'Log Space KO', data: allDates.map(d => dataMap[d].log_ko), borderColor: '#6f42c1', backgroundColor: 'rgba(111, 66, 193, 0.5)', tension: 0.1 },
        { label: 'Processi KO', data: allDates.map(d => dataMap[d].processi_ko), borderColor: '#20c997', backgroundColor: 'rgba(32, 201, 151, 0.5)', tension: 0.1 },
        { label: 'Certificati KO', data: allDates.map(d => dataMap[d].cert_ko), borderColor: '#0dcaf0', backgroundColor: 'rgba(13, 202, 240, 0.5)', tension: 0.1 },
        { label: 'Update KO', data: allDates.map(d => dataMap[d].update_ko), borderColor: '#d63384', backgroundColor: 'rgba(214, 51, 132, 0.5)', tension: 0.1 },
        { label: 'Spool KO', data: allDates.map(d => dataMap[d].spool_ko), borderColor: '#6c757d', backgroundColor: 'rgba(108, 117, 125, 0.5)', tension: 0.1 },
    ];
    let displayIndices = allDates.map((_, index) => index);
    if (allDates.length > 30) { /* ... logica displayIndices ... */ }
    // console.log("servicesTimelineChartData calculated:", { labels: allDates.length });
    return { labels: allDates, datasets, _config: { displayIndices } };
  }, [dashboardData]);


  // Verifica dati prima del rendering (più robusto)
  if (!dashboardData || !dashboardData.kpis || !dashboardData.charts) {
     console.warn("Dati dashboard non pronti o in formato non valido:", dashboardData);
     return <div className="no-data-message">Dati dashboard non disponibili o in formato non valido. Riprova ad aggiornare i filtri.</div>;
  }

  // Funzioni mock per esportazione (invariate)
  window.exportToPDF = () => alert('Esportazione PDF non implementata.');
  window.exportToExcel = () => alert('Esportazione Excel non implementata.');

  // Helper per classe CSS trend (invariato)
  const getTrendClass = (trendValue) => trendValue > 0 ? 'negative' : trendValue < 0 ? 'positive' : '';

  // Opzioni comuni per i grafici
  const commonChartOptions = useMemo(() => (titleText = '') => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 }, // Aggiungi animazione base
      plugins: {
          legend: {
              position: 'top',
              labels: {
                  color: theme === 'dark' ? '#e0e0e0' : '#333',
                  boxWidth: 12, padding: 15, font: { size: 11 },
                  // Usa filter per nascondere dalla legenda se non ci sono dati
                  filter: (legendItem, chartData) => {
                      const dataset = chartData.datasets[legendItem.datasetIndex];
                      // Controlla se tutti i dati nel dataset sono null, undefined o 0
                      return dataset.data.some(value => value !== null && value !== undefined && value !== 0);
                  }
              }
          },
          tooltip: {
              backgroundColor: theme === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
              titleColor: theme === 'dark' ? '#e0e0e0' : '#333',
              bodyColor: theme === 'dark' ? '#e0e0e0' : '#333',
              borderColor: theme === 'dark' ? '#777' : '#ddd',
              borderWidth: 1,
              padding: 10,
              boxPadding: 3 // Spazio interno tooltip
          },
          title: { display: !!titleText, text: titleText, color: theme === 'dark' ? '#e0e0e0' : '#333', font: { size: 14 } }
      },
      scales: {
          y: {
              beginAtZero: true,
              ticks: { color: theme === 'dark' ? '#aaa' : '#666', font: { size: 10 }, precision: 0 }, // Precisione 0 per numeri interi
              grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' } // Griglia più tenue
          },
          x: {
              ticks: { color: theme === 'dark' ? '#aaa' : '#666', font: { size: 10 } },
              grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' } // Griglia più tenue
          }
      }
  }), [theme]); // Dipende solo dal tema

  // Opzioni specifiche per i grafici
   const lineChartOptions = useMemo(() => {
        const options = commonChartOptions(); // Ottieni opzioni comuni
        options.interaction = { mode: 'index', intersect: false };
        options.elements = { line: { tension: 0.3 }, point: { radius: 2, hitRadius: 10, hoverRadius: 5 } };
        options.scales.x.ticks = { // Override tick X specifici
            ...options.scales.x.ticks, // Mantieni colore/font comuni
            maxRotation: 70, minRotation: 45, autoSkip: true, maxTicksLimit: 20,
            callback: function(value, index) {
                const labels = issuesByTimeChartData?.labels; // Usa i dati del primo grafico
                if (!labels) return '';
                const total = labels.length;
                if (total <= 20) return labels[index];
                const interval = Math.max(1, Math.floor(total / 15)); // Assicura intervallo >= 1
                if (index === 0 || index === total - 1 || index % interval === 0) return labels[index];
                return '';
            }
        };
        // Aggiungi titolo asse Y
        options.scales.y.title = { display: true, text: 'Numero Issues / Servizi KO', color: theme === 'dark' ? '#aaa' : '#666' };
        return options;
   }, [commonChartOptions, issuesByTimeChartData, theme]); // Aggiunto theme

   const barChartOptions = useMemo(() => commonChartOptions(), [commonChartOptions]);

   const horizontalBarChartOptions = useMemo(() => {
        const options = commonChartOptions();
        options.indexAxis = 'y';
        options.scales = { // Inverti e adatta scale
            x: { // Asse X per valori
                beginAtZero: true,
                ticks: { color: theme === 'dark' ? '#aaa' : '#666', font: { size: 10 }, precision: 0 },
                grid: { color: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
                title: { display: true, text: 'Numero Issues', color: theme === 'dark' ? '#aaa' : '#666' } // Titolo asse X
            },
            y: { // Asse Y per etichette
                ticks: { color: theme === 'dark' ? '#aaa' : '#666', font: { size: 10 } },
                grid: { display: false } // Nascondi griglia verticale
            }
        };
        return options;
   }, [commonChartOptions, theme]);

   const doughnutChartOptions = useMemo(() => ({
       responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
       cutout: '65%', // Rendi il buco più grande
       plugins: {
           legend: {
               position: 'right',
               labels: {
                   color: theme === 'dark' ? '#e0e0e0' : '#333',
                   boxWidth: 12, padding: 10, font: { size: 10 },
                   generateLabels: (chart) => {
                       const data = chart.data;
                       if (data?.labels?.length && data.datasets?.length) {
                          return data.labels.slice(0, 15).map((label, i) => {
                               const textLabel = label || 'N/D';
                               const hidden = !chart.getDataVisibility(i); // Ottieni stato visibilità
                               return {
                                   text: textLabel.length > 20 ? textLabel.substring(0, 17)+'...' : textLabel,
                                   fillStyle: data.datasets[0].backgroundColor[i],
                                   hidden: hidden, // Applica lo stato corretto
                                   index: i,
                                   strokeStyle: data.datasets[0].borderColor[i],
                                   lineWidth: data.datasets[0].borderWidth,
                                   fontColor: theme === 'dark' ? '#e0e0e0' : '#333' // Applica colore tema
                               };
                          });
                       } return [];
                   }
               }
           },
           tooltip: {
               backgroundColor: theme === 'dark' ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.9)',
               titleColor: theme === 'dark' ? '#e0e0e0' : '#333', bodyColor: theme === 'dark' ? '#e0e0e0' : '#333',
               borderColor: theme === 'dark' ? '#777' : '#ddd', borderWidth: 1, padding: 10, boxPadding: 3,
               callbacks: { label: function(context) {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${percentage}%)`;
               }}
           }
       }
   }), [theme]); // Dipende solo da theme

    // Opzioni specifiche per il grafico Timeline Servizi KO Dettaglio
    const servicesLineChartOptions = useMemo(() => {
        const options = commonChartOptions();
        options.interaction = { mode: 'index', intersect: false };
        options.elements = { line: { tension: 0.3 }, point: { radius: 2, hitRadius: 10, hoverRadius: 5 } };
        options.scales.y.title = { display: true, text: 'Numero Servizi KO (Dettaglio)', color: theme === 'dark' ? '#aaa' : '#666' };
        options.scales.x.ticks = {
            ...options.scales.x.ticks,
            maxRotation: 70, minRotation: 45, autoSkip: true, maxTicksLimit: 20,
            callback: function(value, index) { // Usa i dati specifici di questo grafico
                const labels = servicesTimelineChartData?.labels;
                if (!labels) return '';
                const total = labels.length;
                if (total <= 20) return labels[index];
                const interval = Math.max(1, Math.floor(total / 15));
                if (index === 0 || index === total - 1 || index % interval === 0) return labels[index];
                return '';
            }
        };
        // ========================================================
        // MODIFICA: Rimuovi il filtro dalla legenda che nascondeva i servizi
        // ========================================================
        // Assicurati che il filtro base (per dati a zero) sia attivo
        if (!options.plugins.legend.labels.filter) {
             options.plugins.legend.labels.filter = (legendItem, chartData) => {
                 const dataset = chartData.datasets[legendItem.datasetIndex];
                 return dataset.data.some(value => value !== null && value !== undefined && value !== 0);
             };
        }
        // ========================================================
        // FINE MODIFICA
        // ========================================================
        return options;
   }, [commonChartOptions, servicesTimelineChartData, theme]); // Dipende da opzioni comuni e dati specifici


  return (
    <div className="dashboard-content-wrapper" ref={dashboardRef}>

      {/* SEZIONE KPI */}
      <div className="kpi-grid">
          {/* KPI Cards */}
          <div className="kpi-card">
            <h3>Dumps Totali</h3>
            <div className="kpi-value">{dashboardData.kpis.totalDumps?.value ?? 0}</div>
            {dashboardData.kpis.totalDumps?.trend !== undefined && dashboardData.kpis.totalDumps?.trend !== 0 && (
               <div className={`kpi-trend ${getTrendClass(dashboardData.kpis.totalDumps.trend)}`}>
                 <span className="trend-label">{dashboardData.kpis.totalDumps.trendLabel || `${dashboardData.kpis.totalDumps.trend.toFixed(1)}%`}</span>
               </div>
            )}
          </div>
          <div className="kpi-card">
            <h3>Backup Falliti</h3>
            <div className="kpi-value error">{dashboardData.kpis.failedBackups?.value ?? 0}</div>
             {dashboardData.kpis.failedBackups?.trend !== undefined && dashboardData.kpis.failedBackups?.trend !== 0 && (
               <div className={`kpi-trend ${getTrendClass(dashboardData.kpis.failedBackups.trend)}`}>
                 <span className="trend-label">{dashboardData.kpis.failedBackups.trendLabel || `${dashboardData.kpis.failedBackups.trend.toFixed(1)}%`}</span>
               </div>
             )}
          </div>
          <div className="kpi-card">
            <h3>Job Cancellati</h3>
            <div className="kpi-value warning">{dashboardData.kpis.cancelledJobs?.value ?? 0}</div>
             {dashboardData.kpis.cancelledJobs?.trend !== undefined && dashboardData.kpis.cancelledJobs?.trend !== 0 && (
                <div className={`kpi-trend ${getTrendClass(dashboardData.kpis.cancelledJobs.trend)}`}>
                 <span className="trend-label">{dashboardData.kpis.cancelledJobs.trendLabel || `${dashboardData.kpis.cancelledJobs.trend.toFixed(1)}%`}</span>
               </div>
             )}
          </div>
          <div className="kpi-card">
            <h3>Servizi KO</h3>
            <div className="kpi-value error">{dashboardData.kpis.servicesKO?.value ?? 0}</div>
          </div>
      </div>

      {/* SEZIONE GRAFICI */}
      <div className="charts-grid">

        {/* Issues Timeline (ORA MOSTRA ANCHE TOTALE SERVIZI KO) */}
        <div className="chart-card full-width">
          <h2>Issues Timeline</h2>
          <p className="chart-subtitle">Andamento temporale problemi principali e Servizi KO totali</p>
          {issuesByTimeChartData ? (
            <div className="chart-container chart-container-timeline">
              {/* Usa le opzioni lineChartOptions (già definite per questo grafico) */}
              <Line key={`line-issues-${theme}-${issuesByTimeChartData.labels?.length ?? 0}`} data={issuesByTimeChartData} options={lineChartOptions} />
            </div>
          ) : <div className="no-data-message">Nessun dato timeline issues.</div> }
        </div>

        {/* Services KO Timeline (DETTAGLIO SERVIZI SINGOLI - ORA MOSTRA TUTTI) */}
        <div className="chart-card full-width">
          <h2>Andamento Dettaglio Servizi KO</h2>
          <p className="chart-subtitle">Numero di singoli servizi critici in stato KO nel tempo</p>
          {servicesTimelineChartData ? (
            <div className="chart-container chart-container-timeline">
              {/* Usa le opzioni specifiche servicesLineChartOptions */}
              <Line key={`line-services-${theme}-${servicesTimelineChartData.labels?.length ?? 0}`} data={servicesTimelineChartData} options={servicesLineChartOptions} />
            </div>
          ) : <div className="no-data-message">Nessun dato timeline servizi KO.</div> }
        </div>

        {/* Issues by Client */}
        <div className="chart-card">
          <h2>Issues by Client</h2>
          <p className="chart-subtitle">Raggruppati per cliente</p>
          {issuesByClientChartData ? (
            <div className="chart-container">
              <Bar key={`bar-client-${theme}-${issuesByClientChartData.labels?.length ?? 0}`} data={issuesByClientChartData} options={barChartOptions} />
            </div>
          ) : <div className="no-data-message">Nessun dato per cliente.</div> }
        </div>

        {/* Dump Types */}
        <div className="chart-card">
          <h2>Dump Types</h2>
          <p className="chart-subtitle">Tipi di dump più frequenti (Top 15)</p>
          {dumpTypesChartData ? (
            <div className="chart-container">
              <Doughnut key={`doughnut-${theme}-${dumpTypesChartData.labels?.length ?? 0}`} data={dumpTypesChartData} options={doughnutChartOptions} />
            </div>
          ) : <div className="no-data-message">Nessun dato sui tipi di dump.</div> }
        </div>

         {/* Issues by SID */}
         <div className="chart-card full-width">
           <h2>Issues by SID</h2>
           <p className="chart-subtitle">Dettaglio per SID (Top 20)</p>
           {issuesBySIDChartData ? (
             <div className="chart-container horizontal-bar-chart" style={{ height: `${Math.max(350, (issuesBySIDChartData.labels?.length || 0) * 25 + 50)}px` }}> {/* Aggiunto +50 per margine */}
               <Bar key={`bar-sid-${theme}-${issuesBySIDChartData.labels?.length ?? 0}`} data={issuesBySIDChartData} options={horizontalBarChartOptions} />
             </div>
           ) : <div className="no-data-message">Nessun dato per SID.</div> }
         </div>
      </div>

      {/* SEZIONE TABELLA */}
      {dashboardData.charts?.issuesByClient?.length > 0 ? (
        <div className="details-table">
            <h2>Riepilogo Dettagliato</h2>
            <table>
              <thead><tr><th>Cliente</th><th>SID</th><th>Dumps</th><th>Backup Falliti</th><th>Job Cancellati</th><th>Totale</th></tr></thead>
              <tbody>
                {dashboardData.charts.issuesByClient
                  .sort((a, b) => (a.nomecliente?.localeCompare(b.nomecliente || '') || a.sid?.localeCompare(b.sid || ''))) // Sort più robusto
                  .map((item, index, array) => {
                      const total = (parseInt(item.dumps||0) + parseInt(item.failed_backups||0) + parseInt(item.cancelled_jobs||0));
                      const isFirst = index === 0 || array[index - 1].nomecliente !== item.nomecliente;
                      return (
                        <tr key={`${item.nomecliente}-${item.sid}`} className={isFirst ? 'first-of-client' : ''}>
                          <td>{isFirst ? <strong>{item.nomecliente || 'N/D'}</strong> : ''}</td>
                          <td>{item.sid || 'N/D'}</td>
                          <td className={parseInt(item.dumps||0) > 0 ? 'warning' : ''}>{item.dumps || 0}</td>
                          <td className={parseInt(item.failed_backups||0) > 0 ? 'error' : ''}>{item.failed_backups || 0}</td>
                          <td className={parseInt(item.cancelled_jobs||0) > 0 ? 'warning' : ''}>{item.cancelled_jobs || 0}</td>
                          <td><strong>{total}</strong></td>
                        </tr>
                      );
                  })}
              </tbody>
            </table>
        </div>
      ) : (
          <div className="no-data-message">Nessun dato dettagliato disponibile per la tabella.</div>
      )}
    </div>
  );
};

DashboardContent.propTypes = {
  dashboardData: PropTypes.object,
  dashboardRef: PropTypes.oneOfType([ PropTypes.func, PropTypes.shape({ current: PropTypes.instanceOf(Element) }) ]).isRequired,
  theme: PropTypes.string.isRequired
};

// Definizioni helper se non importate
// const generateColors = (count) => { ... }

export default DashboardContent;

