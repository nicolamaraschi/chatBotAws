import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ClientSidSelector from './ClientSidSelector';
import './TaskForm.css';

const TaskForm = ({ task, onSave, onCancel, userRole, userClientName, onReject }) => {
  const [formData, setFormData] = useState({
    status: 'proposta',
    ...task
  });
  
  const isReadOnly = formData.readOnly === true;
  const isClientRole = userRole === 'cliente';
  const isAdminRole = userRole === 'admin';
  
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

  const handleClientSelected = (clientName) => {
    setFormData(prev => ({
      ...prev,
      nomeCliente: clientName,
      // Reset del SID quando cambia il cliente
      sid: ''
    }));
  };

  const handleSidSelected = (sid) => {
    setFormData(prev => ({
      ...prev,
      sid: sid
    }));
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
        <form onSubmit={handleSubmit}>
          {/* Per admin, usiamo il selettore di clienti e SID */}
          {isAdminRole ? (
            <ClientSidSelector 
              onClientSelected={handleClientSelected}
              onSidSelected={handleSidSelected}
              initialClient={formData.nomeCliente}
              initialSid={formData.sid}
            />
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

TaskForm.propTypes = {
  task: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  userRole: PropTypes.string.isRequired,
  userClientName: PropTypes.string,
  onReject: PropTypes.func
};

export default TaskForm;
