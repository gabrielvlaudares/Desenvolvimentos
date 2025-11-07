// src/pages/TransferenciasPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth'; //
import { Link } from 'react-router-dom';
import api from '../services/api'; //
import NovaTransferenciaForm from './NovaTransferenciaForm'; // Assumindo que existe
import TransferenciaDashboard from './TransferenciaDashboard'; // Assumindo que existe
// TransferenciaPortaria não é mais importado aqui

// --- Header Simples (sem alteração) ---
const Header = () => { /* ... código existente ... */
    const { user, logout } = useAuth();
    return (
        <header className="flex items-center justify-between p-4 bg-white shadow-md">
            <div className="flex items-center gap-4"> <Link to="/dashboard" className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> &larr; Voltar </Link> <h1 className="text-xl font-bold text-purple-800">Transferência entre Fábricas</h1> </div>
            <div className="flex items-center gap-4"> <span className="text-sm">Usuário: {user?.nome}</span> <button onClick={logout} className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> Sair </button> </div>
            </header>
    );
};

// --- Componente Principal da Página (ATUALIZADO SEM ABA PORTARIA) ---
export default function TransferenciasPage() {
  const { user } = useAuth(); //

  // ============================================
  // <<< ABA 'PORTARIA' REMOVIDA >>>
  // ============================================
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', allowed: true },
    { id: 'nova-transferencia', label: 'Nova Transferência', allowed: !user?.isPortaria || user?.isAdmin },
    // { id: 'portaria', label: 'Controle Portaria', allowed: user?.isPortaria || user?.isAdmin }, // <-- LINHA REMOVIDA
  ];
  const availableTabs = allTabs.filter(tab => tab.allowed);
  // ============================================
  
  const getInitialTab = () => { /* ... */ return availableTabs.some(t => t.id === 'nova-transferencia') ? 'nova-transferencia' : availableTabs[0]?.id || ''; };
  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [transferenciasData, setTransferenciasData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Busca de dados (agora só para dashboard)
  useEffect(() => { /* ... código existente ... */ 
      const needsData = activeTab === 'dashboard'; // <-- MUDOU: SÓ BUSCA PARA DASHBOARD
      if (needsData) { fetchTransferencias(); }
      else { setLoading(false); setError(''); setTransferenciasData([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchTransferencias = async () => { /* ... código existente ... */ 
      if (activeTab === 'dashboard') { setLoading(true); } setError('');
      try { 
        const response = await api.get('/transferencias'); 
        setTransferenciasData(response.data); 
      }
      catch (err) { setError('Erro ao carregar transferências.'); console.error("Erro fetchT:", err.response || err); }
      finally { setLoading(false); }
  };

   // Callback do formulário (sem alteração)
   const handleSaveSuccess = () => { setActiveTab('dashboard'); };

   // Renderiza conteúdo da aba (ATUALIZADO)
   const renderTabContent = () => {
        if (loading && activeTab !== 'nova-transferencia') return <div className="p-4 text-center text-gray-500">A carregar...</div>;
        if (error && activeTab !== 'nova-transferencia') return <div className="p-4 text-center text-red-600">{error}</div>;

       switch(activeTab) {
           case 'dashboard':
               return <TransferenciaDashboard data={transferenciasData} refreshData={fetchTransferencias} />;
           case 'nova-transferencia':
               return <NovaTransferenciaForm onSaveSuccess={handleSaveSuccess} />;
           // CASE 'portaria' REMOVIDO
           default:
               return <p className="p-4 text-center text-gray-500">Selecione uma aba.</p>;
       }
   };
   
    // Header do componente TransferenciasPage (sem alteração de código)
    const Header = () => { /* ... código existente ... */
        const { user, logout } = useAuth();
        return (
            <header className="flex items-center justify-between p-4 bg-white shadow-md">
            <div className="flex items-center gap-4"> <Link to="/dashboard" className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> &larr; Voltar </Link> <h1 className="text-xl font-bold text-purple-800">Transferência entre Fábricas</h1> </div>
            <div className="flex items-center gap-4"> <span className="text-sm">Usuário: {user?.nome}</span> <button onClick={logout} className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> Sair </button> </div>
            </header>
        );
    };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      {/* Navegação por Abas */}
      {availableTabs.length > 0 && ( /* ... JSX da navegação ... */
         <nav className="flex px-4 mt-4 border-b border-gray-300 bg-white shadow-sm">
            {availableTabs.map(tab => ( <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`py-2 px-4 text-sm focus:outline-none transition-colors duration-150 ${ activeTab === tab.id ? 'border-b-2 border-purple-600 text-purple-600 font-semibold' : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300' }`}> {tab.label} </button> ))}
          </nav>
      )}
      <main className="p-4">
         {renderTabContent()}
      </main>
    </div>
  );
}