const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const cors = require('cors');
const { runSAPQuery } = require('./services/athena-service');
const dynamodbService = require('./services/dynamodb-service');
const { v4: uuidv4 } = require('uuid');
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

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================
const getUserClaims = (req) => {
  try {
    // Tenta di ottenere i claims dall'authorizer di API Gateway
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;

    if (!claims) {
      // Fallback: usa header di test se i claims non sono presenti (utile per test locali)
      console.log('⚠️  Claims Cognito non disponibili, uso header di test');
      const userRole = req.headers['x-user-role'] || 'admin'; // Default a 'admin' se non specificato
      const userClientName = req.headers['x-user-client'] || null; // Default a null se non specificato
      return { userRole, userClientName };
    }

    // Estrae ruolo e nome cliente dai claims Cognito
    const userRole = claims['custom:ruolo'];
    const userClientName = claims['custom:nomeCliente'];
    console.log(`👤 Claims Cognito: ruolo=${userRole}, cliente=${userClientName}`);
    return { userRole, userClientName };
  } catch (err) {
    // Gestisce errori nell'estrazione dei claims, fornendo un default sicuro
    console.error('❌ Errore estrazione claims:', err);
    return { userRole: 'admin', userClientName: null }; // Default sicuro a 'admin' in caso di errore
  }
};

// ============================================
// ROOT ENDPOINT
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: 'API Server is running',
    endpoints: {
      sap: ['/api/sap/clients', '/api/sap/sids', '/api/sap/dashboard'],
      agenda: ['/api/agenda/tasks', '/api/agenda/debug', '/api/agenda/mock']
    }
  });
});

// ============================================
// SAP ENDPOINTS
// ============================================
// index.js
// index.js - DOPO (SICURO)
app.get('/api/sap/clients', async (req, res) => {
  console.log('🔍 GET /api/sap/clients');
  try {
    // --- INIZIO CONTROLLO SICUREZZA ---
    const { userRole, userClientName } = getUserClaims(req);
    // --- FINE CONTROLLO SICUREZZA ---

    // --- INIZIO LOGICA SEGREGAZIONE ---
    if (userRole === 'cliente' && userClientName) {
      // Se è un cliente, restituisci SOLO il suo nome
      console.log(`🔒 Filtro cliente applicato per /api/sap/clients: ${userClientName}`);
      return res.json([{ nomecliente: userClientName }]);
    }
    // --- FINE LOGICA SEGREGAZIONE ---

    // Se è admin, carica tutti i clienti
    console.log('👑 Admin richiede tutti i clienti');
    const query = getAvailableClientsQuery();
    const results = await runSAPQuery(query);
    res.json(results);
    
  } catch (error) {
    console.error('❌ Errore recupero clienti:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei clienti.' });
  }
});

app.post('/api/sap/sids', async (req, res) => {
  console.log('🔍 POST /api/sap/sids');
  try {
    const { clients } = req.body;
    const query = getAvailableSIDsQuery(clients);
    const results = await runSAPQuery(query);
    res.json(results);
  } catch (error) {
    console.error('❌ Errore recupero SID:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei SID.' });
  }
});

// Endpoint per ottenere i SID per un cliente specifico (GET) - usato dal form agenda
app.get('/api/sap/sids', async (req, res) => {
  console.log('🔍 GET /api/sap/sids');
  try {
    const { clientName } = req.query;

    if (!clientName) {
      return res.status(400).json({ error: 'Parametro clientName è richiesto.' });
    }

    // Query diretta Athena per ottenere i SID distinti per un dato nomecliente
    const query = `
      SELECT DISTINCT sid
      FROM "sap_reports_db"."reportparquet"
      WHERE nomecliente = '${clientName.replace(/'/g, "''")}' -- Sanitize input
      ORDER BY sid
    `;

    const results = await runSAPQuery(query);
    res.json(results);
  } catch (error) {
    console.error('❌ Errore recupero SID:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei SID.', details: error.message });
  }
});


