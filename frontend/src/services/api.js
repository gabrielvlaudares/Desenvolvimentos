// src/services/api.js
import axios from 'axios';

// Lê a URL base da API das variáveis de ambiente do Vite
// Em dev (npm run dev), ele usará a URL do .env.development (se existir) ou undefined
// Em prod (npm run build), ele usará a URL do .env.production (/api)
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL, 
});

// Interceptor para adicionar o token JWT em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;