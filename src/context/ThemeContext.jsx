import { createContext, useState, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create Theme Context
const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  // Check if theme exists in localStorage, otherwise default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  // Toggle between 'light' and 'dark' themes
  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  };

  // Apply theme to body when it changes
  useEffect(() => {
    document.body.dataset.theme = theme;
    
    // Update root element classes for cloudscape design system
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('awsui-dark-mode');
      root.classList.remove('awsui-light-mode');
    } else {
      root.classList.add('awsui-light-mode');
      root.classList.remove('awsui-dark-mode');
    }
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