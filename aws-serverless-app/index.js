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
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;
    
    if (!claims) {
      console.log('⚠️  Claims Cognito non disponibili, uso header di test');
      const userRole = req.headers['x-user-role'] || 'admin';
      const userClientName = req.headers['x-user-client'] || null;
      return { userRole, userClientName };
    }
    
    const userRole = claims['custom:ruolo'];
    const userClientName = claims['custom:nomeCliente'];
    console.log(`👤 Claims: ruolo=${userRole}, cliente=${userClientName}`);
    return { userRole, userClientName };
  } catch (err) {
    console.error('❌ Errore estrazione claims:', err);
    return { userRole: 'admin', userClientName: null };
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
app.get('/api/sap/clients', async (req, res) => {
  console.log('🔍 GET /api/sap/clients');
  try {
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

app.post('/api/sap/dashboard', async (req, res) => {
  console.log('🔍 POST /api/sap/dashboard');
  try {
    const filters = req.body;
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;

    if (claims) {
      const userRole = claims['custom:ruolo'];
      const userClientName = claims['custom:nomeCliente'];

      if (userRole === 'cliente' && userClientName) {
        console.log(`🔒 Filtro cliente: ${userClientName}`);
        filters.clients = [userClientName];
      }
    }

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

    const totalDumps = dumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const totalFailedBackups = backupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const totalCancelledJobs = jobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);
    const prevTotalDumps = prevDumpsData.reduce((sum, row) => sum + parseInt(row.total_dumps || 0), 0);
    const prevTotalBackups = prevBackupsData.reduce((sum, row) => sum + parseInt(row.failed_backups || 0), 0);
    const prevTotalJobs = prevJobsData.reduce((sum, row) => sum + parseInt(row.cancelled_jobs || 0), 0);

    const dumpsTrend = prevTotalDumps > 0 ? ((totalDumps - prevTotalDumps) / prevTotalDumps * 100).toFixed(1) : 0;
    const backupsTrend = prevTotalBackups > 0 ? ((totalFailedBackups - prevTotalBackups) / prevTotalBackups * 100).toFixed(1) : 0;
    const jobsTrend = prevTotalJobs > 0 ? ((totalCancelledJobs - prevTotalJobs) / prevTotalJobs * 100).toFixed(1) : 0;

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

// Debug
app.get('/api/agenda/debug', (req, res) => {
  console.log('🔍 GET /api/agenda/debug');
  const { userRole, userClientName } = getUserClaims(req);
  res.json({
    message: 'Agenda API è disponibile',
    user: { role: userRole, client: userClientName },
    dynamoConfig: {
      region: require('./config').AWS_REGION,
      tableName: 'AgendaTasks'
    },
    endpoints: [
      { method: 'GET', path: '/api/agenda/tasks', params: ['yearMonth', 'nomeCliente'] },
      { method: 'POST', path: '/api/agenda/tasks', body: 'task object' },
      { method: 'PUT', path: '/api/agenda/tasks/:id', body: 'updated task object' },
      { method: 'DELETE', path: '/api/agenda/tasks/:id' }
    ]
  });
});

// GET tasks
app.get('/api/agenda/tasks', async (req, res) => {
  console.log('📅 GET /api/agenda/tasks - Query:', req.query);
  try {
    const { userRole, userClientName } = getUserClaims(req);
    const { yearMonth, nomeCliente } = req.query;

    if (!yearMonth) {
      return res.status(400).json({ error: 'Parametro yearMonth è richiesto (formato YYYY-MM).' });
    }

    let tasks;
    if (userRole === 'admin') {
      if (nomeCliente) {
        console.log(`👑 Admin → cliente ${nomeCliente}`);
        tasks = await dynamodbService.getTasksByClientAndMonth(nomeCliente, yearMonth);
      } else {
        console.log(`👑 Admin → tutte le attività`);
        tasks = await dynamodbService.getTasksByMonth(yearMonth);
      }
    } else if (userRole === 'cliente' && userClientName) {
      console.log(`👤 Cliente ${userClientName}`);
      tasks = await dynamodbService.getTasksByClientAndMonth(userClientName, yearMonth);
    } else {
      return res.status(403).json({ error: 'Accesso negato.' });
    }

    console.log(`✅ ${tasks.length} attività trovate`);
    res.json(tasks);
  } catch (error) {
    console.error('❌ Errore recupero attività:', error);
    res.status(500).json({ error: 'Errore durante il recupero delle attività.', details: error.message });
  }
});

// POST new task
app.post('/api/agenda/tasks', async (req, res) => {
  console.log('📝 POST /api/agenda/tasks');
  try {
    const { userRole, userClientName } = getUserClaims(req);
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono creare attività.' });
    }

    const task = req.body;
    task.id = uuidv4();
    task.createdBy = userClientName || 'admin';
    task.lastModifiedBy = userClientName || 'admin';
    task.createdAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    const newTask = await dynamodbService.createTask(task);
    console.log(`✅ Attività creata: ${newTask.id}`);
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('❌ Errore creazione attività:', error);
    res.status(500).json({ error: 'Errore durante la creazione dell\'attività.', details: error.message });
  }
});

// PUT update task
app.put('/api/agenda/tasks/:id', async (req, res) => {
  console.log(`✏️  PUT /api/agenda/tasks/${req.params.id}`);
  try {
    const { userRole, userClientName } = getUserClaims(req);
    const { id } = req.params;
    const updates = req.body;

    const existingTask = await dynamodbService.getTaskById(id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Attività non trovata.' });
    }

    if (userRole === 'admin') {
      updates.lastModifiedBy = userClientName || 'admin';
    } else if (userRole === 'cliente' && userClientName) {
      if (existingTask.nomeCliente !== userClientName) {
        return res.status(403).json({ error: 'Non puoi modificare attività di altri clienti.' });
      }
      if (!existingTask.canClientEdit) {
        return res.status(403).json({ error: 'Questa attività non può essere modificata dal cliente.' });
      }
      updates.lastModifiedBy = userClientName;
    } else {
      return res.status(403).json({ error: 'Accesso negato.' });
    }

    updates.updatedAt = new Date().toISOString();
    const updatedTask = await dynamodbService.updateTask(id, updates);
    console.log(`✅ Attività aggiornata: ${id}`);
    
    res.json(updatedTask);
  } catch (error) {
    console.error('❌ Errore aggiornamento attività:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'attività.', details: error.message });
  }
});

// DELETE task
app.delete('/api/agenda/tasks/:id', async (req, res) => {
  console.log(`🗑️  DELETE /api/agenda/tasks/${req.params.id}`);
  try {
    const { userRole } = getUserClaims(req);
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Solo gli amministratori possono eliminare attività.' });
    }

    const { id } = req.params;
    await dynamodbService.deleteTask(id);
    console.log(`✅ Attività eliminata: ${id}`);
    
    res.json({ message: 'Attività eliminata con successo.' });
  } catch (error) {
    console.error('❌ Errore eliminazione attività:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'attività.', details: error.message });
  }
});

// Mock endpoint
app.get('/api/agenda/mock', (req, res) => {
  console.log('🧪 GET /api/agenda/mock');
  const { yearMonth } = req.query;
  
  if (!yearMonth) {
    return res.status(400).json({ error: 'Parametro yearMonth è richiesto.' });
  }
  
  const mockData = [
    {
      id: "mock-1",
      nomeCliente: "fope",
      sid: "PRD",
      data: `${yearMonth}-20`,
      oraInizio: "10:00",
      orarioFine: "12:30",
      emailCliente: "cliente@fope.it",
      descrizione: "Manutenzione ordinaria",
      createdBy: "admin",
      lastModifiedBy: "admin",
      canClientEdit: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  res.json(mockData);
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint non trovato', path: req.originalUrl });
});

// ============================================
// EXPORTS
// ============================================
module.exports.app = app;
module.exports.handler = serverless(app);