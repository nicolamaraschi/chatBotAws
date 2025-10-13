import React from 'react';
import PropTypes from 'prop-types';
import './HealthScoreLegend.css'; // I will create this file as well

const HealthScoreLegend = ({ onClose }) => {
  return (
    <div className="legend-modal-overlay">
      <div className="legend-modal-content">
        <button onClick={onClose} className="legend-modal-close-btn">&times;</button>
        <h2>Spiegazione Metodologia Statistica</h2>
        
        <div className="legend-section">
          <h3>1. Z-Score Normalizzazione</h3>
          <p><code>z = (x - μ) / σ</code></p>
          <ul>
            <li>Misura quante deviazioni standard un valore è dalla media.</li>
            <li>Permette confronto tra metriche con scale diverse.</li>
            <li>Range tipico: -3 a +3.</li>
          </ul>
        </div>

        <div className="legend-section">
          <h3>2. Funzione Sigmoidale</h3>
          <p><code>score = 30 × (1 - 1/(1 + e^(-z)))</code></p>
          <ul>
            <li>Mappa z-score in range 0-30.</li>
            <li>Gestisce valori estremi in modo "smooth".</li>
            <li>Evita che outlier dominino lo score.</li>
          </ul>
        </div>

        <div className="legend-section">
          <h3>3. Coefficiente di Variazione (CV)</h3>
          <p><code>CV = σ / μ</code></p>
          <ul>
            <li>Misura stabilità relativa.</li>
            <li>CV alto = sistema instabile/imprevedibile.</li>
            <li>Normalizzato rispetto alla media.</li>
          </ul>
        </div>

        <div className="legend-section">
          <h3>4. Analisi Trend</h3>
          <p><code>trend% = ((second_half - first_half) / first_half) × 100</code></p>
          <ul>
            <li>Confronta prima e seconda metà del periodo.</li>
            <li>Indica se situazione sta peggiorando/migliorando.</li>
            <li>Peso maggiore se trend negativo.</li>
          </ul>
        </div>

        <div className="legend-section">
          <h3>5. Pesature Componenti</h3>
          <p><strong>Frequency (30 punti):</strong> Quanto spesso ci sono problemi</p>
          <ul>
            <li>Dumps: 35%</li>
            <li>Backups: 45% (più critici)</li>
            <li>Jobs: 20%</li>
          </ul>
          <p><strong>Stability (25 punti):</strong> Quanto prevedibile è il sistema</p>
          <p><strong>Service Health (25 punti):</strong> % tempo servizi OK</p>
          <p><strong>Trend (20 punti):</strong> Direzione futura</p>
        </div>

        <div className="legend-section">
          <h3>Interpretazione Risultati</h3>
          <p><strong>Health Score Range:</strong></p>
          <ul>
            <li>90-100: Eccellente - Sistema molto stabile</li>
            <li>75-89: Buono - Piccoli problemi gestibili</li>
            <li>60-74: Medio - Richiede attenzione</li>
            <li>40-59: Scarso - Problemi significativi</li>
            <li>0-39: ⚫ Critico - Intervento urgente</li>
          </ul>
          <p><strong>Livello di Confidenza:</strong></p>
          <ul>
            <li>Alta (25+ giorni): Score affidabile</li>
            <li>Media (15-24 giorni): Score indicativo</li>
            <li>Bassa (&lt;15 giorni): Dati insufficienti</li>
          </ul>
        </div>

        <div className="legend-section">
            <h3>Vantaggi di questo Approccio</h3>
            <ul>
                <li>✅ Normalizzato: Confronta sistemi con volumi diversi</li>
                <li>✅ Statisticamente robusto: Usa distribuzioni reali, non soglie arbitrarie</li>
                <li>✅ Considera stabilità: Non solo frequenza, ma anche variabilità</li>
                <li>✅ Predittivo: Include trend per anticipare problemi</li>
                <li>✅ Interpretabile: Ogni componente ha significato chiaro</li>
                <li>✅ Resiliente a outlier: Funzioni sigmoidali gestiscono valori estremi</li>
            </ul>
        </div>

      </div>
    </div>
  );
};

HealthScoreLegend.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default HealthScoreLegend;
