const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const cors = require('cors');
const { runSAPQuery } = require('./services/athena-service');
const dynamodbService = require('./services/dynamodb-service'); // Importa il servizio DynamoDB
const { v4: uuidv4 } = require('uuid'); // Per generare ID unici
const {
  getAvailableClientsQuery,
  getAvailableSIDsQuery,
  getTotalDumpsQuery,
  getFailedBackupsQuery,
  getCancelledJobsQuery,
  getServicesKOQuery,
  getDumpTypesQuery,
  getIssuesByClientQuery,
  getPreviousPeriodData,
  getServicesTimelineQuery,
  getProblemsTimelineQuery
} = require('./queries/sap-queries');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Endpoint root per verifica di connessione
app.get('/', (req, res) => {
  res.json({ message: 'API Server is running. Available endpoints: /api/sap/*, /api/agenda/*' });
});

// ========== ENDPOINT SAP ==========

// Endpoint per ottenere i clienti disponibili
app.get('/api/sap/clients', async (req, res) => {
  try {
    const query = getAvailableClientsQuery();
    const results = await runSAPQuery(query);
    res.json(results);
  } catch (error) {
    console.error('Errore nel recupero dei clienti:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei clienti.' });
  }
});

// Endpoint per ottenere i SID disponibili (opzionalmente filtrati per cliente)
app.post('/api/sap/sids', async (req, res) => {
  try {
    const { clients } = req.body;
    const query = getAvailableSIDsQuery(clients);
    const results = await runSAPQuery(query);
    res.json(results);
  } catch (error) {
    console.error('Errore nel recupero dei SID:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei SID.' });
  }
});

// Endpoint principale per la dashboard SAP
app.post('/api/sap/dashboard', async (req, res) => {
  try {
    const filters = req.body;
    
    // --- INIZIO MODIFICA DI SICUREZZA ---
    // Estrai i claims di Cognito dall'evento API Gateway
    // Nota: il percorso esatto potrebbe variare leggermente in base alla configurazione
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;

    if (claims) {
      const userRole = claims['custom:ruolo'];
      const userClientName = claims['custom:nomeCliente'];

      console.log(`Ruolo utente: ${userRole}, Cliente utente: ${userClientName}`);

      // Se l'utente è un cliente, sovrascrivi il filtro dei clienti
      // per garantire che possa vedere solo i suoi dati.
      if (userRole === 'cliente' && userClientName) {
        console.log(`FORZATURA FILTRO per cliente: ${userClientName}`);
        filters.clients = [userClientName];
      }
    }
    // --- FINE MODIFICA DI SICUREZZA ---

    console.log('Filtri ricevuti (dopo controllo sicurezza):', filters);

    // Esegui tutte le query in parallelo per ottimizzare le performance
    const [
      dumpsData,
      backupsData,
      jobsData,
      servicesData,
      dumpTypesData,
      issuesByClientData,
      prevDumpsData,
      prevBackupsData,
      prevJobsData,
      servicesTimelineData,
      problemsTimelineData
    ] = await Promise.all([
      runSAPQuery(getTotalDumpsQuery(filters)),
      runSAPQuery(getFailedBackupsQuery(filters)),
      runSAPQuery(getCancelledJobsQuery(filters)),
      runSAPQuery(getServicesKOQuery(filters)),
      runSAPQuery(getDumpTypesQuery(filters)),
      runSAPQuery(getIssuesByClientQuery(filters)),
      runSAPQuery(getPreviousPeriodData(filters, 'dumps')),
      runSAPQuery(getPreviousPeriodData(filters, 'backups')),
      runSAPQuery(getPreviousPeriodData(filters, 'jobs')),
      runSAPQuery(getServicesTimelineQuery(filters)),
      runSAPQuery(getProblemsTimelineQuery(filters))
    ]);

    // Calcola i totali
    const totalDumps = dumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const totalFailedBackups = backupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const totalCancelledJobs = jobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);

    // Calcola i trend (confronto con periodo precedente)
    const prevTotalDumps = prevDumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const prevTotalBackups = prevBackupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const prevTotalJobs = prevJobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);

    const dumpsTrend = prevTotalDumps > 0 ? ((totalDumps - prevTotalDumps) / prevTotalDumps * 100).toFixed(1) : 0;
    const backupsTrend = prevTotalBackups > 0 ? ((totalFailedBackups - prevTotalBackups) / prevTotalBackups * 100).toFixed(1) : 0;
    const jobsTrend = prevTotalJobs > 0 ? ((totalCancelledJobs - prevTotalJobs) / prevTotalJobs * 100).toFixed(1) : 0;

    // Conta servizi in KO
    let servicesKO = 0;
    servicesData.forEach(row => {
      if (row.dump_status === 'ko') servicesKO++;
      if (row.job_error_status === 'ko') servicesKO++;
      if (row.db_space_status === 'ko') servicesKO++;
      if (row.log_space_status === 'ko') servicesKO++;
    });

    res.json({
      kpis: {
        totalDumps: {
          value: totalDumps,
          trend: parseFloat(dumpsTrend),
          trendLabel: dumpsTrend > 0 ? `+${dumpsTrend}%` : `${dumpsTrend}%`
        },
        failedBackups: {
          value: totalFailedBackups,
          trend: parseFloat(backupsTrend),
          trendLabel: backupsTrend > 0 ? `+${backupsTrend}%` : `${backupsTrend}%`
        },
        cancelledJobs: {
          value: totalCancelledJobs,
          trend: parseFloat(jobsTrend),
          trendLabel: jobsTrend > 0 ? `+${jobsTrend}%` : `${jobsTrend}%`
        },
        servicesKO: {
          value: servicesKO,
          trend: 0,
          trendLabel: 'N/A'
        }
      },
      charts: {
        issuesByClient: issuesByClientData,
        dumpTypes: dumpTypesData,
        servicesTimeline: servicesTimelineData,
        problemsTimeline: problemsTimelineData
      },
      rawData: {
        dumps: dumpsData,
        backups: backupsData,
        jobs: jobsData,
        services: servicesData
      }
    });

  } catch (error) {
    console.error('Errore nella dashboard SAP:', error);
    res.status(500).json({ 
      error: 'Errore durante il recupero dei dati della dashboard.',
      details: error.message 
    });
  }
});

