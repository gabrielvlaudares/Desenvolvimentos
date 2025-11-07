// src/pages/MaquinasPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth'; //
import { Link } from 'react-router-dom';
import api from '../services/api'; //
import NovaSaidaForm from './NovaSaidaForm'; // Assuming this file exists from previous steps
import MaquinaDashboard from './MaquinaDashboard'; // Assuming this file exists from previous steps
// MaquinaAprovacoes já foi removido
// MaquinaPortaria agora está na PortariaPage

// --- Header Simples ---
const Header = () => {
  const { user, logout } = useAuth(); //
  return (
     <header className="flex items-center justify-between p-4 bg-white shadow-md">
      <div className="flex items-center gap-4">
         <Link to="/dashboard" className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300">
            &larr; Voltar
          </Link>
        <h1 className="text-xl font-bold text-blue-800">Saída de Máquinas</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm">Usuário: {user?.nome}</span>
        <button
          onClick={logout} //
          className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
        >
          Sair
        </button>
      </div>
    </header>
  )
};

// --- Componente Principal da Página ---
export default function MaquinasPage() {
  const { user } = useAuth(); //

  // Define a aba inicial baseada nas permissões
  const initialTab = (!user?.isPortaria || user?.isAdmin) ? 'nova-saida' : 'dashboard'; //
  const [activeTab, setActiveTab] = useState(initialTab);

  const [maquinasData, setMaquinasData] = useState([]); // Dados da API
  const [loading, setLoading] = useState(false); // Loading para a lista/dashboard
  const [error, setError] = useState('');

  // Busca dados (só busca se precisar da lista - agora só o dashboard)
  useEffect(() => {
    // Abas que precisam da lista de máquinas
    const needsData = activeTab === 'dashboard'; // Apenas o dashboard precisa da lista aqui

    if (needsData) {
        fetchMaquinas();
    } else {
        // Para 'nova-saida', não carrega a lista
        setLoading(false); setError(''); setMaquinasData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Recarrega se activeTab mudar

  const fetchMaquinas = async () => {
    if (activeTab === 'dashboard'){ setLoading(true); }
    setError('');
    try {
      const response = await api.get('/maquinas'); //
      setMaquinasData(response.data);
    } catch (err) {
      setError('Erro ao carregar dados de máquinas.');
      console.error("Erro fetchMaquinas:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  // Define quais abas estão disponíveis
  const availableTabs = [
    { id: 'dashboard', label: 'Dashboard', allowed: true },
    { id: 'nova-saida', label: 'Nova Saída', allowed: !user?.isPortaria || user?.isAdmin }, //
    // Aba Portaria foi movida para PortariaPage
  ].filter(tab => tab.allowed);


   // Ajusta a aba ativa inicial se a padrão não for permitida
   useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(t => t.id === initialTab)) {
        if (availableTabs.some(t => t.id === 'dashboard')) { setActiveTab('dashboard'); }
        else if (availableTabs.length > 0) { setActiveTab(availableTabs[0].id); }
    }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [availableTabs]); // Re-executa se availableTabs mudar

   // Callback do form
   const handleSaveSuccess = () => { setActiveTab('dashboard'); };

   // Função para renderizar o conteúdo da aba ativa
   const renderTabContent = () => {
        if (loading && (activeTab !== 'nova-saida')) { return <div className="p-4 text-center text-gray-500">Carregando dados...</div>; }
        if (error && (activeTab !== 'nova-saida')) { return <div className="p-4 text-center text-red-600">{error}</div>; }

       switch(activeTab) {
           case 'dashboard':
               // Passa a função refreshData para o Dashboard poder recarregar a lista
               return <MaquinaDashboard data={maquinasData} refreshData={fetchMaquinas} />;
           case 'nova-saida':
               return <NovaSaidaForm onSaveSuccess={handleSaveSuccess} />;
           // Cases 'aprovacoes' e 'portaria' removidos
           default:
               if (availableTabs.length > 0) {
                   return <p className="p-4 text-center text-gray-500">Selecione uma aba.</p>;
               } else {
                   return <p className="p-4 text-center text-orange-600">Você não tem permissão para acessar nenhuma funcionalidade deste módulo.</p>;
               }
       }
   };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      {/* Navegação por Abas (Renderiza apenas as disponíveis) */}
      {availableTabs.length > 0 && (
          <nav className="flex px-4 mt-4 border-b border-gray-300 bg-white shadow-sm">
            {availableTabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`py-2 px-4 text-sm focus:outline-none transition-colors duration-150 ${
                    activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                    : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                 }`}
               >
                 {tab.label}
               </button>
            ))}
          </nav>
      )}
      <main className="p-4">
         {renderTabContent()}
      </main>
    </div>
  );
}

// --- Componentes Placeholder Removidos ---
// Não precisamos mais de placeholders aqui