// Endpoint principale per i dati della Dashboard SAP
app.post('/api/sap/dashboard', async (req, res) => {
  console.log('🔍 POST /api/sap/dashboard');
  try {
    const filters = req.body; // Filtri inviati dal frontend (date, clients, sids)
    // --- INIZIO LOGICA IDENTIFICAZIONE UTENTE ---
    const { userRole, userClientName } = getUserClaims(req);
    // --- FINE LOGICA IDENTIFICAZIONE UTENTE ---

    // --- INIZIO LOGICA SEGREGAZIONE DASHBOARD ---
    if (userRole === 'cliente' && userClientName) {
      // Se l'utente è un cliente, FORZA i filtri a usare solo il suo nome cliente
      console.log(`🔒 Filtro cliente applicato per SAP Dashboard: ${userClientName}`);
      filters.clients = [userClientName];
      // Nota: Non è necessario controllare i SID qui, perché la query Athena
      // userà `filters.clients` che ora contiene solo il cliente corretto.
      // Se l'utente cliente deseleziona tutti i SID nel frontend, `filters.sids` sarà vuoto
      // e la query Athena non filtrerà per SID (mostrando tutti i SID del suo cliente).
    }
    // --- FINE LOGICA SEGREGAZIONE DASHBOARD ---

    // Esegue tutte le query Athena necessarie in parallelo
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
      runSAPQuery(getTotalDumpsQuery(filters)), // Passa i filtri (potenzialmente modificati)
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

    // Calcola i KPI aggregati dai risultati delle query
    const totalDumps = dumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const totalFailedBackups = backupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const totalCancelledJobs = jobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);
    const prevTotalDumps = prevDumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const prevTotalBackups = prevBackupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const prevTotalJobs = prevJobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);

    // Calcola i trend percentuali rispetto al periodo precedente
    const dumpsTrend = prevTotalDumps > 0 ? ((totalDumps - prevTotalDumps) / prevTotalDumps * 100).toFixed(1) : 0;
    const backupsTrend = prevTotalBackups > 0 ? ((totalFailedBackups - prevTotalBackups) / prevTotalBackups * 100).toFixed(1) : 0;
    const jobsTrend = prevTotalJobs > 0 ? ((totalCancelledJobs - prevTotalJobs) / prevTotalJobs * 100).toFixed(1) : 0;

    // Conta i servizi in stato 'ko'
    let servicesKO = 0;
    servicesData.forEach(row => {
      if (row.dump_status === 'ko') servicesKO++;
      if (row.job_error_status === 'ko') servicesKO++;
      if (row.db_space_status === 'ko') servicesKO++;
      if (row.log_space_status === 'ko') servicesKO++;
    });

    // Costruisce la risposta JSON strutturata per il frontend
    res.json({
      kpis: {
        totalDumps: { value: totalDumps, trend: parseFloat(dumpsTrend), trendLabel: `${dumpsTrend > 0 ? '+' : ''}${dumpsTrend}%` },
        failedBackups: { value: totalFailedBackups, trend: parseFloat(backupsTrend), trendLabel: `${backupsTrend > 0 ? '+' : ''}${backupsTrend}%` },
        cancelledJobs: { value: totalCancelledJobs, trend: parseFloat(jobsTrend), trendLabel: `${jobsTrend > 0 ? '+' : ''}${jobsTrend}%` },
        servicesKO: { value: servicesKO, trend: 0, trendLabel: 'N/A' }
      },
      charts: {
        issuesByClient: issuesByClientData, // Dati aggregati per cliente/SID
        dumpTypes: dumpTypesData,           // Distribuzione tipi di dump
        servicesTimeline: servicesTimelineData, // Andamento servizi nel tempo
        problemsTimeline: problemsTimelineData // Andamento problemi nel tempo
      },
      rawData: { // Dati grezzi per eventuale export Excel
        dumps: dumpsData,
        backups: backupsData,
        jobs: jobsData,
        services: servicesData
      }
    });

  } catch (error) {
    console.error('❌ Errore dashboard SAP:', error);
    res.status(500).json({
      error: 'Errore durante il recupero dei dati della dashboard.',
      details: error.message
    });
  }
});

// ============================================
// AGENDA ENDPOINTS
// ============================================

