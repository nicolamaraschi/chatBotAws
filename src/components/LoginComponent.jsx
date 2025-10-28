import React, { useEffect } from 'react'; // Aggiunto useEffect
import { Authenticator, useAuthenticator, View, Button, Checkbox } from '@aws-amplify/ui-react';
import PropTypes from 'prop-types';
import '@aws-amplify/ui-react/styles.css';
import './LoginComponent.css'; // Importa il CSS aggiornato (che contiene la sfumatura)

// --- Icone SVG (come definite precedentemente) ---
const EnvelopeIcon = () => (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 2C1 1.44772 1.44772 1 2 1H18C18.5523 1 19 1.44772 19 2V12C19 12.5523 18.5523 13 18 13H2C1.44772 13 1 12.5523 1 12V2Z" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 5L9.5 8.5L16 5" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const LockIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2C7.23858 2 5 4.23858 5 7V10H4V17H16V10H15V7C15 4.23858 12.7614 2 10 2Z" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 10V7C5 4.23858 7.23858 2 10 2C12.7614 2 15 4.23858 15 7V10" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
// --- Fine Icone SVG ---


// --- Componenti customizzati per Authenticator ---
// Definisce come devono apparire le varie parti dell'interfaccia di login standard
const authComponents = {
  // === Personalizzazione Schermata SignIn ===
  SignIn: {
    Header() {
      return (
        <div className="login-header">
          <h2>Bentornato!</h2>
          <p>Accedi al tuo account</p>
        </div>
      );
    },
    FormFields() {
      // Ottiene dati e funzioni da Amplify per gestire il form
      const { fields, handleInputChange, validationErrors, handleSubmit } = useAuthenticator();
      const { authStatus } = useAuthenticator(context => [context.authStatus]);
      const isAuthenticating = authStatus === 'configuring' || authStatus === 'signingIn';
      // Funzioni helper per errori
      const showError = (fieldName) => !!validationErrors[fieldName];
      const errorMessage = (fieldName) => validationErrors[fieldName];

      // Ritorna il JSX del form usando le classi CSS
      return (
        <View as="form" onSubmit={handleSubmit} className="custom-form">
          {/* Campo Email */}
          <div className="custom-field">
            <label className="field-label">E-mail</label>
            <div className="input-wrapper">
              <EnvelopeIcon />
              <input
                type="email" placeholder="Indirizzo email" name="username" // Nome 'username' richiesto da Amplify
                value={fields?.username?.value || ''} onChange={handleInputChange} // Collegato ad Amplify
                className={`input-field ${showError('username') ? 'error' : ''}`} required disabled={isAuthenticating}
              />
            </div>
            {showError('username') && <div className="error-message">{errorMessage('username')}</div>}
          </div>
          {/* Campo Password */}
          <div className="custom-field">
            <label className="field-label">Password</label>
            <div className="input-wrapper">
              <LockIcon />
              <input
                type="password" placeholder="Password" name="password" // Nome 'password' richiesto da Amplify
                value={fields?.password?.value || ''} onChange={handleInputChange} // Collegato ad Amplify
                className={`input-field ${showError('password') ? 'error' : ''}`} required disabled={isAuthenticating}
              />
            </div>
            {showError('password') && <div className="error-message">{errorMessage('password')}</div>}
          </div>
          {/* Bottone Submit */}
          <button type="submit" className="sign-in-button" disabled={isAuthenticating}>
            {isAuthenticating ? 'ACCESSO IN CORSO...' : 'ACCEDI'}
          </button>
        </View>
      );
    },
    Buttons() { return null; }, // Nasconde bottoni extra (es. social login)
    Footer() {
      // Ottiene la funzione per navigare a ForgotPassword
      const { toForgotPassword } = useAuthenticator();
      return (
        <div className="login-footer-links">
          <a className="forgot-password-link" onClick={toForgotPassword}>
            Password dimenticata?
          </a>
        </div>
      );
    }
  }, // Fine SignIn

  // === Personalizzazione Schermata ConfirmSignIn (MFA/OTP) ===
  ConfirmSignIn: {
    Header() { return <div className="confirm-header"><h2>Codice di Verifica</h2><p>Inserisci il codice ricevuto</p></div>; },
    FormFields() {
       const { fields, handleInputChange, validationErrors, handleSubmit } = useAuthenticator();
       const { authStatus } = useAuthenticator(context => [context.authStatus]);
       const isVerifying = authStatus === 'verifying';
       const showError = (fieldName) => !!validationErrors[fieldName];
       const errorMessage = (fieldName) => validationErrors[fieldName];
      return (
        <View as="form" onSubmit={handleSubmit} className="custom-form">
          <div className="custom-field">
            <label className="field-label">Codice <span className="required">*</span></label>
            <div className="input-wrapper no-icon">
              <input type="text" placeholder="Codice a 6 cifre" name="code" maxLength={6}
                value={fields?.code?.value || ''} onChange={handleInputChange}
                className={`input-field ${showError('code') ? 'error' : ''}`} required disabled={isVerifying}
              />
            </div>
            {showError('code') && <div className="error-message">{errorMessage('code')}</div>}
          </div>
          <button type="submit" className="confirm-button" disabled={isVerifying}>
            {isVerifying ? 'VERIFICA...' : 'CONFERMA'}
          </button>
        </View>
      );
    },
    Buttons() { return null; },
    Footer() { const { toSignIn } = useAuthenticator(); return <div className="confirm-footer-links"><a onClick={toSignIn} className="back-link">Torna al login</a></div>; }
  }, // Fine ConfirmSignIn

  // === Personalizzazione Schermata ForgotPassword ===
  ForgotPassword: {
      Header() { return <div className="login-header"><h2>Password Dimenticata</h2><p>Inserisci la tua email</p></div>; },
      FormFields() {
        const { fields, handleInputChange, validationErrors, handleSubmit } = useAuthenticator();
        const { authStatus } = useAuthenticator(context => [context.authStatus]);
        const isSending = authStatus === 'resettingPassword';
        return (
          <View as="form" onSubmit={handleSubmit} className="custom-form">
            <div className="custom-field">
              <label className="field-label">E-mail</label>
              <div className="input-wrapper"> <EnvelopeIcon />
                <input type="email" name="username" placeholder="La tua email registrata"
                  value={fields?.username?.value || ''} onChange={handleInputChange}
                  className={`input-field ${validationErrors.username ? 'error' : ''}`} required disabled={isSending} />
              </div>
              {validationErrors.username && <div className="error-message">{validationErrors.username}</div>}
            </div>
            <button type="submit" className="sign-in-button" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }} disabled={isSending}>
             {isSending ? 'INVIO...' : 'INVIA CODICE'}
            </button>
          </View>
        );
      },
      Buttons() { return null; },
      Footer() { const { toSignIn } = useAuthenticator(); return <div className="confirm-footer-links"><a className="back-link" onClick={toSignIn} style={{ color: '#f59e0b'}}>Torna al login</a></div>; }
  }, // Fine ForgotPassword

  // === Personalizzazione Schermata ConfirmForgotPassword ===
  ConfirmForgotPassword: {
      Header() { return <div className="login-header"><h2>Imposta Nuova Password</h2><p>Inserisci codice e nuova password</p></div>; },
      FormFields() {
        const { fields, handleInputChange, validationErrors, handleSubmit } = useAuthenticator();
        const { authStatus } = useAuthenticator(context => [context.authStatus]);
        const isSubmitting = authStatus === 'submitting';
        return (
          <View as="form" onSubmit={handleSubmit} className="custom-form">
            {/* Campo Codice */}
            <div className="custom-field">
              <label className="field-label">Codice di Verifica</label>
              <div className="input-wrapper no-icon">
                <input type="text" name="code" placeholder="Codice ricevuto"
                 value={fields?.code?.value || ''} onChange={handleInputChange}
                 className={`input-field ${validationErrors.code ? 'error' : ''}`} required disabled={isSubmitting} />
              </div>
              {validationErrors.code && <div className="error-message">{validationErrors.code}</div>}
            </div>
            {/* Campo Nuova Password */}
            <div className="custom-field">
              <label className="field-label">Nuova Password</label>
              <div className="input-wrapper"> <LockIcon />
                <input type="password" name="password" placeholder="Nuova password"
                 value={fields?.password?.value || ''} onChange={handleInputChange}
                 className={`input-field ${validationErrors.password ? 'error' : ''}`} required disabled={isSubmitting} />
              </div>
              {validationErrors.password && <div className="error-message">{validationErrors.password}</div>}
            </div>
            {/* Campo Conferma Password */}
             <div className="custom-field">
                <label className="field-label">Conferma Nuova Password</label>
                <div className="input-wrapper"> <LockIcon />
                    <input type="password" name="confirm_password" placeholder="Conferma nuova password"
                     onChange={handleInputChange} // Collegato
                     className={`input-field ${validationErrors.confirm_password ? 'error' : ''}`} required disabled={isSubmitting} />
                </div>
                {validationErrors.confirm_password && <div className="error-message">{validationErrors.confirm_password}</div>}
            </div>
            <button type="submit" className="confirm-button" disabled={isSubmitting}>
             {isSubmitting ? 'SALVATAGGIO...' : 'IMPOSTA NUOVA PASSWORD'}
            </button>
          </View>
        );
      },
      Buttons() { return null; },
      Footer() { const { toSignIn } = useAuthenticator(); return <div className="confirm-footer-links"><a className="back-link" onClick={toSignIn}>Torna al login</a></div>; }
  } // Fine ConfirmForgotPassword
};
// --- Fine Componenti Custom ---


