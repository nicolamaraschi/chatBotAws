import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { API_URL } from '../config';
import './AgendaView.css';

const AgendaView = ({ userRole, userClientName, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const isClientRole = userRole === 'cliente';
  const isAdminRole = userRole === 'admin';

  useEffect(() => {
    fetchTasks();
  }, [currentDate, userRole, userClientName]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      let url = `${API_URL}/agenda/tasks?yearMonth=${yearMonth}`;

      if (isClientRole && userClientName) {
        url += `&nomeCliente=${userClientName}`;
      }

      const response = await axios.get(url);
      setTasks(response.data);
    } catch (err) {
      console.error('Errore nel recupero delle attività:', err);
      setError('Impossibile caricare le attività. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();

    const days = [];
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getTasksForDay = (day) => {
    const dayString = day.toISOString().split('T')[0];
    return tasks.filter(task => task.data === dayString);
  };

  const handleDayClick = (day) => {
    if (isAdminRole) {
      // Admin può aggiungere nuova attività per questo giorno
      setEditingTask({ 
        data: day.toISOString().split('T')[0], 
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
      // Creiamo una copia dell'attività ma con meno campi modificabili
      // per il cliente quando canClientEdit è false
      setEditingTask({
        ...task,
        // Se il cliente non può modificare, diamo solo accesso al campo status
        readOnly: !task.canClientEdit
      });
      setShowTaskForm(true);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa attività?')) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/agenda/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      console.error('Errore nell\'eliminazione attività:', err);
      setError('Impossibile eliminare l\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async (taskData) => {
    setLoading(true);
    try {
      if (taskData.id) {
        // Aggiorna attività esistente
        await axios.put(`${API_URL}/agenda/tasks/${taskData.id}`, taskData);
      } else {
        // Crea nuova attività
        await axios.post(`${API_URL}/agenda/tasks`, taskData);
      }
      setShowTaskForm(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      console.error('Errore nel salvataggio attività:', err);
      setError('Impossibile salvare l\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const TaskForm = ({ task, onSave, onCancel, userRole, userClientName }) => {
    const [formData, setFormData] = useState({
      status: 'proposta',
      ...task
    });
    
    const isReadOnly = formData.readOnly === true;
    
    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      
      // Se è in modalità readOnly (cliente che può solo accettare/rifiutare),
      // invia solo l'aggiornamento dello stato, non tutti i campi
      if (isReadOnly && isClientRole) {
        onSave({
          id: formData.id,
          status: formData.status
        });
      } else {
        onSave(formData);
      }
    };
    
    return (
      <div className="task-form-overlay">
        <div className="task-form-content">
          <h3>{formData.id ? 'Gestione Attività' : 'Nuova Attività'}</h3>
          <form onSubmit={handleSubmit}>
            {/* Campi principali - disabilitati se in readOnly */}
            <div className="form-group">
              <label>Cliente:</label>
              <input 
                type="text" 
                name="nomeCliente" 
                value={formData.nomeCliente} 
                onChange={handleChange} 
                required 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>SID:</label>
              <input 
                type="text" 
                name="sid" 
                value={formData.sid} 
                onChange={handleChange} 
                required 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>Data:</label>
              <input 
                type="date" 
                name="data" 
                value={formData.data} 
                onChange={handleChange} 
                required 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>Ora Inizio:</label>
              <input 
                type="time" 
                name="oraInizio" 
                value={formData.oraInizio} 
                onChange={handleChange} 
                required 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>Ora Fine:</label>
              <input 
                type="time" 
                name="orarioFine" 
                value={formData.orarioFine} 
                onChange={handleChange} 
                required 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>Email Cliente:</label>
              <input 
                type="email" 
                name="emailCliente" 
                value={formData.emailCliente} 
                onChange={handleChange} 
                disabled={isReadOnly || (userRole === 'cliente')} 
              />
            </div>
            <div className="form-group">
              <label>Descrizione:</label>
              <textarea 
                name="descrizione" 
                value={formData.descrizione} 
                onChange={handleChange}
                disabled={isReadOnly || (userRole === 'cliente')}
              ></textarea>
            </div>

            {/* Sezione per lo stato dell'attività */}
            {/* Admin può impostare qualsiasi stato */}
            {isAdminRole && (
              <div className="form-group">
                <label>Stato:</label>
                <select name="status" value={formData.status || 'proposta'} onChange={handleChange}>
                  <option value="proposta">Proposta</option>
                  <option value="accettata">Accettata</option>
                  <option value="rifiutata">Rifiutata</option>
                </select>
              </div>
            )}
            
            {/* Cliente può accettare o rifiutare indipendentemente da canClientEdit */}
            {isClientRole && formData.id && (!formData.status || formData.status === 'proposta') && (
              <div className="form-group">
                <label>Risposta alla proposta:</label>
                <select name="status" value={formData.status || 'proposta'} onChange={handleChange}>
                  <option value="proposta">In attesa</option>
                  <option value="accettata">Accettare</option>
                  <option value="rifiutata">Rifiutare</option>
                </select>
              </div>
            )}

            {/* Checkbox canClientEdit - solo per admin */}
            {isAdminRole && (
              <div className="form-group checkbox-group">
                <input 
                  type="checkbox" 
                  name="canClientEdit" 
                  checked={formData.canClientEdit} 
                  onChange={handleChange} 
                  id="canClientEdit" 
                />
                <label htmlFor="canClientEdit">Il cliente può modificare i dettagli dell'attività</label>
              </div>
            )}
            
            <div className="form-actions">
              {/* Se è in readOnly e il cliente non ha scelto, mostriamo opzioni di accettazione dirette */}
              {isReadOnly && isClientRole && (!formData.status || formData.status === 'proposta') ? (
                <>
                  <button type="button" className="btn-accept" onClick={() => {
                    setFormData(prev => ({...prev, status: 'accettata'}));
                    setTimeout(() => handleSubmit({preventDefault: () => {}}), 100);
                  }}>
                    Accetta
                  </button>
                  <button type="button" className="btn-reject" onClick={() => {
                    setFormData(prev => ({...prev, status: 'rifiutata'}));
                    setTimeout(() => handleSubmit({preventDefault: () => {}}), 100);
                  }}>
                    Rifiuta
                  </button>
                  <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                </>
              ) : (
                <>
                  <button type="submit" className="btn-primary">Salva</button>
                  <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };

  TaskForm.propTypes = {
    task: PropTypes.object,
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    userRole: PropTypes.string,
    userClientName: PropTypes.string,
  };

  const days = getDaysInMonth(currentDate);
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Adjust to start from Monday (0 for Monday)

  return (
    <div className="agenda-view">
      <div className="agenda-header">
        <button onClick={handlePrevMonth}>&lt;</button>
        <h2>{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2>
        <button onClick={handleNextMonth}>&gt;</button>
      </div>

      {loading && <div className="loading-spinner">Caricamento attività...</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="calendar-grid">
        {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map(dayName => (
          <div key={dayName} className="day-name">{dayName}</div>
        ))}
        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="empty-day"></div>
        ))}
        {days.map(day => (
          <div key={day.toISOString()} className="calendar-day" onClick={() => handleDayClick(day)}>
            <div className="day-number">{day.getDate()}</div>
            <div className="day-tasks">
              {getTasksForDay(day).map(task => (
                <div 
                  key={task.id} 
                  className={`task-item ${task.nomeCliente === userClientName ? 'my-task' : ''} status-${task.status || 'proposta'}`}
                  onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                >
                  <div className="task-status-indicator">
                    {/* Icona semaforo in base allo stato */}
                    {task.status === 'accettata' && <span className="status-icon status-green">✓</span>}
                    {task.status === 'rifiutata' && <span className="status-icon status-red">✗</span>}
                    {(!task.status || task.status === 'proposta') && <span className="status-icon status-yellow">?</span>}
                  </div>
                  <div className="task-content">
                    <strong>{task.nomeCliente} - {task.sid}</strong>
                    <p>{task.oraInizio}-{task.orarioFine}</p>
                  </div>
                  {isAdminRole && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }} className="delete-task-btn">X</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          onSave={handleSaveTask}
          onCancel={() => setShowTaskForm(false)}
          userRole={userRole}
          userClientName={userClientName}
        />
      )}
    </div>
  );
};

AgendaView.propTypes = {
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
  user: PropTypes.object.isRequired,
};

export default AgendaView;