// Endpoint di Debug per l'API Agenda
app.get('/api/agenda/debug', (req, res) => {
  console.log('🔍 GET /api/agenda/debug');
  const { userRole, userClientName } = getUserClaims(req); // Ottiene info utente
  res.json({
    message: 'Agenda API è disponibile',
    user: { role: userRole, client: userClientName }, // Mostra ruolo e cliente rilevati
    dynamoConfig: {
      region: require('./config').AWS_REGION, // Mostra regione DynamoDB
      tableName: 'AgendaTasks' // Mostra nome tabella DynamoDB
    },
    endpoints: [ // Elenca gli endpoint disponibili
      { method: 'GET', path: '/api/agenda/tasks', params: ['yearMonth', 'nomeCliente (solo admin)'] },
      { method: 'POST', path: '/api/agenda/tasks', body: 'task object (solo admin)' },
      { method: 'PUT', path: '/api/agenda/tasks/:id', body: 'updated task object (admin o cliente se permesso)' },
      { method: 'DELETE', path: '/api/agenda/tasks/:id', params: ['id (solo admin)'] }
    ]
  });
});

// GET tasks per l'agenda (mese specifico, opzionalmente per cliente)
app.get('/api/agenda/tasks', async (req, res) => {
  console.log('📅 GET /api/agenda/tasks - Query:', req.query);
  try {
    // --- INIZIO LOGICA IDENTIFICAZIONE UTENTE ---
    const { userRole, userClientName } = getUserClaims(req);
    // --- FINE LOGICA IDENTIFICAZIONE UTENTE ---
    const { yearMonth, nomeCliente } = req.query; // Estrae parametri dalla query string

    // Validazione parametro obbligatorio yearMonth
    if (!yearMonth) {
      return res.status(400).json({ error: 'Parametro yearMonth è richiesto (formato YYYY-MM).' });
    }

    let tasks;
    // --- INIZIO LOGICA SEGREGAZIONE AGENDA ---
    if (userRole === 'admin') {
      // Se l'utente è admin, può vedere tutto o filtrare per cliente
      if (nomeCliente) {
        // Se l'admin specifica un cliente, filtra per quel cliente
        console.log(`👑 Admin richiede agenda per cliente: ${nomeCliente}`);
        tasks = await dynamodbService.getTasksByClientAndMonth(nomeCliente, yearMonth);
      } else {
        // Se l'admin non specifica un cliente, vede tutte le attività del mese
        console.log(`👑 Admin richiede tutte le attività del mese: ${yearMonth}`);
        tasks = await dynamodbService.getTasksByMonth(yearMonth);
      }
    } else if (userRole === 'cliente' && userClientName) {
      // Se l'utente è un cliente, FORZA la visualizzazione solo delle sue attività
      console.log(`👤 Cliente ${userClientName} richiede la sua agenda`);
      // IGNORA il parametro 'nomeCliente' dalla query e usa 'userClientName' dai claims
      tasks = await dynamodbService.getTasksByClientAndMonth(userClientName, yearMonth);
    } else {
      // Se non è admin e non è un cliente riconosciuto, nega l'accesso
      console.log('🚫 Accesso negato per ruolo/cliente non valido:', userRole, userClientName);
      return res.status(403).json({ error: 'Accesso negato.' });
    }
    // --- FINE LOGICA SEGREGAZIONE AGENDA ---

    console.log(`✅ ${tasks.length} attività trovate per ${yearMonth}`);
    res.json(tasks); // Invia le attività trovate come risposta JSON
  } catch (error) {
    console.error('❌ Errore recupero attività agenda:', error);
    res.status(500).json({ error: 'Errore durante il recupero delle attività.', details: error.message });
  }
});


// POST new task (solo admin)
app.post('/api/agenda/tasks', async (req, res) => {
  console.log('📝 POST /api/agenda/tasks');
  try {
    const { userRole, userClientName } = getUserClaims(req); // Identifica l'utente

    // --- CONTROLLO AUTORIZZAZIONE ---
    if (userRole !== 'admin') {
      console.log('🚫 Tentativo creazione attività da non admin:', userRole);
      return res.status(403).json({ error: 'Solo gli amministratori possono creare attività.' });
    }
    // --- FINE CONTROLLO AUTORIZZAZIONE ---

    const task = req.body; // Dati della nuova attività dal corpo della richiesta
    task.id = uuidv4(); // Genera un ID univoco
    // Imposta campi di audit
    task.createdBy = userClientName || 'admin'; // Chi ha creato l'attività
    task.lastModifiedBy = userClientName || 'admin'; // Chi ha modificato per ultimo
    const now = new Date().toISOString();
    task.createdAt = now; // Data creazione
    task.updatedAt = now; // Data ultima modifica

    // Salva l'attività nel database
    const newTask = await dynamodbService.createTask(task);
    console.log(`✅ Attività creata con ID: ${newTask.id}`);

    res.status(201).json(newTask); // Risponde con l'attività creata e status 201
  } catch (error) {
    console.error('❌ Errore creazione attività:', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'attività.', details: error.message });
  }
});