// --- Componente LoginComponent Principale ---
// Questo componente ora funge da "wrapper" per Authenticator, applicando gli stili e notificando il successo
const LoginComponent = ({ onLoginSuccess }) => {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);

  // useEffect per chiamare onLoginSuccess quando Amplify cambia lo stato in 'authenticated'
  useEffect(() => {
    if (authStatus === 'authenticated') {
      console.log('LoginComponent: authStatus è authenticated. Chiamo onLoginSuccess.');
      // Passa un oggetto minimale. App.jsx recupererà i dettagli utente completi.
      // È importante chiamare onLoginSuccess qui perché Authenticator ha gestito il login.
      onLoginSuccess({ status: 'authenticated' });
    }
  }, [authStatus, onLoginSuccess]);

  // Determina se mostrare uno stato di caricamento generico
  // Controlla gli stati intermedi gestiti da Authenticator
  const isLoading = authStatus === 'configuring' || authStatus === 'loading' || authStatus === 'signingIn' || authStatus === 'verifying' || authStatus === 'resettingPassword' || authStatus === 'submitting';

  return (
    // Contenitore esterno con ID per la specificità CSS
    <div id="custom-login-container" className="app-background">
      <div className="centered-container login-page-container">
        <div className="login-card">
          {/* Sezione sinistra con Authenticator */}
          <div className="login-form-section">
            {/* Authenticator gestisce il flusso UI e logica, usando i TUOI componenti */}
            <Authenticator
              hideSignUp={true} // Nasconde registrazione
              components={authComponents} // Applica la TUA UI
              initialState="signIn" // Parte dal login
            >
              {/* Fallback mostrato solo se Authenticator non gestisce lo stato */}
              {({ signOut, user }) => (
                  <div className="loading-state">
                    {/* Mostra un messaggio di caricamento generico */}
                    Caricamento...
                  </div>
              )}
            </Authenticator>
          </div>

          {/* Sezione destra con grafica (stile e immagine definiti in CSS) */}
          <div className="login-graphic-section">
            
          </div>
        </div>
      </div>
    </div>
  );
};

// PropTypes per validazione
LoginComponent.propTypes = {
  onLoginSuccess: PropTypes.func.isRequired,
};

export default LoginComponent;