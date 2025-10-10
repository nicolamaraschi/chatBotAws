// ====================================================================
// SAP QUERIES - Query per Dashboard SAP (VERSIONE CORRETTA - CAMPI MAIUSCOLI)
// ====================================================================

const sanitize = (value) => {
  if (typeof value === 'string') return value.replace(/'/g, "''");
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
};

// Costruisce la clausola WHERE base per i filtri comuni
const buildBaseWhere = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

// Query 1: Total Dumps
const getTotalDumpsQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
      nomecliente,
      datacontrollo,
      COUNT(*) as total_dumps
    FROM "sap_reports_db"."reportparquet"
    CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
    ${whereClause}
    GROUP BY nomecliente, datacontrollo
  `;
};

// Query 2: Failed Backups (CAMPI MAIUSCOLI: STATUS)
const getFailedBackupsQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  conditions.push(`(backup.STATUS LIKE '%failed%' OR backup.STATUS LIKE '%FAILED%')`);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
      nomecliente,
      COUNT(*) as failed_backups,
      datacontrollo
    FROM "sap_reports_db"."reportparquet"
    CROSS JOIN UNNEST(situazione_backup) AS t(backup)
    ${whereClause}
    GROUP BY nomecliente, datacontrollo
  `;
};

// Query 3: Cancelled Jobs (CAMPI MAIUSCOLI: STATUS)
const getCancelledJobsQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  conditions.push(`job.STATUS = 'CANCELLED'`);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
      nomecliente,
      COUNT(*) as cancelled_jobs,
      datacontrollo
    FROM "sap_reports_db"."reportparquet"
    CROSS JOIN UNNEST(abap_batch_jobs) AS t(job)
    ${whereClause}
    GROUP BY nomecliente, datacontrollo
  `;
};

// Query 4: Servizi in KO (CAMPI MAIUSCOLI nello struct stato_servizi)
const getServicesKOQuery = (filters) => {
  const whereClause = buildBaseWhere(filters);
  
  return `
    SELECT 
      nomecliente,
      datacontrollo,
      stato_servizi.Dump as dump_status,
      stato_servizi.job_in_errore as job_error_status,
      stato_servizi.processi_attivi as active_processes_status,
      stato_servizi.spazio_database as db_space_status,
      stato_servizi.spazio_log as log_space_status
    FROM "sap_reports_db"."reportparquet"
    ${whereClause}
  `;
};

// Query 5: Dump Types Distribution (CAMPI MAIUSCOLI: SHORT_DUMP_TYPE)
const getDumpTypesQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
      dump.SHORT_DUMP_TYPE as dump_type,
      COUNT(*) as count,
      nomecliente
    FROM "sap_reports_db"."reportparquet"
    CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
    ${whereClause}
    GROUP BY dump.SHORT_DUMP_TYPE, nomecliente
    ORDER BY count DESC
  `;
};

// Query 6: Issues by Client & SID
const getIssuesByClientQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const backupConditions = [...conditions, `(backup.STATUS LIKE '%failed%' OR backup.STATUS LIKE '%FAILED%')`];
  const backupWhereClause = backupConditions.length > 0 ? `WHERE ${backupConditions.join(' AND ')}` : '';
  const jobConditions = [...conditions, `job.STATUS = 'CANCELLED'`];
  const jobWhereClause = jobConditions.length > 0 ? `WHERE ${jobConditions.join(' AND ')}` : '';
  
  return `
    WITH dumps AS (
      SELECT nomecliente, sid, COUNT(*) as dump_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
      ${whereClause}
      GROUP BY nomecliente, sid
    ),
    failed_backups AS (
      SELECT nomecliente, sid, COUNT(*) as backup_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(situazione_backup) AS t(backup)
      ${backupWhereClause}
      GROUP BY nomecliente, sid
    ),
    cancelled_jobs AS (
      SELECT nomecliente, sid, COUNT(*) as job_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(abap_batch_jobs) AS t(job)
      ${jobWhereClause}
      GROUP BY nomecliente, sid
    )
    SELECT 
      COALESCE(d.nomecliente, fb.nomecliente, cj.nomecliente) as nomecliente,
      COALESCE(d.sid, fb.sid, cj.sid) as sid,
      COALESCE(d.dump_count, 0) as dumps,
      COALESCE(fb.backup_count, 0) as failed_backups,
      COALESCE(cj.job_count, 0) as cancelled_jobs
    FROM dumps d
    FULL OUTER JOIN failed_backups fb ON d.nomecliente = fb.nomecliente AND d.sid = fb.sid
    FULL OUTER JOIN cancelled_jobs cj ON COALESCE(d.nomecliente, fb.nomecliente) = cj.nomecliente AND COALESCE(d.sid, fb.sid) = cj.sid
    ORDER BY nomecliente, sid
  `;
};

