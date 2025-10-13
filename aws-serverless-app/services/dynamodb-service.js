const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid'); // Per generare ID unici
const config = require('../config'); // Assumendo che config.js contenga AWS_REGION

AWS.config.update({ region: config.AWS_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = 'AgendaTasks'; // Nome della tabella DynamoDB

console.log('Inizializzazione servizio DynamoDB con tabella:', TABLE_NAME, 'nella regione:', config.AWS_REGION);

// Funzione per creare una nuova attività
const createTask = async (task) => {
  console.log('DynamoDB createTask - parametri:', task);
  
  const now = new Date().toISOString();
  const params = {
    TableName: TABLE_NAME,
    Item: {
      id: task.id || uuidv4(),
      nomeCliente: task.nomeCliente,
      sid: task.sid,
      data: task.data, // Formato YYYY-MM-DD
      oraInizio: task.oraInizio,
      orarioFine: task.orarioFine,
      emailCliente: task.emailCliente,
      descrizione: task.descrizione,
      createdBy: task.createdBy,
      lastModifiedBy: task.lastModifiedBy,
      canClientEdit: task.canClientEdit || false, // Default a false
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

// Funzione per recuperare attività per un cliente e un mese specifico
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
      ':ym': yearMonth, // Formato YYYY-MM
    },
  };
  
  try {
    const result = await dynamodb.query(params).promise();
    console.log(`DynamoDB getTasksByClientAndMonth - trovate ${result.Items.length} attività`);
    return result.Items;
  } catch (error) {
    console.error('DynamoDB getTasksByClientAndMonth - errore:', error);
    throw error;
  }
};

// Funzione per recuperare tutte le attività per un mese specifico (per admin)
const getTasksByMonth = async (yearMonth) => {
  console.log(`DynamoDB getTasksByMonth - parametri: yearMonth=${yearMonth}`);
  
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'ByDateAndClientIndex',
    KeyConditionExpression: 'begins_with(#data, :ym)',
    ExpressionAttributeNames: {
      '#data': 'data',
    },
    ExpressionAttributeValues: {
      ':ym': yearMonth, // Formato YYYY-MM
    },
  };
  
  try {
    const result = await dynamodb.query(params).promise();
    console.log(`DynamoDB getTasksByMonth - trovate ${result.Items.length} attività`);
    return result.Items;
  } catch (error) {
    console.error('DynamoDB getTasksByMonth - errore:', error);
    throw error;
  }
};

// Funzione per recuperare una singola attività per ID
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
    console.error('DynamoDB getTaskById - errore:', error);
    throw error;
  }
};

// Funzione per aggiornare un'attività esistente
const updateTask = async (id, updates) => {
  console.log(`DynamoDB updateTask - parametri: id=${id}, updates=`, updates);
  
  const now = new Date().toISOString();
  const updateExpressionParts = [];
  const ExpressionAttributeValues = { ':updatedAt': updates.updatedAt || now };
  const ExpressionAttributeNames = {};

  for (const key in updates) {
    if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
      if (key === 'data') {
        updateExpressionParts.push(`#data = :data`);
        ExpressionAttributeNames['#data'] = 'data';
        ExpressionAttributeValues[':data'] = updates.data;
      } else {
        updateExpressionParts.push(`${key} = :${key}`);
        ExpressionAttributeValues[`:${key}`] = updates[key];
      }
    }
  }
  updateExpressionParts.push('updatedAt = :updatedAt');

  if (updateExpressionParts.length === 0) {
    throw new Error('No valid fields to update.');
  }

  const params = {
    TableName: TABLE_NAME,
    Key: { id },
    UpdateExpression: 'SET ' + updateExpressionParts.join(', '),
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  // Aggiungi ExpressionAttributeNames se ci sono
  if (Object.keys(ExpressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = ExpressionAttributeNames;
  }

  try {
    const result = await dynamodb.update(params).promise();
    console.log(`DynamoDB updateTask - successo, attività aggiornata`);
    return result.Attributes;
  } catch (error) {
    console.error('DynamoDB updateTask - errore:', error);
    throw error;
  }
};

// Funzione per eliminare un'attività
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
    console.error('DynamoDB deleteTask - errore:', error);
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