const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

AWS.config.update({ region: config.AWS_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = 'AgendaTasks';

console.log('Inizializzazione servizio DynamoDB con tabella:', TABLE_NAME, 'nella regione:', config.AWS_REGION);

// Crea una nuova attività
// Crea una nuova attività
const createTask = async (task) => {
  console.log('DynamoDB createTask - parametri:', task);
  
  const now = new Date().toISOString();
  const params = {
    TableName: TABLE_NAME,
    Item: {
      id: task.id || uuidv4(),
      nomeCliente: task.nomeCliente.toLowerCase(), // Normalizza a lowercase
      sid: task.sid,
      data: task.data,
      oraInizio: task.oraInizio,
      orarioFine: task.orarioFine,
      emailCliente: task.emailCliente,
      descrizione: task.descrizione,
      createdBy: task.createdBy,
      lastModifiedBy: task.lastModifiedBy,
      canClientEdit: task.canClientEdit || false,
      status: task.status || 'proposta', // Nuovo campo: 'proposta', 'accettata', 'rifiutata'
      createdAt: task.createdAt || now,
      updatedAt: task.updatedAt || now,
    },
  };
  
  try {
    await dynamodb.put(params).promise();
    console.log('DynamoDB createTask - successo:', params.Item.id);
    return params.Item;
  } catch (error) {
    console.error('DynamoDB createTask - errore:', error);
    throw error;
  }
};

// Recupera attività per un cliente e un mese specifico
const getTasksByClientAndMonth = async (nomeCliente, yearMonth) => {
  console.log(`DynamoDB getTasksByClientAndMonth - parametri: nomeCliente=${nomeCliente}, yearMonth=${yearMonth}`);
  
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'ByClientAndDateIndex',
    KeyConditionExpression: 'nomeCliente = :nc AND begins_with(#data, :ym)',
    ExpressionAttributeNames: {
      '#data': 'data',
    },
    ExpressionAttributeValues: {
      ':nc': nomeCliente.toLowerCase(),
      ':ym': yearMonth,
    },
  };
  
  try {
    const result = await dynamodb.query(params).promise();
    console.log(`DynamoDB getTasksByClientAndMonth - trovate ${result.Items.length} attività`);
    return result.Items;
  } catch (error) {
    console.error('!!! ERRORE DETTAGLIATO DYNAMODB (getTasksByClientAndMonth) !!!', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Recupera tutte le attività per un mese (usa Scan perché non possiamo fare begins_with su HASH key)
const getTasksByMonth = async (yearMonth) => {
  console.log(`DynamoDB getTasksByMonth - parametri: yearMonth=${yearMonth}`);
  
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(#data, :ym)',
    ExpressionAttributeNames: {
      '#data': 'data',
    },
    ExpressionAttributeValues: {
      ':ym': yearMonth,
    },
  };
  
  try {
    const result = await dynamodb.scan(params).promise();
    console.log(`DynamoDB getTasksByMonth - trovate ${result.Items.length} attività`);
    return result.Items;
  } catch (error) {
    console.error('!!! ERRORE DETTAGLIATO DYNAMODB (getTasksByMonth) !!!', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Recupera una singola attività per ID
const getTaskById = async (id) => {
  console.log(`DynamoDB getTaskById - parametri: id=${id}`);
  
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };
  
  try {
    const result = await dynamodb.get(params).promise();
    console.log(`DynamoDB getTaskById - risultato:`, result.Item ? 'trovato' : 'non trovato');
    return result.Item;
  } catch (error) {
    console.error('!!! ERRORE DETTAGLIATO DYNAMODB (getTaskById) !!!', JSON.stringify(error, null, 2));
    throw error;
  }
};

// Aggiorna un'attività esistente
const updateTask = async (id, updates) => {
  console.log(`DynamoDB updateTask - parametri: id=${id}, updates=`, updates);
  
  const now = new Date().toISOString();
  
  // Prepara oggetti per l'espressione di aggiornamento
  const expressionParts = [];
  const attributeValues = {};
  const attributeNames = {};
  
  // Gestisci updatedAt separatamente
  updates.updatedAt = updates.updatedAt || now;
  
  // Itera attraverso gli aggiornamenti e costruisci l'espressione
  Object.entries(updates).forEach(([key, value]) => {
    // Ignora l'id e createdAt che non dovrebbero essere modificati
    if (key !== 'id' && key !== 'createdAt') {
      // Usa expression attribute names per le parole riservate e tutti i campi per sicurezza
      const attributeName = `#${key}`;
      const attributeValue = `:${key}`;
      
      attributeNames[attributeName] = key;
      
      // Gestione speciale per nomeCliente (lowercase)
      if (key === 'nomeCliente' && typeof value === 'string') {
        attributeValues[attributeValue] = value.toLowerCase();
      } else {
        attributeValues[attributeValue] = value;
      }
      
      expressionParts.push(`${attributeName} = ${attributeValue}`);
    }
  });
  
  // Verifica che ci siano campi da aggiornare
  if (expressionParts.length === 0) {
    throw new Error('No valid fields to update.');
  }
  
  // Costruisci i parametri per l'aggiornamento
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeValues: attributeValues,
    ExpressionAttributeNames: attributeNames,
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    console.log('Parametri di aggiornamento:', JSON.stringify(params, null, 2));
    const result = await dynamodb.update(params).promise();
    console.log(`DynamoDB updateTask - successo, attività aggiornata`);
    return result.Attributes;
  } catch (error) {
    console.error('!!! ERRORE DETTAGLIATO DYNAMODB (updateTask) !!!', error);
    console.error('DynamoDB updateTask - errore:', error);
    throw error;
  }
};

// Elimina un'attività
const deleteTask = async (id) => {
  console.log(`DynamoDB deleteTask - parametri: id=${id}`);
  
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };
  
  try {
    await dynamodb.delete(params).promise();
    console.log(`DynamoDB deleteTask - successo, attività eliminata`);
    return { message: 'Task deleted successfully' };
  } catch (error) {
    console.error('!!! ERRORE DETTAGLIATO DYNAMODB (deleteTask) !!!', JSON.stringify(error, null, 2));
    throw error;
  }
};

module.exports = {
  createTask,
  getTasksByClientAndMonth,
  getTasksByMonth,
  getTaskById,
  updateTask,
  deleteTask,
};