// Query 7: Lista clienti disponibili
const getAvailableClientsQuery = () => {
  return `
    SELECT DISTINCT nomecliente
    FROM "sap_reports_db"."reportparquet"
    ORDER BY nomecliente
  `;
};

// Query 8: Lista SID disponibili
const getAvailableSIDsQuery = (clients) => {
  let query = `
    SELECT DISTINCT sid, nomecliente
    FROM "sap_reports_db"."reportparquet"
  `;
  
  if (clients && clients.length > 0) {
    const clientList = clients.map(c => `'${sanitize(c)}'`).join(',');
    query += ` WHERE nomecliente IN (${clientList})`;
  }
  
  query += ` ORDER BY sid`;
  return query;
};

// Query 9: Andamento servizi nel tempo
const getServicesTimelineQuery = (filters) => {
  const whereClause = buildBaseWhere(filters);
  
  return `
    SELECT 
      datacontrollo,
      nomecliente,
      SUM(CASE WHEN stato_servizi.Dump = 'ko' THEN 1 ELSE 0 END) as dump_ko,
      SUM(CASE WHEN stato_servizi.job_in_errore = 'ko' THEN 1 ELSE 0 END) as job_ko,
      SUM(CASE WHEN stato_servizi.processi_attivi = 'ko' THEN 1 ELSE 0 END) as processi_ko,
      SUM(CASE WHEN stato_servizi.spazio_database = 'ko' THEN 1 ELSE 0 END) as db_ko,
      SUM(CASE WHEN stato_servizi.spazio_log = 'ko' THEN 1 ELSE 0 END) as log_ko,
      SUM(CASE WHEN stato_servizi.scadenza_certificati = 'ko' THEN 1 ELSE 0 END) as cert_ko,
      SUM(CASE WHEN stato_servizi.update_in_errore = 'ko' THEN 1 ELSE 0 END) as update_ko,
      SUM(CASE WHEN stato_servizi.Spool = 'ko' THEN 1 ELSE 0 END) as spool_ko
    FROM "sap_reports_db"."reportparquet"
    ${whereClause}
    GROUP BY datacontrollo, nomecliente
    ORDER BY datacontrollo ASC
  `;
};

