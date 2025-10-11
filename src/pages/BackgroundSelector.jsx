import { useState } from 'react';
import PropTypes from 'prop-types';
import './BackgroundSelector.css';

const BackgroundSelector = ({ onBackgroundChange, onClose }) => {
  const [newBg, setNewBg] = useState('');

  const handleSetBackground = () => {
    onBackgroundChange(newBg);
    onClose();
  };

  const handleRemoveBackground = () => {
    onBackgroundChange('');
    setNewBg('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Set Background Image</h3>
        <input
          type="text"
          value={newBg}
          placeholder="Enter image URL"
          onChange={(e) => setNewBg(e.target.value)}
        />
        <div className="modal-actions">
          <button onClick={handleSetBackground}>Set</button>
          <button onClick={handleRemoveBackground}>Remove</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

BackgroundSelector.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BackgroundSelector;
