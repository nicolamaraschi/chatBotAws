const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid'); // Per generare ID unici
const config = require('../config'); // Assumendo che config.js contenga AWS_REGION e il nome della tabella

AWS.config.update({ region: config.AWS_REGION });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = 'AgendaTasks'; // Nome della tabella DynamoDB

// Funzione per creare una nuova attività
const createTask = async (task) => {
  const now = new Date().toISOString();
  const params = {
    TableName: TABLE_NAME,
    Item: {
      id: uuidv4(),
      nomeCliente: task.nomeCliente,
      sid: task.sid,
      data: task.data, // Formato YYYY-MM-DD
      oraInizio: task.oraInizio,
      orarioFine: task.orarioFine,
      emailCliente: task.emailCliente,
      descrizione: task.descrizione,
      createdBy: task.createdBy,
      lastModifiedBy: task.createdBy,
      canClientEdit: task.canClientEdit || false, // Default a false
      createdAt: now,
      updatedAt: now,
    },
  };
  await dynamodb.put(params).promise();
  return params.Item;
};

// Funzione per recuperare attività per un cliente e un mese specifico
const getTasksByClientAndMonth = async (nomeCliente, yearMonth) => {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'ByClientAndDateIndex', // Usiamo il GSI per questa query
    KeyConditionExpression: 'nomeCliente = :nc AND begins_with(#data, :ym)',
    ExpressionAttributeNames: {
      '#data': 'data',
    },
    ExpressionAttributeValues: {
      ':nc': nomeCliente,
      ':ym': yearMonth, // Formato YYYY-MM
    },
  };
  const result = await dynamodb.query(params).promise();
  return result.Items;
};

// Funzione per recuperare tutte le attività per un mese specifico (per admin)
const getTasksByMonth = async (yearMonth) => {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'ByDateAndClientIndex', // Usiamo il GSI per questa query
    KeyConditionExpression: 'begins_with(#data, :ym)',
    ExpressionAttributeNames: {
      '#data': 'data',
    },
    ExpressionAttributeValues: {
      ':ym': yearMonth, // Formato YYYY-MM
    },
  };
  const result = await dynamodb.query(params).promise();
  return result.Items;
};

// Funzione per recuperare una singola attività per ID
const getTaskById = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };
  const result = await dynamodb.get(params).promise();
  return result.Item;
};

// Funzione per aggiornare un'attività esistente
const updateTask = async (id, updates) => {
  const now = new Date().toISOString();
  const updateExpressionParts = [];
  const ExpressionAttributeValues = { ':updatedAt': now };
  const ExpressionAttributeNames = {};

  for (const key in updates) {
    if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
      updateExpressionParts.push(`${key} = :${key}`);
      ExpressionAttributeValues[`:${key}`] = updates[key];
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

  // Aggiungi ExpressionAttributeNames se ci sono nomi riservati (es. 'data')
  if (updates.data) ExpressionAttributeNames['#data'] = 'data';
  if (Object.keys(ExpressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = ExpressionAttributeNames;
    params.UpdateExpression = params.UpdateExpression.replace('data = :data', '#data = :data');
  }

  const result = await dynamodb.update(params).promise();
  return result.Attributes;
};

// Funzione per eliminare un'attività
const deleteTask = async (id) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { id },
  };
  await dynamodb.delete(params).promise();
  return { message: 'Task deleted successfully' };
};

module.exports = {
  createTask,
  getTasksByClientAndMonth,
  getTasksByMonth,
  getTaskById,
  updateTask,
  deleteTask,
};