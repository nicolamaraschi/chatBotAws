// ====================================================================
// QUERY STATISTICHE AVANZATE - Per dashboard SAP
// ====================================================================

const buildBaseWhere = require('./sap-queries').buildBaseWhere || ((filters) => {
  const conditions = [];
  
  if (filters.startDate && filters.endDate) {
    conditions.push(`datacontrollo BETWEEN '${filters.startDate}' AND '${filters.endDate}'`);
  }
  
  if (filters.clients && filters.clients.length > 0) {
    const clientList = filters.clients.map(c => `'${c}'`).join(',');
    conditions.push(`nomecliente IN (${clientList})`);
  }
  
  if (filters.sids && filters.sids.length > 0) {
    const sidList = filters.sids.map(s => `'${s}'`).join(',');
    conditions.push(`sid IN (${sidList})`);
  }
  
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
});

// Analisi per ora del giorno
const getHourlyDumpsQuery = (filters) => {
  const whereClause = buildBaseWhere(filters);
  return `
    SELECT 
      CAST(EXTRACT(HOUR FROM TRY(parse_datetime(dump.START_TIME, 'yyyy/MM/dd HH:mm:ss'))) AS INTEGER) AS hour_of_day,
      COUNT(*) AS dump_count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS percentage_of_total
    FROM "sap_reports_db"."reportparquet"
    CROSS JOIN UNNEST(abap_short_dumps) AS t(dump)
    ${whereClause ? whereClause + " AND" : "WHERE"} 
      dump.START_TIME IS NOT NULL 
      AND TRY(parse_datetime(dump.START_TIME, 'yyyy/MM/dd HH:mm:ss')) IS NOT NULL
    GROUP BY EXTRACT(HOUR FROM TRY(parse_datetime(dump.START_TIME, 'yyyy/MM/dd HH:mm:ss')))
    ORDER BY hour_of_day
  `;
};

