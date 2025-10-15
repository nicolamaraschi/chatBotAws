// src/config.js

const isDevelopment = import.meta.env.DEV;

let apiUrl;

if (import.meta.env.VITE_API_URL) {
  apiUrl = import.meta.env.VITE_API_URL;
} else if (isDevelopment) {
  // Dev: URL completo
  apiUrl = 'http://localhost:3001/api';
} else {
  // Produzione: solo /api
  apiUrl = '/api';
}

if (isDevelopment) {
  console.log('🔧 API Configuration:', {
    finalApiUrl: apiUrl,
    mode: import.meta.env.MODE
  });
}

export const API_URL = apiUrl;