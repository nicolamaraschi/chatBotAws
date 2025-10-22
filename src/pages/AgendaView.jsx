// File: src/pages/AgendaView.jsx
// Calendario responsivo corretto con debug dei problemi di rendering

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import './AgendaView.css';
import { API_URL } from '../config';
import ClientSidSelector from '../components/ClientSidSelector';

const AgendaView = ({ userRole, userClientName, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'

  const isAdminRole = userRole === 'admin';
  const isClientRole = userRole === 'cliente';

  useEffect(() => {
    fetchTasks();
  }, [currentDate, userClientName]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;
      
      let url = `${API_URL}/agenda/tasks?yearMonth=${yearMonth}`;
      
      if (isClientRole && userClientName) {
        url += `&nomeCliente=${encodeURIComponent(userClientName)}`;
      }
      
      const response = await axios.get(url);
      setTasks(response.data);
    } catch (err) {
      console.error('Errore nel recupero attività:', err);
      setError('Impossibile caricare le attività. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPeriod = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() - 1);
      }
      return newDate;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = [];
    
    // Ottieni il primo giorno del mese
    const firstDayOfMonth = new Date(year, month, 1);
    // Ottieni l'ultimo giorno del mese
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Riempi l'array con i giorni del mese
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      daysInMonth.push(new Date(year, month, i));
    }
    
    return daysInMonth;
  };

  const getTasksForDay = (day) => {
    const dayString = day.toISOString().split('T')[0];
    return tasks.filter(task => task.data === dayString);
  };

  const handleDayClick = (day) => {
    if (isAdminRole) {
      // Fix del problema timezone - usiamo un metodo che evita il problema dello spostamento di data
      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(day.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${dayOfMonth}`;
      
      // Admin può aggiungere nuova attività per questo giorno
      setEditingTask({ 
        data: formattedDate, 
        nomeCliente: '', 
        sid: '', 
        oraInizio: '', 
        orarioFine: '', 
        emailCliente: '', 
        descrizione: '', 
        canClientEdit: false,
        status: 'proposta' // Stato predefinito
      });
      setShowTaskForm(true);
    }
  };

  const handleEditTask = (task) => {
    // L'admin può sempre modificare
    if (isAdminRole) {
      setEditingTask(task);
      setShowTaskForm(true);
      return;
    }
    
    // Il cliente può sempre vedere il form per accettare/rifiutare,
    // indipendentemente dal valore di canClientEdit
    if (isClientRole && task.nomeCliente === userClientName) {
      setEditingTask({
        ...task,
        readOnly: !task.canClientEdit
      });
      setShowTaskForm(true);
    }
  };

  const handleSaveTask = async () => {
    if (!editingTask) return;
    
    setLoading(true);
    try {
      let response;
      
      if (editingTask.id) {
        // Aggiornamento
        response = await axios.put(`${API_URL}/agenda/tasks/${editingTask.id}`, editingTask);
      } else {
        // Nuova attività
        response = await axios.post(`${API_URL}/agenda/tasks`, editingTask);
      }
      
      fetchTasks();
      setShowTaskForm(false);
    } catch (err) {
      console.error('Errore nel salvataggio attività:', err);
      setError('Impossibile salvare l\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTask = () => {
    setShowRejectionModal(true);
  };

  const submitRejection = async () => {
    if (!editingTask) return;
    
    setLoading(true);
    try {
      const updatedTask = {
        ...editingTask,
        status: 'rifiutata',
        motivazioneRifiuto: rejectionReason
      };
      
      await axios.put(`${API_URL}/agenda/tasks/${editingTask.id}`, updatedTask);
      fetchTasks();
      setShowRejectionModal(false);
      setShowTaskForm(false);
    } catch (err) {
      console.error('Errore nel rifiuto attività:', err);
      setError('Impossibile aggiornare lo stato dell\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async () => {
    if (!editingTask) return;
    
    setLoading(true);
    try {
      const updatedTask = {
        ...editingTask,
        status: 'accettata'
      };
      
      await axios.put(`${API_URL}/agenda/tasks/${editingTask.id}`, updatedTask);
      fetchTasks();
      setShowTaskForm(false);
    } catch (err) {
      console.error('Errore nell\'accettazione attività:', err);
      setError('Impossibile aggiornare lo stato dell\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa attività?')) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/agenda/tasks/${taskId}`);
      fetchTasks();
      setShowTaskForm(false);  // Chiudi il form dopo l'eliminazione
      setEditingTask(null);    // Reset dei dati del task in editing
    } catch (err) {
      console.error('Errore nell\'eliminazione attività:', err);
      setError('Impossibile eliminare l\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelected = (clientName) => {
    setEditingTask(prev => ({ ...prev, nomeCliente: clientName }));
  };

  const handleSidSelected = (sid) => {
    setEditingTask(prev => ({ ...prev, sid: sid }));
  };

  // Renderizza il form per modificare/creare un'attività
  const renderTaskForm = () => {
    if (!showTaskForm || !editingTask) return null;
    
    const isNew = !editingTask.id;
    const isReadOnly = editingTask.readOnly;
    
    return (
      <div className="task-form-overlay">
        <div className="task-form-container">
          <h3>{isNew ? 'Nuova attività' : 'Dettagli attività'}</h3>
          
          <div className="form-group">
            <label>Data</label>
            <input 
              type="date" 
              value={editingTask.data || ''} 
              onChange={(e) => setEditingTask({...editingTask, data: e.target.value})}
              disabled={!isAdminRole || !isNew}
            />
          </div>
          
          {isAdminRole && isNew ? (
            <ClientSidSelector
              onClientSelected={handleClientSelected}
              onSidSelected={handleSidSelected}
              initialClient={editingTask.nomeCliente}
              initialSid={editingTask.sid}
            />
          ) : (
            <>
              <div className="form-group">
                <label>Cliente</label>
                <input 
                  type="text" 
                  value={editingTask.nomeCliente || ''} 
                  onChange={(e) => setEditingTask({...editingTask, nomeCliente: e.target.value})}
                  disabled={!isAdminRole || !isNew}
                />
              </div>
              
              <div className="form-group">
                <label>SID</label>
                <input 
                  type="text" 
                  value={editingTask.sid || ''} 
                  onChange={(e) => setEditingTask({...editingTask, sid: e.target.value})}
                  disabled={!isAdminRole && isReadOnly}
                />
              </div>
            </>
          )}
          
          <div className="form-group">
            <label>Ora Inizio</label>
            <input 
              type="time" 
              value={editingTask.oraInizio || ''} 
              onChange={(e) => setEditingTask({...editingTask, oraInizio: e.target.value})}
              disabled={!isAdminRole && isReadOnly}
            />
          </div>
          
          <div className="form-group">
            <label>Ora Fine</label>
            <input 
              type="time" 
              value={editingTask.orarioFine || ''} 
              onChange={(e) => setEditingTask({...editingTask, orarioFine: e.target.value})}
              disabled={!isAdminRole && isReadOnly}
            />
          </div>
          
          <div className="form-group">
            <label>Email Cliente</label>
            <input 
              type="email" 
              value={editingTask.emailCliente || ''} 
              onChange={(e) => setEditingTask({...editingTask, emailCliente: e.target.value})}
              disabled={!isAdminRole && isReadOnly}
            />
          </div>
          
          <div className="form-group">
            <label>Descrizione</label>
            <textarea 
              value={editingTask.descrizione || ''} 
              onChange={(e) => setEditingTask({...editingTask, descrizione: e.target.value})}
              disabled={!isAdminRole && isReadOnly}
              rows="4"
            />
          </div>
          
          {isAdminRole && (
            <div className="form-group">
              <label>Permetti modifica al cliente</label>
              <input 
                type="checkbox" 
                checked={editingTask.canClientEdit || false} 
                onChange={(e) => setEditingTask({...editingTask, canClientEdit: e.target.checked})}
                disabled={!isAdminRole}
              />
            </div>
          )}
          
          <div className="task-form-buttons">
            {isClientRole && !isReadOnly && (
              <>
                <button onClick={handleAcceptTask} className="button-accept">
                  Accetta
                </button>
                <button onClick={handleRejectTask} className="button-reject">
                  Rifiuta
                </button>
              </>
            )}
            
            {(isAdminRole || !isReadOnly) && (
              <button onClick={handleSaveTask} className="button-save">
                Salva
              </button>
            )}
            
            {isAdminRole && editingTask.id && (
              <button onClick={() => handleDeleteTask(editingTask.id)} className="button-delete">
                Elimina
              </button>
            )}
            
            <button onClick={() => setShowTaskForm(false)}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizza il modal per il rifiuto dell'attività
  const renderRejectionModal = () => {
    if (!showRejectionModal) return null;
    
    return (
      <div className="task-form-overlay">
        <div className="task-form-container">
          <h3>Rifiuta attività</h3>
          
          <div className="form-group">
            <label>Motivo del rifiuto:</label>
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows="4"
              required
            />
          </div>
          
          <div className="task-form-buttons">
            <button 
              onClick={submitRejection} 
              className={rejectionReason.length > 0 ? "" : "disabled"} 
              disabled={!rejectionReason}
            >
              Conferma rifiuto
            </button>
            <button onClick={() => setShowRejectionModal(false)}>
              Annulla
            </button>
          </div>
        </div>
      </div>
    );
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  // Versione semplificata e robusta
  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    
    return (
      <div className="calendar">
        <div className="weekdays">
          {daysOfWeek.map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="days">
          {days.map(day => {
            const dayTasks = getTasksForDay(day);
            const isToday = new Date().toDateString() === day.toDateString();
            
            return (
              <div 
                key={day.toISOString()} 
                className={`day ${isToday ? 'today' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="day-number">{day.getDate()}</div>
                <div className="day-tasks">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={`task-item status-${task.status || 'proposta'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTask(task);
                      }}
                    >
                      <div className="task-time">
                        {task.oraInizio} - {task.orarioFine}
                      </div>
                      <div className="task-name">
                        {task.nomeCliente} {task.sid && `- ${task.sid}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="agenda-container">
      <div className="calendar-header">
        <div className="month-navigation">
          <button onClick={handlePrevPeriod} className="nav-button">
            &laquo;
          </button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={handleNextPeriod} className="nav-button">
            &raquo;
          </button>
        </div>
        
        {/* Disattivato temporaneamente per stabilità
        <div className="view-mode-buttons">
          <button 
            onClick={() => setViewMode('month')} 
            className={viewMode === 'month' ? 'active' : ''}
          >
            Mese
          </button>
          <button 
            onClick={() => setViewMode('week')} 
            className={viewMode === 'week' ? 'active' : ''}
          >
            Settimana
          </button>
          <button 
            onClick={() => setViewMode('day')} 
            className={viewMode === 'day' ? 'active' : ''}
          >
            Giorno
          </button>
        </div>
        */}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading && <div className="loading">Caricamento...</div>}
      
      {!loading && (
        <>
          {viewMode === 'month' && renderMonthView()}
          {/* Implementare altre visualizzazioni (settimana, giorno) in futuro */}
        </>
      )}
      
      {renderTaskForm()}
      {renderRejectionModal()}
    </div>
  );
};

AgendaView.propTypes = {
  userRole: PropTypes.string.isRequired,
  userClientName: PropTypes.string,
  user: PropTypes.object
};

export default AgendaView;