// ========== ENDPOINT AGENDA ========== 

// Middleware per estrarre i claims dell'utente (ruolo e nomeCliente)
const getUserClaims = (req) => {
  try {
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;
    // Per test/sviluppo, possiamo simulare i claims se non sono disponibili
    if (!claims) {
      console.log('Claims Cognito non disponibili, uso claims di test');
      // Determina il ruolo in base all'header x-user-role se presente, altrimenti usa 'admin'
      const userRole = req.headers['x-user-role'] || 'admin';
      const userClientName = req.headers['x-user-client'] || null;
      return { userRole, userClientName };
    }
    
    const userRole = claims['custom:ruolo'];
    const userClientName = claims['custom:nomeCliente'];
    console.log(`Claims estratti: ruolo=${userRole}, cliente=${userClientName}`);
    return { userRole, userClientName };
  } catch (err) {
    console.error('Errore nell\'estrazione dei claims:', err);
    return { userRole: 'admin', userClientName: null };
  }
};

// Debug endpoint per l'agenda
app.get('/api/agenda/debug', (req, res) => {
  try {
    const { userRole, userClientName } = getUserClaims(req);
    const dynamoConfig = {
      region: require('./config').AWS_REGION,
      tableName: 'AgendaTasks',
      indices: ['ByClientAndDateIndex', 'ByDateAndClientIndex']
    };
    res.json({
      message: 'Agenda API è disponibile',
      user: { role: userRole, client: userClientName },
      dynamoConfig,
      endpoints: [
        { method: 'GET', path: '/api/agenda/tasks', params: ['yearMonth', 'nomeCliente'] },
        { method: 'POST', path: '/api/agenda/tasks', body: 'task object' },
        { method: 'PUT', path: '/api/agenda/tasks/:id', body: 'updated task object' },
        { method: 'DELETE', path: '/api/agenda/tasks/:id' }
      ]
    });
  } catch (error) {
    console.error('Errore nell\'endpoint debug:', error);
    res.status(500).json({ error: 'Errore interno del server', details: error.message });
  }
});

