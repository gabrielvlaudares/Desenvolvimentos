// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Para saber de onde o usuário veio (opcional)

  // Redireciona se já estiver logado
  useEffect(() => {
    // Só executa se a autenticação não estiver carregando e já houver um usuário
    if (!auth.loading && auth.user) {
      handleRedirect(auth.user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]); // Depende do estado de loading e do usuário


  // Função para decidir para onde redirecionar após login ou se já logado
  const handleRedirect = (loggedInUser) => {
    // Verifica se é Portaria (tem permissão) E NÃO é Admin
    if (loggedInUser?.canAccessPortariaControl && !loggedInUser?.canAccessAdminPanel) {
      const selectedPortaria = sessionStorage.getItem('selectedPortaria');
      if (!selectedPortaria) {
        console.log("[Login Page] Usuário Portaria (não Admin) sem portaria selecionada. Redirecionando para /select-portaria");
        navigate('/select-portaria', { replace: true });
      } else {
        // Se JÁ tem portaria selecionada (ex: recarregou a página), vai para portaria direto
        console.log(`[Login Page] Usuário Portaria (não Admin) com portaria ${selectedPortaria} selecionada. Redirecionando para /portaria`);
        navigate('/portaria', { replace: true });
      }
    } else {
      // Para Admin ou outros usuários, vai para o dashboard
      // Poderia verificar location.state?.from para voltar à página anterior, mas dashboard é mais simples
      console.log("[Login Page] Usuário Admin ou outro tipo. Redirecionando para /dashboard");
      navigate('/dashboard', { replace: true });
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Tenta fazer o login. A função login do useAuth JÁ atualiza o 'user' no contexto.
      // O 'loggedInUser' retornado aqui é apenas para a lógica IMEDIATA de redirect.
      const loggedInUser = await auth.login(username, password);

      // 2. Chama a função de redirecionamento com o usuário obtido
      if (loggedInUser) {
          handleRedirect(loggedInUser);
      } else {
          // Caso inesperado onde login() não retorna usuário mas não dá erro
           throw new Error("Falha ao obter dados do usuário após login.");
      }

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro de conexão.');
      console.error("Erro no login:", err);
    } finally {
      setLoading(false);
    }
  };

  // Se auth ainda está carregando, pode mostrar um spinner ou nada
  if (auth.loading) {
      return <div className="flex items-center justify-center min-h-screen bg-gray-100"><p>Carregando...</p></div>;
  }

  // Se já tem usuário (o useEffect cuidará do redirect), não renderiza o form
  if (auth.user) {
      return null;
  }

  // Renderiza o formulário de login
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          SCSE - Acesso Restrito
        </h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700"> Usuário (Rede ou Local) </label>
            <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700"> Senha </label>
            <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
          </div>

          {error && (<p className="text-sm text-center text-red-600 bg-red-100 p-2 rounded">{error}</p>)}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
