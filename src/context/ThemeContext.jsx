import { createContext, useState, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { initializeTheme, persistAndApplyTheme } from '../utils/theme-utils';

// Create Theme Context
const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  // Inizializza il tema usando la funzione di utility
  const [theme, setTheme] = useState(() => {
    return initializeTheme();
  });

  // Toggle between 'light' and 'dark' themes
  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      persistAndApplyTheme(newTheme);
      return newTheme;
    });
  };

  // Apply theme to body when it changes
  useEffect(() => {
    persistAndApplyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ThemeContext;