// POST /api/agenda/tasks - Crea una nuova attività (solo Admin)
app.post('/api/agenda/tasks', async (req, res) => {
  console.log('Ricevuta richiesta POST /api/agenda/tasks');
  try {
    const { userRole, userClientName } = getUserClaims(req);
    console.log('Claims utente:', { userRole, userClientName });
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono creare attività.' });
    }

    const task = req.body;
    console.log('Dati attività ricevuti:', task);
    
    // Aggiungi campi necessari
    task.id = uuidv4(); // Genera ID univoco
    task.createdBy = userClientName || 'admin';
    task.lastModifiedBy = userClientName || 'admin';
    task.createdAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    console.log('Creazione attività:', task);
    const newTask = await dynamodbService.createTask(task);
    console.log('Attività creata con successo:', newTask);
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Errore nella creazione attività:', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'attività.', details: error.message });
  }
});

// GET /api/agenda/tasks - Recupera attività per mese/cliente (Admin/Client)
app.get('/api/agenda/tasks', async (req, res) => {
  console.log('Ricevuta richiesta GET /api/agenda/tasks, query:', req.query);
  try {
    const { userRole, userClientName } = getUserClaims(req);
    console.log('Claims utente:', { userRole, userClientName });
    
    const { yearMonth, nomeCliente } = req.query; // yearMonth formato YYYY-MM

    if (!yearMonth) {
      console.log('Errore: yearMonth non specificato');
      return res.status(400).json({ error: 'Parametro yearMonth è richiesto.' });
    }

    console.log(`Recupero attività per yearMonth=${yearMonth}, nomeCliente=${nomeCliente || 'tutti'}, userRole=${userRole}`);
    
    let tasks;
    if (userRole === 'admin') {
      // Admin può filtrare per cliente o vedere tutto il mese
      if (nomeCliente) {
        console.log(`Admin recupera attività per cliente ${nomeCliente} nel mese ${yearMonth}`);
        tasks = await dynamodbService.getTasksByClientAndMonth(nomeCliente, yearMonth);
      } else {
        console.log(`Admin recupera tutte le attività nel mese ${yearMonth}`);
        tasks = await dynamodbService.getTasksByMonth(yearMonth);
      }
    } else if (userRole === 'cliente' && userClientName) {
      // Cliente vede solo le proprie attività
      console.log(`Cliente ${userClientName} recupera le proprie attività nel mese ${yearMonth}`);
      tasks = await dynamodbService.getTasksByClientAndMonth(userClientName, yearMonth);
    } else {
      console.log('Accesso negato: ruolo non riconosciuto o cliente non specificato');
      return res.status(403).json({ error: 'Accesso negato o ruolo utente non riconosciuto.' });
    }

    console.log(`Trovate ${tasks.length} attività`);
    res.json(tasks);
  } catch (error) {
    console.error('Errore nel recupero attività:', error);
    res.status(500).json({ error: 'Errore durante il recupero delle attività.', details: error.message });
  }
});

