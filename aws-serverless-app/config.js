// ====================================================================
// FILE DI CONFIGURAZIONE DEL BACKEND
// Modifica i valori in questo file prima del deploy.
// ====================================================================

module.exports = {
  AWS_REGION: 'eu-west-1',
  
  // Configurazione CloudConnexa
  ATHENA_DB: 'cloudconnexa_logs_db',
  ATHENA_RESULTS_BUCKET: 'horsaruncloudconnexalog',
  ATHENA_WORKGROUP: 'hrun-cloudconnexa-wg',
  
  // Configurazione SAP
  SAP_ATHENA_DB: 'sap_reports_db',
  SAP_ATHENA_WORKGROUP: 'ReportCheckSistemiSap', // Workgroup dedicato per SAP
};