// PUT update task (admin o cliente autorizzato)
app.put('/api/agenda/tasks/:id', async (req, res) => {
  const { id } = req.params; // ID dell'attività da aggiornare
  console.log(`✏️  PUT /api/agenda/tasks/${id}`);
  try {
    const { userRole, userClientName } = getUserClaims(req); // Identifica l'utente
    const updates = req.body; // Dati da aggiornare

    // Recupera l'attività esistente per controlli di sicurezza
    const existingTask = await dynamodbService.getTaskById(id);
    if (!existingTask) {
      console.log(`⚠️ Attività non trovata con ID: ${id}`);
      return res.status(404).json({ error: 'Attività non trovata.' });
    }

    // --- LOGICA DI AUTORIZZAZIONE PER AGGIORNAMENTO ---
    let canUpdate = false;
    if (userRole === 'admin') {
      // Admin può sempre aggiornare
      canUpdate = true;
      updates.lastModifiedBy = userClientName || 'admin'; // Aggiorna chi ha modificato
      console.log(`👑 Admin ${updates.lastModifiedBy} sta aggiornando l'attività ${id}`);
    } else if (userRole === 'cliente' && userClientName) {
      // Cliente può aggiornare SOLO se è la sua attività E se l'admin ha concesso il permesso
      if (existingTask.nomeCliente.toLowerCase() !== userClientName.toLowerCase()) {
        // Tentativo di modifica attività di altro cliente
        console.log(`🚫 Cliente ${userClientName} ha tentato di modificare attività di ${existingTask.nomeCliente}`);
        return res.status(403).json({ error: 'Non puoi modificare attività di altri clienti.' });
      }
      // Il cliente può aggiornare lo stato (accetta/rifiuta) anche se canClientEdit è false
      const isStatusUpdateOnly = Object.keys(updates).length === 1 && updates.status;
      if (existingTask.canClientEdit || isStatusUpdateOnly) {
         // Cliente autorizzato a modificare (o sta solo cambiando lo stato)
        canUpdate = true;
        updates.lastModifiedBy = userClientName; // Aggiorna chi ha modificato
        console.log(`👤 Cliente ${userClientName} sta aggiornando l'attività ${id}. Permesso modifica: ${existingTask.canClientEdit}, Solo stato: ${isStatusUpdateOnly}`);
      } else {
        // Cliente non autorizzato a modificare i dettagli
         console.log(`🚫 Cliente ${userClientName} non ha il permesso di modificare i dettagli dell'attività ${id}`);
        return res.status(403).json({ error: 'Questa attività non può essere modificata dal cliente.' });
      }
    } else {
       // Utente non riconosciuto o ruolo non valido
      console.log('🚫 Accesso negato per aggiornamento attività. Ruolo/Cliente:', userRole, userClientName);
      return res.status(403).json({ error: 'Accesso negato.' });
    }
    // --- FINE LOGICA DI AUTORIZZAZIONE ---

    if (!canUpdate) {
       // Doppio controllo di sicurezza
       console.log('🚫 Aggiornamento non consentito per attività:', id);
       return res.status(403).json({ error: 'Non autorizzato ad aggiornare questa attività.' });
    }

    // Imposta timestamp ultima modifica
    updates.updatedAt = new Date().toISOString();

    // Esegue l'aggiornamento nel database
    const updatedTask = await dynamodbService.updateTask(id, updates);
    console.log(`✅ Attività ${id} aggiornata con successo`);

    res.json(updatedTask); // Risponde con l'attività aggiornata
  } catch (error) {
    console.error(`❌ Errore aggiornamento attività ${id}:`, error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'attività.', details: error.message });
  }
});


