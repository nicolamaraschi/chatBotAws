const AWS = require('aws-sdk');
const config = require('../config');

// Configure the AWS region
AWS.config.update({ region: config.AWS_REGION });

const athena = new AWS.Athena();

// Funzione di utility per attendere un certo tempo
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Esegue una query su Athena e attende il completamento.
 * @param {string} query La stringa SQL da eseguire.
 * @param {Object} options Opzioni aggiuntive (database, workgroup, outputLocation)
 * @returns {Promise<Array>} Una promessa che si risolve con i risultati della query.
 */
async function runQuery(query, options = {}) {
  // Determina quale database e workgroup usare
  const database = options.database || process.env.ATHENA_DB || config.ATHENA_DB;
  const workgroup = options.workgroup || config.ATHENA_WORKGROUP;
  const outputLocation = options.outputLocation || 
    process.env.ATHENA_OUTPUT_LOCATION || 
    `s3://${config.ATHENA_RESULTS_BUCKET}/athena-results/`;

  const params = {
    QueryString: query,
    QueryExecutionContext: {
      Database: database,
    },
    ResultConfiguration: {
      OutputLocation: outputLocation,
    },
    WorkGroup: workgroup,
  };

  console.log('Esecuzione query Athena:', {
    database,
    workgroup,
    queryPreview: query.substring(0, 200) + '...'
  });
  
  console.log('Query completa:', query);

  // 1. Avvia la query
  const { QueryExecutionId } = await athena.startQueryExecution(params).promise();

  // 2. Controlla lo stato fino al completamento
  while (true) {
    const { QueryExecution } = await athena.getQueryExecution({ QueryExecutionId }).promise();
    const state = QueryExecution.Status.State;

    if (state === 'SUCCEEDED') {
      break; // Esce dal loop se la query ha successo
    } else if (state === 'FAILED' || state === 'CANCELLED') {
      const reason = QueryExecution.Status.StateChangeReason;
      console.error('La query Athena è fallita. Motivo:', reason);
      console.error('Query completa:', query);
      throw new Error(`Query fallita o cancellata. Motivo: ${reason}`);
    }

    // Attende 2 secondi prima di controllare di nuovo
    await sleep(2000);
  }

  // 3. Ottiene i risultati
  const results = await athena.getQueryResults({ QueryExecutionId }).promise();
  return formatResults(results);
}

/**
 * Esegue una query SAP specificando il database e workgroup corretti
 * @param {string} query La stringa SQL da eseguire
 * @returns {Promise<Array>} Una promessa che si risolve con i risultati della query
 */
async function runSAPQuery(query) {
  return runQuery(query, {
    database: config.SAP_ATHENA_DB,
    workgroup: config.SAP_ATHENA_WORKGROUP,
    outputLocation: `s3://${config.ATHENA_RESULTS_BUCKET}/sap-results/`
  });
}

/**
 * Formatta i risultati grezzi di Athena in un formato JSON più pulito.
 * @param {Object} results I risultati da GetQueryResults.
 * @returns {Array<Object>} Un array di oggetti, dove ogni oggetto rappresenta una riga.
 */
function formatResults(results) {
    const rows = results.ResultSet.Rows;
    if (rows.length === 0) return [];

    // La prima riga contiene le intestazioni
    const headers = rows.shift().Data.map(col => col.VarCharValue);

    // Mappa le righe rimanenti in oggetti JSON
    return rows.map(row => {
        const rowObject = {};
        row.Data.forEach((col, index) => {
            rowObject[headers[index]] = col.VarCharValue;
        });
        return rowObject;
    });
}

module.exports = { runQuery, runSAPQuery };