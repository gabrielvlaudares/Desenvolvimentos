// src/hooks/useAuth.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';

const AuthContext = createContext();

// Helper de decodificação (pode ser movido para utils)
const decodeToken = (token) => {
    if (!token) return null;
    try {
        const decoded = jwtDecode(token);
        // Verifica expiração
        if (decoded.exp * 1000 > Date.now()) {
            return decoded;
        }
    } catch (e) {
        console.error("Erro ao decodificar token:", e);
    }
    localStorage.removeItem('authToken'); // Remove token inválido/expirado
    return null;
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const decodedUser = decodeToken(token); // Usa o helper
    if (decodedUser) {
        setUser(decodedUser);
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    const { token } = response.data;
    localStorage.setItem('authToken', token);
    const decodedUser = decodeToken(token); // Usa o helper
    if (decodedUser) {
        setUser(decodedUser);
    } else {
        throw new Error("Token inválido recebido do servidor."); // Segurança
    }
    // Retorna o usuário decodificado para uso imediato se necessário
    return decodedUser;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('selectedPortaria'); // Limpa portaria selecionada
    setUser(null);
    window.location.href = '/login'; // Força recarregamento para limpar estado
  };

  return (
    // <-- ADICIONAR decodeToken AO VALUE -->
    <AuthContext.Provider value={{ user, login, logout, loading, decodeToken }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};