const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const cors = require('cors');
const { runSAPQuery } = require('./services/athena-service');
const dynamodbService = require('./services/dynamodb-service'); // Importa il nuovo servizio DynamoDB
const { v4: uuidv4 } = require('uuid'); // Per generare ID unici se necessario
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
  const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;
  const userRole = claims ? claims['custom:ruolo'] : undefined;
  const userClientName = claims ? claims['custom:nomeCliente'] : undefined;
  return { userRole, userClientName };
};

// POST /api/agenda/tasks - Crea una nuova attività (solo Admin)
app.post('/api/agenda/tasks', async (req, res) => {
  try {
    const { userRole, userClientName } = getUserClaims(req);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono creare attività.' });
    }

    const task = req.body;
    task.createdBy = userClientName || 'admin'; // O un ID utente più specifico
    task.lastModifiedBy = userClientName || 'admin';

    const newTask = await dynamodbService.createTask(task);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Errore nella creazione attività:', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'attività.', details: error.message });
  }
});

// GET /api/agenda/tasks - Recupera attività per mese/cliente (Admin/Client)
app.get('/api/agenda/tasks', async (req, res) => {
  try {
    const { userRole, userClientName } = getUserClaims(req);
    const { yearMonth, nomeCliente } = req.query; // yearMonth formato YYYY-MM

    if (!yearMonth) {
      return res.status(400).json({ error: 'Parametro yearMonth è richiesto.' });
    }

    let tasks;
    if (userRole === 'admin') {
      // Admin può filtrare per cliente o vedere tutto il mese
      if (nomeCliente) {
        tasks = await dynamodbService.getTasksByClientAndMonth(nomeCliente, yearMonth);
      } else {
        tasks = await dynamodbService.getTasksByMonth(yearMonth);
      }
    } else if (userRole === 'cliente' && userClientName) {
      // Cliente vede solo le proprie attività
      tasks = await dynamodbService.getTasksByClientAndMonth(userClientName, yearMonth);
    } else {
      return res.status(403).json({ error: 'Accesso negato o ruolo utente non riconosciuto.' });
    }

    res.json(tasks);
  } catch (error) {
    console.error('Errore nel recupero attività:', error);
    res.status(500).json({ error: 'Errore durante il recupero delle attività.', details: error.message });
  }
});

// PUT /api/agenda/tasks/:id - Aggiorna un'attività (Admin, o Client se abilitato)
app.put('/api/agenda/tasks/:id', async (req, res) => {
  try {
    const { userRole, userClientName } = getUserClaims(req);
    const { id } = req.params;
    const updates = req.body;

    const existingTask = await dynamodbService.getTaskById(id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Attività non trovata.' });
    }

    // Controllo autorizzazione
    if (userRole === 'admin') {
      // Admin può modificare qualsiasi attività
      updates.lastModifiedBy = userClientName || 'admin';
    } else if (userRole === 'cliente' && userClientName) {
      // Cliente può modificare solo le proprie attività e solo se canClientEdit è true
      if (existingTask.nomeCliente !== userClientName) {
        return res.status(403).json({ error: 'Accesso negato. Non puoi modificare attività di altri clienti.' });
      }
      if (!existingTask.canClientEdit) {
        return res.status(403).json({ error: 'Accesso negato. Questa attività non può essere modificata dal cliente.' });
      }
      updates.lastModifiedBy = userClientName;
    } else {
      return res.status(403).json({ error: 'Accesso negato o ruolo utente non riconosciuto.' });
    }

    const updatedTask = await dynamodbService.updateTask(id, updates);
    res.json(updatedTask);
  } catch (error) {
    console.error('Errore nell\'aggiornamento attività:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'attività.', details: error.message });
  }
});

// DELETE /api/agenda/tasks/:id - Elimina un'attività (solo Admin)
app.delete('/api/agenda/tasks/:id', async (req, res) => {
  try {
    const { userRole } = getUserClaims(req);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato. Solo gli amministratori possono eliminare attività.' });
    }

    const { id } = req.params;
    await dynamodbService.deleteTask(id);
    res.json({ message: 'Attività eliminata con successo.' });
  } catch (error) {
    console.error('Errore nell\'eliminazione attività:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'attività.', details: error.message });
  }
});

// Gestione errori 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Export for local server
module.exports.app = app;
// Export for serverless
module.exports.handler = serverless(app);