// DELETE task (solo admin)
app.delete('/api/agenda/tasks/:id', async (req, res) => {
  const { id } = req.params; // ID dell'attività da eliminare
  console.log(`🗑️  DELETE /api/agenda/tasks/${id}`);
  try {
    const { userRole } = getUserClaims(req); // Identifica l'utente

    // --- CONTROLLO AUTORIZZAZIONE ---
    if (userRole !== 'admin') {
      console.log('🚫 Tentativo eliminazione attività da non admin:', userRole);
      return res.status(403).json({ error: 'Solo gli amministratori possono eliminare attività.' });
    }
    // --- FINE CONTROLLO AUTORIZZAZIONE ---

    // Esegue l'eliminazione nel database
    await dynamodbService.deleteTask(id);
    console.log(`✅ Attività ${id} eliminata con successo`);

    res.json({ message: 'Attività eliminata con successo.' }); // Risposta di successo
  } catch (error) {
    console.error(`❌ Errore eliminazione attività ${id}:`, error);
    // Controlla se l'errore è 'Attività non trovata' (potrebbe essere già stata eliminata)
    if (error.code === 'ConditionalCheckFailedException' || error.message.includes('not found')) {
       console.log(`⚠️ Attività ${id} non trovata durante l'eliminazione (potrebbe essere già stata eliminata).`);
       return res.status(404).json({ error: 'Attività non trovata.' });
    }
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'attività.', details: error.message });
  }
});


// Mock endpoint per testare l'agenda senza DynamoDB
app.get('/api/agenda/mock', (req, res) => {
  console.log('🧪 GET /api/agenda/mock');
  const { yearMonth } = req.query; // Mese richiesto

  if (!yearMonth) {
    return res.status(400).json({ error: 'Parametro yearMonth è richiesto.' });
  }

  // Genera dati mock per il mese richiesto
  const mockData = [
    {
      id: "mock-1",
      nomeCliente: "fope", // Cliente fittizio
      sid: "PRD",
      data: `${yearMonth}-15`, // Giorno 15 del mese richiesto
      oraInizio: "09:00",
      orarioFine: "11:00",
      emailCliente: "cliente@fope.it",
      descrizione: "Controllo performance sistema PRD",
      createdBy: "admin",
      lastModifiedBy: "admin",
      canClientEdit: false, // Cliente non può modificare
      status: 'accettata', // Stato dell'attività
      createdAt: new Date(`${yearMonth}-10T10:00:00Z`).toISOString(),
      updatedAt: new Date(`${yearMonth}-12T15:30:00Z`).toISOString()
    },
    {
      id: "mock-2",
      nomeCliente: "altro_cliente", // Altro cliente fittizio
      sid: "DEV",
      data: `${yearMonth}-22`, // Giorno 22 del mese richiesto
      oraInizio: "14:00",
      orarioFine: "16:00",
      emailCliente: "dev@altro.it",
      descrizione: "Applicazione patch DEV",
      createdBy: "admin",
      lastModifiedBy: "cliente_altro",
      canClientEdit: true, // Cliente può modificare
      status: 'proposta', // Stato dell'attività
      createdAt: new Date(`${yearMonth}-18T08:00:00Z`).toISOString(),
      updatedAt: new Date(`${yearMonth}-20T11:00:00Z`).toISOString()
    }
  ];

  // Filtra i dati mock in base all'utente (se fosse necessario, ma qui l'admin vede tutto)
  const { userRole, userClientName } = getUserClaims(req);
  let responseData = mockData;
  if (userRole === 'cliente' && userClientName) {
     responseData = mockData.filter(task => task.nomeCliente.toLowerCase() === userClientName.toLowerCase());
  }

  console.log(`🧪 Mock: inviando ${responseData.length} attività per ${yearMonth}`);
  res.json(responseData);
});


// ============================================
// 404 HANDLER (Catch-all per route non trovate)
// ============================================
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint non trovato', path: req.originalUrl });
});

// ============================================
// ERROR HANDLER GLOBALE (Opzionale ma raccomandato)
// ============================================
app.use((err, req, res, next) => {
  console.error('💥 Errore non gestito:', err.stack || err);
  res.status(500).json({
    error: 'Errore interno del server.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined // Mostra dettagli solo in sviluppo
  });
});


// ============================================
// EXPORTS (per Serverless Framework o avvio locale)
// ============================================
module.exports.app = app; // Esporta l'app Express per test o avvio diretto
module.exports.handler = serverless(app); // Esporta l'handler per AWS Lambda
