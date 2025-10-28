import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import './AgendaView.css';
import { API_URL } from '../config';
import ClientSidSelector from '../components/ClientSidSelector'; // Assicurati che il percorso sia corretto

const AgendaView = ({ userRole, userClientName, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true); // Loading generale per fetchTasks
  const [formLoading, setFormLoading] = useState(false); // Loading per submit del form
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

  // Fix: Gestione body scroll durante modal
  useEffect(() => {
    if (showTaskForm || showRejectionModal) {
      document.body.classList.add('modal-open');
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.paddingRight = '';
    };
  }, [showTaskForm, showRejectionModal]);

  const fetchTasks = async () => {
    setError(null);
    setLoading(true);
    console.log(`fetchTasks initiated for ${currentDate.toISOString().slice(0, 7)}`);

    try {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;
      let url = `${API_URL}/agenda/tasks?yearMonth=${yearMonth}`;
      if (isClientRole && userClientName) {
        url += `&nomeCliente=${encodeURIComponent(userClientName)}`;
      }
      console.log(`Fetching tasks from URL: ${url}`);
      const response = await axios.get(url);
      console.log(`Tasks received:`, response.data);
      setTasks(response.data || []); // Assicura che sia sempre un array
    } catch (err) {
      console.error('Errore nel recupero attività:', err);
      setError('Impossibile caricare le attività. Riprova più tardi.');
      setTasks([]);
    } finally {
      console.log("fetchTasks finished, setting loading to false.");
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

  // Helper to get all days for the current month view
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysArray = [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon,...

    // Add padding days from the previous month
    for (let i = 0; i < startDayOfWeek; i++) {
        daysArray.push(null); // Use null for padding days
    }

    // Add actual days of the month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  // Get tasks for a specific day (Date object)
  const getTasksForDay = (day) => {
    if (!day) return []; // Handle null padding days
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(day.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${dayOfMonth}`;
    return (tasks || []).filter(task => task.data === formattedDate);
  };

  // Handle clicking on a day cell (only admin can add new tasks)
  const handleDayClick = (day) => {
    if (!day) return; // Ignore clicks on padding days
    if (isAdminRole) {
      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(day.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${dayOfMonth}`;
      setEditingTask({
        data: formattedDate, nomeCliente: '', sid: '', oraInizio: '', orarioFine: '',
        emailCliente: '', descrizione: '', canClientEdit: false, status: 'proposta'
      });
      setShowTaskForm(true);
    }
  };

  // Handle clicking on an existing task item
  const handleEditTask = (task) => {
    // Admin can always edit
    if (isAdminRole) {
      setEditingTask(task);
      setShowTaskForm(true);
      return;
    }
    // Client can view details/accept/reject if it's their task
    if (isClientRole && task.nomeCliente === userClientName) {
      setEditingTask({ ...task, readOnly: !task.canClientEdit });
      setShowTaskForm(true);
    }
  };

  // Axios instance with extended timeout for form submissions
  const axiosWithTimeout = axios.create({ timeout: 10000 });

  // Save new or existing task
  const handleSaveTask = async () => {
    if (!editingTask) return;
    if (!editingTask.nomeCliente && isAdminRole) {
      setError('Il nome del cliente è obbligatorio');
      return;
    }
    if (!editingTask.data) {
      setError('La data è obbligatoria');
      return;
    }
    if (!editingTask.oraInizio || !editingTask.orarioFine) {
      setError('Gli orari di inizio e fine sono obbligatori');
      return;
    }
    setFormLoading(true);
    setError(null);
    try {
      console.log('Invio dati:', editingTask);
      let response;
      if (editingTask.id) { // Update existing task
        response = await axiosWithTimeout.put(`${API_URL}/agenda/tasks/${editingTask.id}`, editingTask);
      } else { // Create new task
        response = await axiosWithTimeout.post(`${API_URL}/agenda/tasks`, editingTask);
      }
      console.log('Risposta dal server:', response.data);
      await fetchTasks(); // Refresh the task list
      setShowTaskForm(false);
      setEditingTask(null); // Reset editing state
    } catch (err) {
      console.error('Errore nel salvataggio attività:', err);
      const errMsg = err.response?.data?.error || err.request ? 'Timeout o errore di rete.' : err.message || 'Errore sconosciuto';
      setError(`Errore salvataggio: ${errMsg}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Show the rejection reason modal
  const handleRejectTask = () => {
    setShowRejectionModal(true);
  };

  // Submit the rejection with reason
  const submitRejection = async () => {
    if (!editingTask || !rejectionReason) return;
    setFormLoading(true);
    try {
      const updatedTask = { ...editingTask, status: 'rifiutata', motivazioneRifiuto: rejectionReason };
      // QUI SALVIAMO la motivazione
      await axios.put(`${API_URL}/agenda/tasks/${editingTask.id}`, updatedTask);
      fetchTasks(); // Refresh tasks
      setShowRejectionModal(false);
      setShowTaskForm(false);
      setRejectionReason(""); // Reset reason
    } catch (err) {
      console.error('Errore nel rifiuto attività:', err);
      setError('Impossibile aggiornare lo stato dell\'attività.');
    } finally {
      setFormLoading(false);
    }
  };

  // Accept the task
  const handleAcceptTask = async () => {
    if (!editingTask) return;
    setFormLoading(true);
    try {
      // Quando accetta, rimuove la motivazione rifiuto (se esisteva)
      const updatedTask = { ...editingTask, status: 'accettata', motivazioneRifiuto: null }; 
      await axios.put(`${API_URL}/agenda/tasks/${editingTask.id}`, updatedTask);
      fetchTasks(); // Refresh tasks
      setShowTaskForm(false);
    } catch (err) {
      console.error('Errore nell\'accettazione attività:', err);
      setError('Impossibile aggiornare lo stato dell\'attività.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete task (admin only)
  const handleDeleteTask = async (taskId) => {
    if (!isAdminRole || !window.confirm('Sei sicuro di voler eliminare questa attività?')) return;
    setFormLoading(true);
    try {
      await axios.delete(`${API_URL}/agenda/tasks/${taskId}`);
      fetchTasks(); // Refresh tasks
      setShowTaskForm(false); // Close form if open
      setEditingTask(null);
    } catch (err) {
      console.error('Errore nell\'eliminazione attività:', err);
      setError('Impossibile eliminare l\'attività.');
    } finally {
      setFormLoading(false);
    }
  };

  // Update editingTask state when ClientSidSelector changes client
  const handleClientSelected = (clientName) => {
    setEditingTask(prev => ({ ...prev, nomeCliente: clientName, sid: '' }));
  };

  // Update editingTask state when ClientSidSelector changes SID
  const handleSidSelected = (sid) => {
    setEditingTask(prev => ({ ...prev, sid: sid }));
  };

  // Render the Add/Edit Task Form Modal
  const renderTaskForm = () => {
    if (!showTaskForm || !editingTask) return null;

    const isNew = !editingTask.id;
    const isEffectivelyReadOnly = isClientRole && editingTask.readOnly;
    // Selector is read-only if it's not a new task OR if the client is editing
    const readOnlyForSelector = !isNew || isClientRole;

    return (
      <div className="task-form-overlay">
        <div className="task-form-container">
          <h3>{isNew ? 'Nuova attività' : 'Dettagli attività'}</h3>
          {error && <div className="error-message form-error">{error}</div>}

          <div className="form-group"> {/* Data */}
             <label>Data</label>
             <input type="date" value={editingTask.data || ''}
               onChange={(e) => setEditingTask({...editingTask, data: e.target.value})}
               disabled={!isAdminRole || !isNew} />
          </div>

          {/* Client/SID */}
          {isAdminRole && isNew ? (
            <ClientSidSelector
              onClientSelected={handleClientSelected}
              onSidSelected={handleSidSelected}
              initialClient={editingTask.nomeCliente}
              initialSid={editingTask.sid}
              readOnly={false}
              isVisible={showTaskForm} // Passa isVisible
            />
          ) : (
            <> {/* Mostra Cliente/SID readonly per task esistenti */}
              <div className="form-group">
                <label>Cliente</label>
                <input type="text" value={editingTask.nomeCliente || ''} disabled={true} />
              </div>
              <div className="form-group">
                <label>SID</label>
                <input type="text" value={editingTask.sid || ''} disabled={true} />
              </div>
            </>
          )}

          {/* Ora Inizio/Fine */}
          <div className="form-group">
             <label>Ora Inizio</label>
             <input type="time" value={editingTask.oraInizio || ''}
               onChange={(e) => setEditingTask({...editingTask, oraInizio: e.target.value})}
               disabled={isEffectivelyReadOnly} />
          </div>
          <div className="form-group">
             <label>Ora Fine</label>
             <input type="time" value={editingTask.orarioFine || ''}
               onChange={(e) => setEditingTask({...editingTask, orarioFine: e.target.value})}
               disabled={isEffectivelyReadOnly} />
          </div>

          {/* Altri campi */}
          <div className="form-group"> {/* Email */}
             <label>Email Cliente</label>
             <input type="email" value={editingTask.emailCliente || ''}
               onChange={(e) => setEditingTask({...editingTask, emailCliente: e.target.value})}
               disabled={isEffectivelyReadOnly} />
          </div>
          <div className="form-group"> {/* Descrizione */}
             <label>Descrizione</label>
             <textarea value={editingTask.descrizione || ''}
               onChange={(e) => setEditingTask({...editingTask, descrizione: e.target.value})}
               disabled={isEffectivelyReadOnly} rows="4" />
          </div>

          {/* ========= INIZIO MODIFICA ========= */}
          {/* Mostra la motivazione del rifiuto se presente */}
          {editingTask.status === 'rifiutata' && editingTask.motivazioneRifiuto && (
            <div className="form-group rejection-reason-display">
              <label>Motivazione Rifiuto (inserita dal cliente)</label>
              <textarea
                value={editingTask.motivazioneRifiuto}
                disabled={true} // Sempre sola lettura
                rows="3"
              />
            </div>
          )}
          {/* ========= FINE MODIFICA ========= */}


          {/* Opzione Admin */}
          {isAdminRole && (
            <div className="form-group">
              <label>
                <input type="checkbox" checked={editingTask.canClientEdit || false}
                  onChange={(e) => setEditingTask({...editingTask, canClientEdit: e.target.checked})} />
                Permetti modifica al cliente
              </label>
            </div>
          )}

          {/* Bottoni Azione */}
          <div className="task-form-buttons">
            {/* Client Actions */}
            {isClientRole && editingTask.status === 'proposta' && (
              <>
                <button onClick={handleAcceptTask} className="button-accept">Accetta</button>
                <button onClick={handleRejectTask} className="button-reject">Rifiuta</button>
              </>
            )}
            {/* Save Button (Admin always, Client only if allowed) */}
            {(isAdminRole || (isClientRole && !isEffectivelyReadOnly && editingTask.status !== 'proposta')) && (
                <button onClick={handleSaveTask} className="button-save" disabled={formLoading}>
                    {formLoading ? 'Salvataggio...' : 'Salva'}
                </button>
            )}
            {/* Delete Button (Admin only, for existing tasks) */}
            {isAdminRole && !isNew && (
              <button onClick={() => handleDeleteTask(editingTask.id)} className="button-delete" disabled={formLoading}>
                Elimina
              </button>
            )}
            {/* Close Button */}
            <button onClick={() => { 
              setShowTaskForm(false); 
              setError(null); 
              setEditingTask(null);
            }} disabled={formLoading}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render the Rejection Modal
  const renderRejectionModal = () => {
    if (!showRejectionModal) return null;
    return (
      <div className="task-form-overlay">
        <div className="task-form-container rejection-modal">
          <h3>Rifiuta attività</h3>
          <div className="form-group">
            <label htmlFor="rejectionReason">Motivo del rifiuto:</label>
            <textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows="4"
              required
            />
          </div>
          <div className="task-form-buttons">
            <button onClick={submitRejection} disabled={!rejectionReason || formLoading}>
              {formLoading ? 'Invio...' : 'Conferma rifiuto'}
            </button>
            <button onClick={() => {
              setShowRejectionModal(false);
              setRejectionReason("");
            }} disabled={formLoading}>
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

  // Render the main month grid
  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate); // Includes nulls for padding
    return (
      <div className="calendar">
        <div className="weekdays">
          {daysOfWeek.map(day => <div key={day} className="weekday">{day}</div>)}
        </div>
        <div className="days">
          {days.map((day, index) => {
            if (!day) return <div key={`padding-${index}`} className="day empty"></div>;
            const dayTasks = getTasksForDay(day);
            const isToday = new Date().toDateString() === day.toDateString();
            return (
              <div
                key={day.toISOString()}
                className={`day ${isToday ? 'today' : ''} ${isAdminRole ? 'clickable' : ''}`}
                onClick={() => handleDayClick(day)}
              >
                <div className="day-number">{day.getDate()}</div>
                <div className="day-tasks">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      className={`task-item status-${task.status || 'proposta'}`}
                      onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                      title={`Cliente: ${task.nomeCliente}\nSID: ${task.sid}\nOrario: ${task.oraInizio}-${task.orarioFine}\nDesc: ${task.descrizione}`}
                    >
                      <div className="task-time">{task.oraInizio}-{task.orarioFine}</div>
                      <div className="task-details">
                        <span className="task-client">{task.nomeCliente}</span>
                        {task.sid && <span className="task-sid">({task.sid})</span>}
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

  // Render loading overlay specific to form actions
  const renderFormLoadingOverlay = () => {
    if (!formLoading) return null;
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Operazione in corso...</p>
        </div>
      </div>
    );
  };

  // MAIN RENDER
  return (
    <div className="agenda-container">
      {renderFormLoadingOverlay()}
      <div className="calendar-header">
        <div className="month-navigation">
          <button onClick={handlePrevPeriod} className="nav-button" disabled={loading}>&laquo;</button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={handleNextPeriod} className="nav-button" disabled={loading}>&raquo;</button>
        </div>
      </div>
      {error && !showTaskForm && <div className="error-message">{error}</div>}
      <div className="calendar-body">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Caricamento calendario...</p>
          </div>
        ) : (
          <> {viewMode === 'month' && renderMonthView()} </>
        )}
      </div>
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