// Query 10: Andamento problemi nel tempo
const getProblemsTimelineQuery = (filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(filters.startDate)}' AND '${sanitize(filters.endDate)}'`);
  }
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (filters.sids && filters.sids.length === 0 && filters.clients && filters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const backupConditions = [...conditions, `(backup.STATUS LIKE '%failed%' OR backup.STATUS LIKE '%FAILED%')`];
  const backupWhereClause = backupConditions.length > 0 ? `WHERE ${backupConditions.join(' AND ')}` : '';
  const jobConditions = [...conditions, `job.STATUS = 'CANCELLED'`];
  const jobWhereClause = jobConditions.length > 0 ? `WHERE ${jobConditions.join(' AND ')}` : '';
  
  return `
    WITH daily_dumps AS (
      SELECT 
        datacontrollo,
        COUNT(*) as dump_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
      ${whereClause}
      GROUP BY datacontrollo
    ),
    daily_backups AS (
      SELECT 
        datacontrollo,
        COUNT(*) as backup_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(situazione_backup) AS t(backup)
      ${backupWhereClause}
      GROUP BY datacontrollo
    ),
    daily_jobs AS (
      SELECT 
        datacontrollo,
        COUNT(*) as job_count
      FROM "sap_reports_db"."reportparquet"
      CROSS JOIN UNNEST(abap_batch_jobs) AS t(job)
      ${jobWhereClause}
      GROUP BY datacontrollo
    )
    SELECT 
      COALESCE(dd.datacontrollo, db.datacontrollo, dj.datacontrollo) as datacontrollo,
      COALESCE(dd.dump_count, 0) as dumps,
      COALESCE(db.backup_count, 0) as failed_backups,
      COALESCE(dj.job_count, 0) as cancelled_jobs
    FROM daily_dumps dd
    FULL OUTER JOIN daily_backups db ON dd.datacontrollo = db.datacontrollo
    FULL OUTER JOIN daily_jobs dj ON COALESCE(dd.datacontrollo, db.datacontrollo) = dj.datacontrollo
    ORDER BY datacontrollo ASC
  `;
};

// Query per trend (periodo precedente)
const getPreviousPeriodData = (filters, type) => {
  const start = new Date(filters.startDate);
  const end = new Date(filters.endDate);
  const diff = end - start;
  
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  
  const prevFilters = {
    ...filters,
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0]
  };
  
  const conditions = [];
  
  if (prevFilters.startDate && prevFilters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${sanitize(prevFilters.startDate)}' AND '${sanitize(prevFilters.endDate)}'`);
  }
  if (prevFilters.clients && prevFilters.clients.length > 0) {
    const clientList = prevFilters.clients.map(c => `'${sanitize(c)}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  if (prevFilters.sids && prevFilters.sids.length > 0) {
    const sidList = prevFilters.sids.map(s => `'${sanitize(s)}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  } else if (prevFilters.sids && prevFilters.sids.length === 0 && prevFilters.clients && prevFilters.clients.length > 0) {
    conditions.push(`sid = 'NESSUN_SID_SELEZIONATO'`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  switch(type) {
    case 'dumps':
      return `
        SELECT 
          nomecliente,
          datacontrollo,
          COUNT(*) as total_dumps
        FROM "sap_reports_db"."reportparquet"
        CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
        ${whereClause}
        GROUP BY nomecliente, datacontrollo
      `;
    case 'backups':
      const backupConditions = [...conditions, `(backup.STATUS LIKE '%failed%' OR backup.STATUS LIKE '%FAILED%')`];
      const backupWhereClause = backupConditions.length > 0 ? `WHERE ${backupConditions.join(' AND ')}` : '';
      return `
        SELECT 
          nomecliente,
          datacontrollo,
          COUNT(*) as failed_backups
        FROM "sap_reports_db"."reportparquet"
        CROSS JOIN UNNEST(situazione_backup) AS t(backup)
        ${backupWhereClause}
        GROUP BY nomecliente, datacontrollo
      `;
    case 'jobs':
      const jobConditions = [...conditions, `job.STATUS = 'CANCELLED'`];
      const jobWhereClause = jobConditions.length > 0 ? `WHERE ${jobConditions.join(' AND ')}` : '';
      return `
        SELECT 
          nomecliente,
          datacontrollo,
          COUNT(*) as cancelled_jobs
        FROM "sap_reports_db"."reportparquet"
        CROSS JOIN UNNEST(abap_batch_jobs) AS t(job)
        ${jobWhereClause}
        GROUP BY nomecliente, datacontrollo
      `;
    default:
      return null;
  }
};

module.exports = {
  getTotalDumpsQuery,
  getFailedBackupsQuery,
  getCancelledJobsQuery,
  getServicesKOQuery,
  getDumpTypesQuery,
  getIssuesByClientQuery,
  getAvailableClientsQuery,
  getAvailableSIDsQuery,
  getPreviousPeriodData,
  getServicesTimelineQuery,
  getProblemsTimelineQuery
};