// Health Score del sistema
const getSystemHealthScoreQuery = (filters) => {
  // The new query doesn't use the `filters` parameter in the same way,
  // as it has its own time-based WHERE clause.
  // The buildBaseWhere is not used here.
  return `
WITH
-- ====== STEP 1: Calcolo metriche base per sistema ======
raw_metrics AS (
  SELECT 
    nomecliente,
    sid,
    datacontrollo,
    
    -- Conta problemi per giorno
    cardinality(abap_short_dumps) AS daily_dumps,
    cardinality(filter(situazione_backup, b -> b.STATUS LIKE '%failed%')) AS daily_failed_backups,
    cardinality(filter(abap_batch_jobs, j -> j.STATUS = 'CANCELLED')) AS daily_cancelled_jobs,
    
    -- Servizi KO (binario: 1 se KO, 0 se OK)
    CASE WHEN stato_servizi.dump = 'ko' THEN 1 ELSE 0 END AS dump_service_ko,
    CASE WHEN stato_servizi.job_in_errore = 'ko' THEN 1 ELSE 0 END AS job_service_ko,
    CASE WHEN stato_servizi.spazio_database = 'ko' THEN 1 ELSE 0 END AS db_service_ko,
    CASE WHEN stato_servizi.spazio_log = 'ko' THEN 1 ELSE 0 END AS log_service_ko
  FROM "sap_reports_db"."reportparquet"
  WHERE datacontrollo >= date_format(date_add('day', -30, current_date), '%Y-%m-%d')
),

-- ====== STEP 2: Aggregazione temporale con medie mobili ======
time_aggregated AS (
  SELECT 
    nomecliente,
    sid,
    
    -- Metriche aggregate su 30 giorni
    COUNT(DISTINCT datacontrollo) AS days_observed,
    SUM(daily_dumps) AS total_dumps,
    SUM(daily_failed_backups) AS total_failed_backups,
    SUM(daily_cancelled_jobs) AS total_cancelled_jobs,
    SUM(dump_service_ko) AS days_dump_ko,
    SUM(job_service_ko) AS days_job_ko,
    SUM(db_service_ko) AS days_db_ko,
    SUM(log_service_ko) AS days_log_ko,
    
    -- Medie giornaliere
    CAST(SUM(daily_dumps) AS DOUBLE) / NULLIF(COUNT(DISTINCT datacontrollo), 0) AS avg_dumps_per_day,
    CAST(SUM(daily_failed_backups) AS DOUBLE) / NULLIF(COUNT(DISTINCT datacontrollo), 0) AS avg_backups_per_day,
    CAST(SUM(daily_cancelled_jobs) AS DOUBLE) / NULLIF(COUNT(DISTINCT datacontrollo), 0) AS avg_jobs_per_day,
    
    -- Deviazione standard (stabilità)
    STDDEV(daily_dumps) AS stddev_dumps,
    STDDEV(daily_failed_backups) AS stddev_backups,
    STDDEV(daily_cancelled_jobs) AS stddev_jobs,
    
    -- Variabilità percentuale (CV = std/mean)
    CASE 
      WHEN AVG(daily_dumps) > 0 THEN STDDEV(daily_dumps) / AVG(daily_dumps)
      ELSE 0 
    END AS cv_dumps,
    
    -- Trend (regressione lineare semplificata: confronto prima e seconda metà periodo)
    AVG(CASE 
      WHEN datacontrollo < date_format(date_add('day', -15, current_date), '%Y-%m-%d') 
      THEN daily_dumps 
    END) AS avg_dumps_first_half,
    AVG(CASE 
      WHEN datacontrollo >= date_format(date_add('day', -15, current_date), '%Y-%m-%d') 
      THEN daily_dumps 
    END) AS avg_dumps_second_half
    
  FROM raw_metrics
  GROUP BY nomecliente, sid
),

-- ====== STEP 3: Statistiche globali per normalizzazione Z-score ======
global_stats AS (
  SELECT 
    -- Medie globali
    AVG(avg_dumps_per_day) AS global_mean_dumps,
    AVG(avg_backups_per_day) AS global_mean_backups,
    AVG(avg_jobs_per_day) AS global_mean_jobs,
    
    -- Deviazioni standard globali
    STDDEV(avg_dumps_per_day) AS global_stddev_dumps,
    STDDEV(avg_backups_per_day) AS global_stddev_backups,
    STDDEV(avg_jobs_per_day) AS global_stddev_jobs,
    
    -- Percentili per classificazione
    APPROX_PERCENTILE(avg_dumps_per_day, 0.75) AS p75_dumps,
    APPROX_PERCENTILE(avg_dumps_per_day, 0.90) AS p90_dumps,
    APPROX_PERCENTILE(avg_backups_per_day, 0.75) AS p75_backups,
    APPROX_PERCENTILE(avg_backups_per_day, 0.90) AS p90_backups,
    APPROX_PERCENTILE(avg_jobs_per_day, 0.75) AS p75_jobs,
    APPROX_PERCENTILE(avg_jobs_per_day, 0.90) AS p90_jobs
  FROM time_aggregated
),

-- ====== STEP 4: Calcolo Z-scores normalizzati ======
normalized_metrics AS (
  SELECT 
    t.*,
    g.*,
    
    -- Z-score per dumps (quante deviazioni standard dalla media)
    CASE 
      WHEN g.global_stddev_dumps > 0 
      THEN (t.avg_dumps_per_day - g.global_mean_dumps) / g.global_stddev_dumps
      ELSE 0 
    END AS z_score_dumps,
    
    -- Z-score per backups
    CASE 
      WHEN g.global_stddev_backups > 0 
      THEN (t.avg_backups_per_day - g.global_mean_backups) / g.global_stddev_backups
      ELSE 0 
    END AS z_score_backups,
    
    -- Z-score per jobs
    CASE 
      WHEN g.global_stddev_jobs > 0 
      THEN (t.avg_jobs_per_day - g.global_mean_jobs) / g.global_stddev_jobs
      ELSE 0 
    END AS z_score_jobs,
    
    -- Componente trend (% cambio)
    CASE 
      WHEN t.avg_dumps_first_half > 0 
      THEN ((t.avg_dumps_second_half - t.avg_dumps_first_half) / t.avg_dumps_first_half) * 100
      ELSE 0 
    END AS trend_dumps_pct
    
  FROM time_aggregated t
  CROSS JOIN global_stats g
),

-- ====== STEP 5: Calcolo componenti del Health Score ======
score_components AS (
  SELECT 
    nomecliente,
    sid,
    days_observed,
    
    -- Dati grezzi per debug
    total_dumps,
    total_failed_backups,
    total_cancelled_jobs,
    avg_dumps_per_day,
    avg_backups_per_day,
    avg_jobs_per_day,
    
    -- Z-scores
    z_score_dumps,
    z_score_backups,
    z_score_jobs,
    
    -- COMPONENTE 1: Frequenza problemi (normalizzata con z-score)
    -- Usa funzione sigmoidale per mappare z-score in range 0-30
    -- Peso: dumps=35%, backups=45%, jobs=20%
    30 * (1 - (1 / (1 + EXP(-1 * (
      0.35 * GREATEST(-3, LEAST(3, z_score_dumps)) +
      0.45 * GREATEST(-3, LEAST(3, z_score_backups)) +
      0.20 * GREATEST(-3, LEAST(3, z_score_jobs))
    ))))) AS frequency_score,
    
    -- COMPONENTE 2: Stabilità (basata su deviazione standard)
    -- Sistema instabile = punteggio più basso
    25 * (1 - LEAST(1, (
      COALESCE(cv_dumps, 0) * 0.4 +
      (CASE WHEN stddev_backups > avg_backups_per_day THEN 1 ELSE 0 END) * 0.6
    ))) AS stability_score,
    
    -- COMPONENTE 3: Salute servizi (proporzione giorni OK)
    25 * (
      (CAST(days_observed - days_dump_ko AS DOUBLE) / days_observed) * 0.25 +
      (CAST(days_observed - days_job_ko AS DOUBLE) / days_observed) * 0.25 +
      (CAST(days_observed - days_db_ko AS DOUBLE) / days_observed) * 0.25 +
      (CAST(days_observed - days_log_ko AS DOUBLE) / days_observed) * 0.25
    ) AS service_health_score,
    
    -- COMPONENTE 4: Trend (penalità se peggiorativo)
    20 * CASE
      WHEN trend_dumps_pct <= 0 THEN 1.0  -- Miglioramento o stabile
      WHEN trend_dumps_pct <= 10 THEN 0.9  -- Leggero peggioramento
      WHEN trend_dumps_pct <= 25 THEN 0.7  -- Peggioramento moderato
      WHEN trend_dumps_pct <= 50 THEN 0.5  -- Peggioramento significativo
      ELSE 0.3  -- Peggioramento critico
    END AS trend_score,
    
    trend_dumps_pct,
    stddev_dumps,
    cv_dumps
    
  FROM normalized_metrics
),

-- ====== STEP 6: Calcolo finale Health Score ======
final_scores AS (
  SELECT 
    nomecliente,
    sid,
    days_observed,
    
    -- Componenti individuali
    ROUND(frequency_score, 2) AS frequency_score,
    ROUND(stability_score, 2) AS stability_score,
    ROUND(service_health_score, 2) AS service_health_score,
    ROUND(trend_score, 2) AS trend_score,
    
    -- HEALTH SCORE FINALE (somma pesata)
    ROUND(
      frequency_score +
      stability_score +
      service_health_score +
      trend_score
    , 2) AS health_score,
    
    -- Metriche grezze per interpretazione
    ROUND(avg_dumps_per_day, 2) AS avg_dumps_per_day,
    ROUND(avg_backups_per_day, 2) AS avg_backups_per_day,
    ROUND(avg_jobs_per_day, 2) AS avg_jobs_per_day,
    total_dumps,
    total_failed_backups,
    total_cancelled_jobs,
    
    -- Z-scores per interpretazione
    ROUND(z_score_dumps, 2) AS z_score_dumps,
    ROUND(z_score_backups, 2) AS z_score_backups,
    ROUND(z_score_jobs, 2) AS z_score_jobs,
    
    -- Trend
    ROUND(trend_dumps_pct, 1) AS trend_pct,
    
    -- Stabilità
    ROUND(COALESCE(cv_dumps, 0), 2) AS coefficient_variation
    
  FROM score_components
)

-- ====== OUTPUT FINALE ======
SELECT 
  nomecliente,
  sid,
  health_score,
  
  -- Classificazione basata su score
  CASE 
    WHEN health_score >= 90 THEN ' Eccellente'
    WHEN health_score >= 75 THEN ' Buono'
    WHEN health_score >= 60 THEN ' Medio'
    WHEN health_score >= 40 THEN ' Scarso'
    ELSE '⚫ Critico'
  END AS health_status,
  
  -- Livello di confidenza (basato su giorni osservati)
  CASE 
    WHEN days_observed >= 25 THEN '✓ Alta confidenza'
    WHEN days_observed >= 15 THEN '~ Media confidenza'
    ELSE '⚠ Bassa confidenza'
  END AS confidence_level,
  
  -- Componenti dettagliate
  frequency_score AS score_frequenza,
  stability_score AS score_stabilita,
  service_health_score AS score_servizi,
  trend_score AS score_trend,
  
  -- Metriche interpretabili
  avg_dumps_per_day,
  avg_backups_per_day,
  avg_jobs_per_day,
  total_dumps,
  total_failed_backups,
  total_cancelled_jobs,
  
  -- Indicatori statistici
  z_score_dumps AS z_dumps,
  z_score_backups AS z_backups,
  z_score_jobs AS z_jobs,
  trend_pct,
  coefficient_variation AS variabilita,
  
  days_observed AS giorni_osservati

FROM final_scores
ORDER BY health_score ASC, nomecliente, sid
LIMIT 100;
  `;
};

