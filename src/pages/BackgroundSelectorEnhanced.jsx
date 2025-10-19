import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './BackgroundSelectorEnhanced.css';

const RECENT_WALLPAPERS_KEY = 'recentWallpapers';
const RECENT_COLORS_KEY = 'recentColors';
const MAX_RECENT_ITEMS = 5;

const BackgroundSelectorEnhanced = ({ onBackgroundChange, onClose }) => {
  const [newBg, setNewBg] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [recentWallpapers, setRecentWallpapers] = useState([]);
  const [recentColors, setRecentColors] = useState([]);
  const [activeTab, setActiveTab] = useState('image'); // 'image' o 'color'

  // Carica gli sfondi e i colori recenti da localStorage quando il componente viene montato
  useEffect(() => {
    try {
      const storedWallpapers = localStorage.getItem(RECENT_WALLPAPERS_KEY);
      if (storedWallpapers) {
        const parsedWallpapers = JSON.parse(storedWallpapers);
        setRecentWallpapers(parsedWallpapers);
      }

      const storedColors = localStorage.getItem(RECENT_COLORS_KEY);
      if (storedColors) {
        const parsedColors = JSON.parse(storedColors);
        setRecentColors(parsedColors);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli sfondi/colori recenti:', error);
    }
  }, []);

  // Funzione per aggiungere un nuovo sfondo alla cronologia
  const addToRecentWallpapers = (url) => {
    if (!url) return;
    
    // Crea una nuova lista di sfondi recenti
    const updatedWallpapers = [
      url,
      // Filtra gli sfondi esistenti rimuovendo url duplicati e limitando la lunghezza
      ...recentWallpapers.filter(item => item !== url)
    ].slice(0, MAX_RECENT_ITEMS);
    
    // Aggiorna lo stato
    setRecentWallpapers(updatedWallpapers);
    
    // Salva nel localStorage
    try {
      localStorage.setItem(RECENT_WALLPAPERS_KEY, JSON.stringify(updatedWallpapers));
    } catch (error) {
      console.error('Errore nel salvare gli sfondi recenti:', error);
    }
  };

  // Funzione per aggiungere un nuovo colore alla cronologia
  const addToRecentColors = (color) => {
    if (!color) return;
    
    // Crea una nuova lista di colori recenti
    const updatedColors = [
      color,
      // Filtra i colori esistenti rimuovendo duplicati e limitando la lunghezza
      ...recentColors.filter(item => item !== color)
    ].slice(0, MAX_RECENT_ITEMS);
    
    // Aggiorna lo stato
    setRecentColors(updatedColors);
    
    // Salva nel localStorage
    try {
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updatedColors));
    } catch (error) {
      console.error('Errore nel salvare i colori recenti:', error);
    }
  };

  const handleSetBackground = () => {
    if (newBg) {
      onBackgroundChange(newBg);
      addToRecentWallpapers(newBg);
      onClose();
    }
  };

  const handleSetColor = () => {
    let validColor = colorInput;
    
    // Supporta input di colore in vari formati
    if (validColor && !validColor.startsWith('#') && !validColor.startsWith('rgb') && !validColor.startsWith('hsl')) {
      // Presumibilmente è un nome di colore, lo accettiamo così com'è
      // ma potremmo anche convertirlo in un hex se volessimo standardizzare
    }
    
    if (validColor) {
      // Aggiungi il prefisso "color:" per indicare che è un colore
      const colorBg = `color:${validColor}`;
      onBackgroundChange(colorBg);
      addToRecentColors(colorBg);
      onClose();
    }
  };

  const handleSelectRecentWallpaper = (url) => {
    onBackgroundChange(url);
    addToRecentWallpapers(url); // Sposta in cima alla lista
    onClose();
  };

  const handleSelectRecentColor = (color) => {
    // Se il colore non inizia già con 'color:' aggiungi il prefisso
    const formattedColor = color.startsWith('color:') ? color : `color:${color}`;
    onBackgroundChange(formattedColor);
    addToRecentColors(formattedColor); // Sposta in cima alla lista
    onClose();
  };
  

  const handleRemoveBackground = () => {
    onBackgroundChange('');
    setNewBg('');
    setColorInput('');
    onClose();
  };

  // Determina se il colore è scuro per scegliere il testo in contrasto
  const isColorDark = (color) => {
    // Logica semplificata: considera i colori scuri per default
    // In una implementazione più robusta, convertiremmo il colore in RGB e calcoleremo la luminosità
    return true;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content enhanced" onClick={(e) => e.stopPropagation()}>
        <h3>Imposta Sfondo</h3>
        
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`} 
            onClick={() => setActiveTab('image')}
          >
            <i className="fas fa-image"></i> Immagine
          </button>
          <button 
            className={`tab-btn ${activeTab === 'color' ? 'active' : ''}`} 
            onClick={() => setActiveTab('color')}
          >
            <i className="fas fa-palette"></i> Colore
          </button>
        </div>
        
        {activeTab === 'image' ? (
          // Tab Immagine
          <>
            <div className="input-section">
              <input
                type="text"
                value={newBg}
                placeholder="Inserisci URL dell'immagine"
                onChange={(e) => setNewBg(e.target.value)}
              />
              <button className="set-btn" onClick={handleSetBackground}>
                <i className="fas fa-check"></i>
              </button>
            </div>
            
            {recentWallpapers.length > 0 && (
              <div className="recent-items">
                <h4>Sfondi Recenti</h4>
                <div className="item-list wallpaper-list">
                  {recentWallpapers.map((url, index) => (
                    <div key={index} className="item-thumbnail wallpaper-item">
                      <div 
                        className="thumbnail" 
                        style={{ backgroundImage: `url(${url})` }}
                        onClick={() => handleSelectRecentWallpaper(url)}
                        title={url}
                      >
                        <div className="thumbnail-overlay">
                          <i className="fas fa-check"></i>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          // Tab Colore
          <>
            <div className="input-section">
              <input
                type="text"
                value={colorInput}
                placeholder="Inserisci colore (es. #FF5733, blue, rgb(255,0,0))"
                onChange={(e) => setColorInput(e.target.value)}
              />
              {colorInput && (
                <div 
                  className="color-preview" 
                  style={{ backgroundColor: colorInput }}
                ></div>
              )}
              <button className="set-btn" onClick={handleSetColor}>
                <i className="fas fa-check"></i>
              </button>
            </div>
            
            {recentColors.length > 0 && (
              <div className="recent-items">
                <h4>Colori Recenti</h4>
                <div className="item-list color-list">
                  {recentColors.map((color, index) => (
                    <div key={index} className="item-thumbnail color-item">
                      <div 
                        className="thumbnail color-thumbnail" 
                        style={{ backgroundColor: color }}
                        onClick={() => handleSelectRecentColor(color)}
                        title={color}
                      >
                        <div className="thumbnail-overlay">
                          <i className="fas fa-check"></i>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="modal-actions">
          <button className="remove-btn" onClick={handleRemoveBackground}>
            <i className="fas fa-trash-alt"></i> Rimuovi Sfondo
          </button>
          <button onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>
  );
};

BackgroundSelectorEnhanced.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BackgroundSelectorEnhanced;