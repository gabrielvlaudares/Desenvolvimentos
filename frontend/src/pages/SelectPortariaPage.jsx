// src/pages/SelectPortariaPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Navigate } from 'react-router-dom';

// Lista de portarias (pode vir da API no futuro)
const portariasDisponiveis = ['P1', 'P3', 'P4', 'P5', 'P7', 'P8', 'P10', 'PCD'];

export default function SelectPortariaPage() {
  const [selectedPortariaState, setSelectedPortariaState] = useState(''); // Estado local para o select
  const [error, setError] = useState('');
  const auth = useAuth();
  const navigate = useNavigate();

  // Efeito para proteger a página e limpar seleção anterior
  useEffect(() => {
    // Espera a autenticação carregar
    if (auth.loading) {
      return;
    }

    // Se não está logado OU não tem permissão de portaria OU é admin, redireciona
    if (!auth.user || !auth.user.canAccessPortariaControl || auth.user.canAccessAdminPanel) {
      console.log("[Select Portaria Page] Usuário inválido para esta página, redirecionando para dashboard...");
      navigate('/dashboard', { replace: true });
      return; // Interrompe
    }

    // Limpa seleção anterior ao carregar a página (garante que sempre peça)
    console.log("[Select Portaria Page] Limpando sessionStorage 'selectedPortaria'.");
    sessionStorage.removeItem('selectedPortaria');

  }, [auth.loading, auth.user, navigate]); // Depende do estado de auth e navigate


  const handleConfirm = () => {
    if (!selectedPortariaState) {
      setError('Por favor, selecione a portaria onde você está.');
      return;
    }
    setError('');
    // Salva a seleção na sessionStorage
    console.log(`[Select Portaria Page] Salvando portaria '${selectedPortariaState}' na sessionStorage.`);
    sessionStorage.setItem('selectedPortaria', selectedPortariaState);

    // ----> CORRIGIDO: Redireciona para /portaria <----
    console.log("[Select Portaria Page] Redirecionando para /portaria...");
    navigate('/portaria', { replace: true });
  };

   // Se ainda estiver carregando a autenticação, mostra mensagem
   if (auth.loading) {
       return <div className="flex items-center justify-center min-h-screen bg-gray-100"><p>Carregando...</p></div>;
   }

  // Se já foi redirecionado (usuário inválido ou admin), não renderiza nada
  if (!auth.user || !auth.user.canAccessPortariaControl || auth.user.canAccessAdminPanel) {
      return null;
  }

  // Renderiza a seleção
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-center text-gray-900">
          Seleção de Portaria
        </h1>
        <p className="text-sm text-center text-gray-600">
          Olá, {auth.user?.nome}. Por favor, selecione a portaria onde você está trabalhando nesta sessão.
        </p>
        <div>
          <label htmlFor="portaria" className="block text-sm font-medium text-gray-700">
            Portaria Atual *
          </label>
          <select
            id="portaria"
            value={selectedPortariaState}
            onChange={(e) => { setSelectedPortariaState(e.target.value); setError(''); }}
            required
            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">-- Selecione --</option>
            {portariasDisponiveis.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-center text-red-600">{error}</p>
        )}

        <button
          onClick={handleConfirm}
          className="w-full px-4 py-2 font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          disabled={!selectedPortariaState} // Desabilita se nada selecionado
        >
          Confirmar e Acessar Portaria
        </button>
         <button
          onClick={auth.logout} // Botão para sair se chegou aqui por engano
          className="w-full mt-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Sair (Logout)
        </button>
      </div>
    </div>
  );
}