// Correlazione tra tipi di errore
const getErrorCorrelationQuery = (filters) => {
  const whereClause = buildBaseWhere(filters);
  return `
    WITH daily_counts AS (
        SELECT
            nomecliente,
            sid,
            datacontrollo,
            -- Conta dump
            cardinality(abap_short_dumps) AS dump_count,
            -- Conta backup falliti
            cardinality(filter(situazione_backup, b -> b.STATUS LIKE '%failed%')) AS failed_backup_count,
            -- Conta job cancellati
            cardinality(filter(abap_batch_jobs, j -> j.STATUS = 'CANCELLED')) AS cancelled_job_count,
            -- Stati servizi
            CASE WHEN stato_servizi.dump = 'ko' THEN 1 ELSE 0 END AS service_dump_ko,
            CASE WHEN stato_servizi.job_in_errore = 'ko' THEN 1 ELSE 0 END AS service_job_ko,
            CASE WHEN stato_servizi.processi_attivi = 'ko' THEN 1 ELSE 0 END AS service_process_ko,
            CASE WHEN stato_servizi.spazio_database = 'ko' THEN 1 ELSE 0 END AS service_db_space_ko,
            CASE WHEN stato_servizi.spazio_log = 'ko' THEN 1 ELSE 0 END AS service_log_space_ko
        FROM "sap_reports_db"."reportparquet"
        ${whereClause}
    )

    SELECT
        'Dump Count vs Failed Backups' AS correlation_pair,
        ROUND(CORR(dump_count, failed_backup_count), 3) AS correlation_coefficient,
        COUNT(*) AS sample_size,
        CASE 
            WHEN CORR(dump_count, failed_backup_count) > 0.7 THEN 'Fortemente Positiva'
            WHEN CORR(dump_count, failed_backup_count) > 0.3 THEN 'Moderatamente Positiva'
            WHEN CORR(dump_count, failed_backup_count) > 0.1 THEN 'Debolmente Positiva'
            WHEN CORR(dump_count, failed_backup_count) > -0.1 THEN 'Nessuna Correlazione'
            WHEN CORR(dump_count, failed_backup_count) > -0.3 THEN 'Debolmente Negativa'
            WHEN CORR(dump_count, failed_backup_count) > -0.7 THEN 'Moderatamente Negativa'
            ELSE 'Fortemente Negativa'
        END AS correlation_strength
    FROM daily_counts
    WHERE dump_count > 0 OR failed_backup_count > 0

    UNION ALL

    SELECT
        'Dump Count vs Cancelled Jobs' AS correlation_pair,
        ROUND(CORR(dump_count, cancelled_job_count), 3) AS correlation_coefficient,
        COUNT(*) AS sample_size,
        CASE 
            WHEN CORR(dump_count, cancelled_job_count) > 0.7 THEN 'Fortemente Positiva'
            WHEN CORR(dump_count, cancelled_job_count) > 0.3 THEN 'Moderatamente Positiva'
            WHEN CORR(dump_count, cancelled_job_count) > 0.1 THEN 'Debolmente Positiva'
            WHEN CORR(dump_count, cancelled_job_count) > -0.1 THEN 'Nessuna Correlazione'
            WHEN CORR(dump_count, cancelled_job_count) > -0.3 THEN 'Debolmente Negativa'
            WHEN CORR(dump_count, cancelled_job_count) > -0.7 THEN 'Moderatamente Negativa'
            ELSE 'Fortemente Negativa'
        END AS correlation_strength
    FROM daily_counts
    WHERE dump_count > 0 OR cancelled_job_count > 0

    UNION ALL

    SELECT
        'Failed Backups vs Cancelled Jobs' AS correlation_pair,
        ROUND(CORR(failed_backup_count, cancelled_job_count), 3) AS correlation_coefficient,
        COUNT(*) AS sample_size,
        CASE 
            WHEN CORR(failed_backup_count, cancelled_job_count) > 0.7 THEN 'Fortemente Positiva'
            WHEN CORR(failed_backup_count, cancelled_job_count) > 0.3 THEN 'Moderatamente Positiva'
            WHEN CORR(failed_backup_count, cancelled_job_count) > 0.1 THEN 'Debolmente Positiva'
            WHEN CORR(failed_backup_count, cancelled_job_count) > -0.1 THEN 'Nessuna Correlazione'
            WHEN CORR(failed_backup_count, cancelled_job_count) > -0.3 THEN 'Debolmente Negativa'
            WHEN CORR(failed_backup_count, cancelled_job_count) > -0.7 THEN 'Moderatamente Negativa'
            ELSE 'Fortemente Negativa'
        END AS correlation_strength
    FROM daily_counts
    WHERE failed_backup_count > 0 OR cancelled_job_count > 0

    ORDER BY ABS(correlation_coefficient) DESC
  `;
};