// PUT /api/agenda/tasks/:id - Aggiorna un'attività (Admin, o Client se abilitato)
app.put('/api/agenda/tasks/:id', async (req, res) => {
  console.log(`Ricevuta richiesta PUT /api/agenda/tasks/${req.params.id}`);
  try {
    const { userRole, userClientName } = getUserClaims(req);
    console.log('Claims utente:', { userRole, userClientName });
    
    const { id } = req.params;
    const updates = req.body;
    console.log('Dati aggiornamento:', updates);

    // Verifica esistenza attività
    console.log(`Verifico esistenza attività con id ${id}`);
    const existingTask = await dynamodbService.getTaskById(id);
    if (!existingTask) {
      console.log(`Attività ${id} non trovata`);
      return res.status(404).json({ error: 'Attività non trovata.' });
    }

    // Controllo autorizzazione
    if (userRole === 'admin') {
      // Admin può modificare qualsiasi attività
      console.log('Utente admin può modificare qualsiasi attività');
      updates.lastModifiedBy = userClientName || 'admin';
    } else if (userRole === 'cliente' && userClientName) {
      // Cliente può modificare solo le proprie attività e solo se canClientEdit è true
      console.log(`Verifico se cliente ${userClientName} può modificare attività ${id}`);
      if (existingTask.nomeCliente !== userClientName) {
        console.log('Accesso negato: cliente non può modificare attività di altri clienti');
        return res.status(403).json({ error: 'Accesso negato. Non puoi modificare attività di altri clienti.' });
      }
      if (!existingTask.canClientEdit) {
        console.log('Accesso negato: attività non modificabile dal cliente');
        return res.status(403).json({ error: 'Accesso negato. Questa attività non può essere modificata dal cliente.' });
      }
      updates.lastModifiedBy = userClientName;
    } else {
      console.log('Accesso negato: ruolo non riconosciuto o cliente non specificato');
      return res.status(403).json({ error: 'Accesso negato o ruolo utente non riconosciuto.' });
    }

    // Aggiorna timestamp
    updates.updatedAt = new Date().toISOString();

    console.log('Aggiorno attività:', updates);
    const updatedTask = await dynamodbService.updateTask(id, updates);
    console.log('Attività aggiornata con successo');
    res.json(updatedTask);
  } catch (error) {
    console.error('Errore nell\'aggiornamento attività:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'attività.', details: error.message });
  }
});

// DELETE /api/agenda/tasks/:id - Elimina un'attività (solo Admin)
app.delete('/api/agenda/tasks/:id', async (req, res) => {
  console.log(`Ricevuta richiesta DELETE /api/agenda/tasks/${req.params.id}`);
  try {
    const { userRole } = getUserClaims(req);
    console.log('Claims utente:', { userRole });
    
    if (userRole !== 'admin') {
      console.log('Accesso negato: solo admin può eliminare attività');
      return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono eliminare attività.' });
    }

    const { id } = req.params;
    console.log(`Elimino attività con id ${id}`);
    await dynamodbService.deleteTask(id);
    console.log('Attività eliminata con successo');
    res.json({ message: 'Attività eliminata con successo.' });
  } catch (error) {
    console.error('Errore nell\'eliminazione attività:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'attività.', details: error.message });
  }
});

// ENDPOINT PER MOCK DATI (solo per sviluppo)
app.get('/api/agenda/mock', (req, res) => {
  const { yearMonth } = req.query;
  
  if (!yearMonth) {
    return res.status(400).json({ error: 'Parametro yearMonth è richiesto.' });
  }
  
  // Mock data per test
  const mockData = [
    {
      id: "f1e2d3c4-b5a6-7890-1234-567890abcdef",
      nomeCliente: "fope",
      sid: "PRD",
      data: "2025-10-20",
      oraInizio: "10:00",
      orarioFine: "12:30",
      emailCliente: "cliente@fope.it",
      descrizione: "Manutenzione ordinaria sistema SAP - Controllo performance",
      createdBy: "admin_user",
      lastModifiedBy: "admin_user", 
      canClientEdit: true,
      createdAt: "2025-10-13T21:00:00.000Z",
      updatedAt: "2025-10-13T21:00:00.000Z"
    },
    {
      id: "d4c3b2a1-9876-5432-1098-765432109876",
      nomeCliente: "casoni",
      sid: "P01",
      data: "2025-10-22",
      oraInizio: "09:30",
      orarioFine: "11:30",
      emailCliente: "cliente@casoni.it",
      descrizione: "Analisi performance database e ottimizzazione query",
      createdBy: "admin_user",
      lastModifiedBy: "admin_user",
      canClientEdit: true,
      createdAt: "2025-10-13T21:10:00.000Z",
      updatedAt: "2025-10-13T21:10:00.000Z"
    }
  ];
  
  // Filtra in base al mese
  const monthPrefix = yearMonth; // ad es. "2025-10"
  const filtered = mockData.filter(task => task.data.startsWith(monthPrefix));
  
  res.json(filtered);
});

// Gestione errori 404
app.use((req, res) => {
  console.log('Endpoint non trovato:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Export for local server
module.exports.app = app;
// Export for serverless
module.exports.handler = serverless(app);