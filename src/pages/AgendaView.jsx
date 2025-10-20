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
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [taskToReject, setTaskToReject] = useState(null);

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

  const handleRejectTask = (task) => {
    setTaskToReject(task);
    setRejectionReason("");
    setShowRejectionModal(true);
  };

  const submitRejection = async () => {
    if (!taskToReject) return;
    
    setLoading(true);
    try {
      const updatedTask = {
        id: taskToReject.id,
        status: 'rifiutata',
        motivazioneRifiuto: rejectionReason
      };
      
      await axios.put(`${API_URL}/agenda/tasks/${taskToReject.id}`, updatedTask);
      setShowRejectionModal(false);
      setTaskToReject(null);
      setRejectionReason("");
      setShowTaskForm(false);
      fetchTasks();
    } catch (err) {
      console.error('Errore nel rifiuto dell\'attività:', err);
      setError('Impossibile registrare il rifiuto dell\'attività.');
    } finally {
      setLoading(false);
    }
  };

  const TaskForm = ({ task, onSave, onCancel, userRole, userClientName, onReject }) => {
    const [formData, setFormData] = useState({
      status: 'proposta',
      ...task
    });
    const [clients, setClients] = useState([]);
    const [sids, setSids] = useState([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [loadingSids, setLoadingSids] = useState(false);
    const [loadingError, setLoadingError] = useState(null);
    
    const isReadOnly = formData.readOnly === true;
    const isClientRole = userRole === 'cliente';
    const isAdminRole = userRole === 'admin';

    // Carica la lista dei clienti all'inizializzazione
    useEffect(() => {
      if (isAdminRole) {
        fetchClients();
      }
    }, [isAdminRole]);

    // Carica i SID quando viene selezionato un cliente
    useEffect(() => {
      if (isAdminRole && formData.nomeCliente) {
        fetchSids(formData.nomeCliente);
      }
    }, [isAdminRole, formData.nomeCliente]);

    const fetchClients = async () => {
      setLoadingClients(true);
      setLoadingError(null);
      try {
        // Utilizziamo l'endpoint API esistente per ottenere i clienti
        const response = await axios.get(`${API_URL}/sap/clients`);
        setClients(response.data);
      } catch (err) {
        console.error('Errore nel recupero dei clienti:', err);
        setLoadingError('Impossibile caricare la lista dei clienti. Riprova più tardi.');
      } finally {
        setLoadingClients(false);
      }
    };

    const fetchSids = async (clientName) => {
      if (!clientName) return;
      
      setLoadingSids(true);
      setLoadingError(null);
      try {
        // Utilizziamo l'endpoint API esistente per ottenere i SID
        const response = await axios.get(`${API_URL}/sap/sids?clientName=${encodeURIComponent(clientName)}`);
        setSids(response.data);
        
        // Se non c'è un SID selezionato o non è nella lista, seleziona il primo
        if (!formData.sid || !response.data.some(s => s.sid === formData.sid)) {
          if (response.data.length > 0) {
            setFormData(prev => ({
              ...prev,
              sid: response.data[0].sid
            }));
          }
        }
      } catch (err) {
        console.error('Errore nel recupero dei SID:', err);
        setLoadingError('Impossibile caricare la lista dei SID per il cliente selezionato.');
      } finally {
        setLoadingSids(false);
      }
    };
    
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
    
    // Se il cliente sceglie "rifiutata", mostriamo il modal
    const handleStatusChange = (e) => {
      const newStatus = e.target.value;
      
      if (isClientRole && newStatus === 'rifiutata') {
        // Se è previsto un handler per il rifiuto con motivazione
        if (onReject && formData.id) {
          e.preventDefault(); // Previene il cambiamento diretto dello stato
          onReject(formData);
          return;
        }
      }
      
      // Altrimenti procedi normalmente
      handleChange(e);
    };
    
    return (
      <div className="task-form-overlay">
        <div className="task-form-content">
          <h3>{formData.id ? 'Gestione Attività' : 'Nuova Attività'}</h3>
          {loadingError && <div className="form-error">{loadingError}</div>}
          
          <form onSubmit={handleSubmit}>
            {/* Per admin, usiamo il selettore di clienti e SID */}
            {isAdminRole ? (
              <>
                <div className="form-group">
                  <label htmlFor="clientSelector">Cliente:</label>
                  <div className="selector-wrapper">
                    <select 
                      id="clientSelector"
                      name="nomeCliente"
                      value={formData.nomeCliente} 
                      onChange={handleChange}
                      disabled={loadingClients}
                      required
                    >
                      <option value="">-- Seleziona cliente --</option>
                      {clients.map((client) => (
                        <option key={client.nomecliente} value={client.nomecliente}>
                          {client.nomecliente}
                        </option>
                      ))}
                    </select>
                    {loadingClients && <span className="loading-indicator">⟳</span>}
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="sidSelector">SID:</label>
                  <div className="selector-wrapper">
                    <select 
                      id="sidSelector"
                      name="sid"
                      value={formData.sid} 
                      onChange={handleChange}
                      disabled={loadingSids || !formData.nomeCliente}
                      required
                    >
                      <option value="">-- Seleziona SID --</option>
                      {sids.map((sidObj) => (
                        <option key={sidObj.sid} value={sidObj.sid}>
                          {sidObj.sid}
                        </option>
                      ))}
                    </select>
                    {loadingSids && <span className="loading-indicator">⟳</span>}
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

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
                <select name="status" value={formData.status || 'proposta'} onChange={handleStatusChange}>
                  <option value="proposta">In attesa</option>
                  <option value="accettata">Accettare</option>
                  <option value="rifiutata">Rifiutare</option>
                </select>
              </div>
            )}

            {/* Checkbox canClientEdit - solo per admin */}
            {isAdminRole && (
              <div className="form-group checkbox-group">
                <div className="edit-permission-container">
                  <input 
                    type="checkbox" 
                    name="canClientEdit" 
                    checked={formData.canClientEdit} 
                    onChange={handleChange} 
                    id="canClientEdit" 
                  />
                  <label htmlFor="canClientEdit">
                    {formData.canClientEdit ? '🔓' : '🔒'} 
                    Il cliente può modificare i dettagli dell'attività
                  </label>
                </div>
              </div>
            )}
            
            {/* Motivazione di rifiuto (solo admin può visualizzare) */}
            {isAdminRole && formData.motivazioneRifiuto && (
              <div className="form-group">
                <label>Motivazione del rifiuto:</label>
                <div className="rejection-reason">
                  {formData.motivazioneRifiuto}
                </div>
              </div>
            )}
            
            <div className="form-actions">
              <button type="submit">Salva</button>
              <button type="button" onClick={onCancel}>Annulla</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const RejectionModal = () => {
    return (
      <div className="rejection-modal-overlay">
        <div className="rejection-modal-content">
          <h3>Motivazione del rifiuto</h3>
          <p>Per favore, fornisci una motivazione per il rifiuto dell'attività:</p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Scrivi qui la motivazione del rifiuto..."
            rows={4}
            autoFocus={true}
          />
          <div className="rejection-modal-actions">
            <button 
              onClick={submitRejection} 
              disabled={!rejectionReason.trim()}
              className={!rejectionReason.trim() ? "disabled" : ""}
            >
              Conferma rifiuto
            </button>
            <button onClick={() => setShowRejectionModal(false)}>Annulla</button>
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

  return (
    <div className="agenda-container">
      <div className="calendar-header">
        <div className="month-navigation">
          <button onClick={handlePrevMonth} className="nav-button">
            &laquo;
          </button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={handleNextMonth} className="nav-button">
            &raquo;
          </button>
        </div>
      </div>

      {loading && <div className="loading-spinner">Caricamento in corso...</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="calendar">
        <div className="weekdays">
          {daysOfWeek.map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="days">
          {getDaysInMonth(currentDate).map(day => {
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
                      {isAdminRole && task.motivazioneRifiuto && (
                        <div className="task-rejection-reason" title={task.motivazioneRifiuto}>
                          Motivazione: {task.motivazioneRifiuto.substring(0, 20)}
                          {task.motivazioneRifiuto.length > 20 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showTaskForm && (
        <TaskForm 
          task={editingTask}
          onSave={handleSaveTask}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          userRole={userRole}
          userClientName={userClientName}
          onReject={handleRejectTask}
        />
      )}
      
      {showRejectionModal && <RejectionModal />}
    </div>
  );
};

AgendaView.propTypes = {
  userRole: PropTypes.string.isRequired,
  userClientName: PropTypes.string,
  user: PropTypes.object
};

export default AgendaView;