// Aggiungi questa funzione per l'analisi per giorno della settimana
const getDayOfWeekAnalysisQuery = (filters) => {
  const whereClause = buildBaseWhere(filters);
  return `
    WITH dump_by_day AS (
        SELECT 
            CASE 
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 0 THEN 'Domenica'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 1 THEN 'Lunedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 2 THEN 'Martedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 3 THEN 'Mercoledì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 4 THEN 'Giovedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 5 THEN 'Venerdì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 6 THEN 'Sabato'
            END AS day_of_week,
            COUNT(*) AS day_count,
            SUM(cardinality(abap_short_dumps)) AS dump_count
        FROM "sap_reports_db"."reportparquet"
        ${whereClause}
        GROUP BY EXTRACT(DOW FROM CAST(datacontrollo AS DATE))
    ),
    backup_by_day AS (
        SELECT 
            CASE 
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 0 THEN 'Domenica'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 1 THEN 'Lunedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 2 THEN 'Martedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 3 THEN 'Mercoledì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 4 THEN 'Giovedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 5 THEN 'Venerdì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 6 THEN 'Sabato'
            END AS day_of_week,
            SUM(cardinality(filter(situazione_backup, b -> b.STATUS LIKE '%failed%'))) AS failed_backup_count
        FROM "sap_reports_db"."reportparquet"
        ${whereClause}
        GROUP BY EXTRACT(DOW FROM CAST(datacontrollo AS DATE))
    ),
    job_by_day AS (
        SELECT 
            CASE 
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 0 THEN 'Domenica'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 1 THEN 'Lunedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 2 THEN 'Martedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 3 THEN 'Mercoledì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 4 THEN 'Giovedì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 5 THEN 'Venerdì'
                WHEN EXTRACT(DOW FROM CAST(datacontrollo AS DATE)) = 6 THEN 'Sabato'
            END AS day_of_week,
            SUM(cardinality(filter(abap_batch_jobs, j -> j.STATUS = 'CANCELLED'))) AS cancelled_job_count
        FROM "sap_reports_db"."reportparquet"
        ${whereClause}
        GROUP BY EXTRACT(DOW FROM CAST(datacontrollo AS DATE))
    )
    
    SELECT 
        COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) AS day_of_week,
        COALESCE(d.day_count, 0) AS day_count,
        COALESCE(d.dump_count, 0) AS dump_count,
        COALESCE(b.failed_backup_count, 0) AS failed_backup_count,
        COALESCE(j.cancelled_job_count, 0) AS cancelled_job_count,
        COALESCE(d.dump_count, 0) + COALESCE(b.failed_backup_count, 0) + COALESCE(j.cancelled_job_count, 0) AS total_issues
    FROM 
        dump_by_day d
    FULL OUTER JOIN 
        backup_by_day b ON d.day_of_week = b.day_of_week
    FULL OUTER JOIN 
        job_by_day j ON COALESCE(d.day_of_week, b.day_of_week) = j.day_of_week
    ORDER BY 
        CASE 
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Lunedì' THEN 1
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Martedì' THEN 2
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Mercoledì' THEN 3
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Giovedì' THEN 4
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Venerdì' THEN 5
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Sabato' THEN 6
            WHEN COALESCE(d.day_of_week, b.day_of_week, j.day_of_week) = 'Domenica' THEN 7
        END
  `;
};

// Aggiornare l'export module per includere la nuova funzione
module.exports = {
  getHourlyDumpsQuery,
  getSystemHealthScoreQuery,
  getErrorCorrelationQuery,
  getDayOfWeekAnalysisQuery
};
