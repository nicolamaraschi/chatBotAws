import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { API_URL } from '../config';
import './AgendaView.css'; // This will be created next

const AgendaView = ({ userRole, userClientName, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // Task being edited or new task

  const isClientRole = userRole === 'cliente';
  const isAdminRole = userRole === 'admin';

  useEffect(() => {
    fetchTasks();
  }, [currentDate, userRole, userClientName]); // Re-fetch when month changes or user context changes

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      let url = `${API_URL}/api/agenda/tasks?yearMonth=${yearMonth}`;

      if (isClientRole && userClientName) {
        url += `&nomeCliente=${userClientName}`;
      } else if (isAdminRole && !isClientRole) {
        // Admin can see all, no additional client filter needed unless specified
        // If admin wants to filter by client, they can use a separate filter UI (to be implemented)
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
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();

    const days = [];
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 for Sunday, 1 for Monday
  const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Adjust to start from Monday (0 for Monday)

  const getTasksForDay = (day) => {
    const dayString = day.toISOString().split('T')[0];
    return tasks.filter(task => task.data === dayString);
  };

  const handleDayClick = (day) => {
    if (isAdminRole) {
      // Admin can add new task for this day
      setEditingTask({ data: day.toISOString().split('T')[0], nomeCliente: '', sid: '', oraInizio: '', orarioFine: '', emailCliente: '', descrizione: '', canClientEdit: false });
      setShowTaskForm(true);
    }
  };

  const handleEditTask = (task) => {
    if (isAdminRole || (isClientRole && task.canClientEdit && task.nomeCliente === userClientName)) {
      setEditingTask(task);
      setShowTaskForm(true);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa attività?')) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/api/agenda/tasks/${taskId}`);
      fetchTasks(); // Re-fetch tasks after deletion
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
        // Update existing task
        await axios.put(`${API_URL}/api/agenda/tasks/${taskData.id}`, taskData);
      } else {
        // Create new task
        await axios.post(`${API_URL}/api/agenda/tasks`, taskData);
      }
      setShowTaskForm(false);
      setEditingTask(null);
      fetchTasks(); // Re-fetch tasks after save
    } catch (err) {
      console.error('Errore nel salvataggio attività:', err);
      setError('Impossibile salvare l\'attività.');
    }
    finally {
      setLoading(false);
    }
  };

  const TaskForm = ({ task, onSave, onCancel, userRole, userClientName }) => {
    const [formData, setFormData] = useState(task || {});

    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <div className="task-form-overlay">
        <div className="task-form-content">
          <h3>{formData.id ? 'Modifica Attività' : 'Nuova Attività'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Cliente:</label>
              <input type="text" name="nomeCliente" value={formData.nomeCliente} onChange={handleChange} required disabled={userRole === 'cliente' && formData.nomeCliente !== userClientName} />
            </div>
            <div className="form-group">
              <label>SID:</label>
              <input type="text" name="sid" value={formData.sid} onChange={handleChange} required disabled={userRole === 'cliente' && formData.nomeCliente !== userClientName} />
            </div>
            <div className="form-group">
              <label>Data:</label>
              <input type="date" name="data" value={formData.data} onChange={handleChange} required disabled={userRole === 'cliente' && formData.nomeCliente !== userClientName} />
            </div>
            <div className="form-group">
              <label>Ora Inizio:</label>
              <input type="time" name="oraInizio" value={formData.oraInizio} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Ora Fine:</label>
              <input type="time" name="orarioFine" value={formData.orarioFine} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email Cliente:</label>
              <input type="email" name="emailCliente" value={formData.emailCliente} onChange={handleChange} disabled={userRole === 'cliente' && formData.nomeCliente !== userClientName} />
            </div>
            <div className="form-group">
              <label>Descrizione:</label>
              <textarea name="descrizione" value={formData.descrizione} onChange={handleChange}></textarea>
            </div>
            {isAdminRole && (
              <div className="form-group checkbox-group">
                <input type="checkbox" name="canClientEdit" checked={formData.canClientEdit} onChange={handleChange} id="canClientEdit" />
                <label htmlFor="canClientEdit">Il cliente può modificare</label>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary">Salva</button>
              <button type="button" onClick={onCancel} className="btn-secondary">Annulla</button>
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
                  className={`task-item ${task.nomeCliente === userClientName ? 'my-task' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                >
                  <strong>{task.nomeCliente} - {task.sid}</strong>
                  <p>{task.oraInizio}-{task.orarioFine}</p>
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
