// src/pages/AdImportModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, List, Loader2, X } from 'lucide-react'; // Importa ícones

/**
 * Componente Modal de Importação de Usuários
 * * CORREÇÕES DE RESPONSIVIDADE (Conforme solicitação):
 * - Removido botão "Buscar Todos (Ativos)".
 * - Reestruturado com Header/Footer fixos e conteúdo central rolável para impedir que os botões do footer sejam cortados.
 * - Credenciais de admin agora lado a lado para economizar espaço vertical.
 * - Grupos agora na horizontal.
 */
export default function AdImportModal({ availableGroups, onClose, onImportSuccess }) {
  // Credenciais do Admin (para fazer a busca)
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  
  const [error, setError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Efeito para pré-selecionar o grupo "Usuário"
  useEffect(() => {
      const defaultGroup = availableGroups.find(g => 
          g.nome.toLowerCase() === 'usuário' || g.nome.toLowerCase() === 'usuario'
      );
      
      if (defaultGroup) {
          setSelectedGroupIds([defaultGroup.id]);
      }
  }, [availableGroups]); 

  // Limpa erros e mensagens
  const clearMessages = () => {
    setError('');
    setImportMessage('');
  };

  // Função para buscar por termo
  const handleSearch = async () => {
    if (searchTerm.length < 3) {
      setError('Termo de busca: Pelo menos 3 caracteres.');
      return;
    }
     if (!adminUsername || !adminPassword) {
      setError('Credenciais do Admin AD: Usuário e senha são obrigatórios para buscar.');
      return;
    }
    clearMessages();
    setLoadingSearch(true);
    setSearchResults([]);
    setSelectedUsers({});
    setIsAllSelected(false);
    
    try {
      const res = await api.post(`/admin/ldap/search`, {
          searchTerm,
          adminUsername,
          adminPassword
      });
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setError('Nenhum usuário encontrado no AD com este termo/credenciais.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao buscar no AD.');
    } finally {
      setLoadingSearch(false);
    }
  };

  // --- REMOVIDA: Função handleSearchAll ---

  // Handle para Seleção de Usuário Único
   const handleUserSelection = (user) => {
       setSelectedUsers(prev => {
        const newSelection = { ...prev };
        if (newSelection[user.username]) {
          delete newSelection[user.username];
        } else {
          newSelection[user.username] = user;
        }
        
        if (Object.keys(newSelection).length < searchResults.length) {
            setIsAllSelected(false);
        } else if (searchResults.length > 0) {
            setIsAllSelected(true);
        }
        
        return newSelection;
      });
   };
   
   // Handle para "Selecionar Todos"
   const handleSelectAllChange = (checked) => {
       setIsAllSelected(checked);
       if (checked) {
           const allSelected = searchResults.reduce((acc, user) => {
               acc[user.username] = user;
               return acc;
           }, {});
           setSelectedUsers(allSelected);
       } else {
           setSelectedUsers({});
       }
   };

   // Handle seleção de grupo
   const handleGroupChange = (e) => {
       const groupId = parseInt(e.target.value);
    const checked = e.target.checked;
    setSelectedGroupIds(prev => {
      if (checked) {
        return [...prev, groupId];
      } else {
        return prev.filter(id => id !== groupId);
      }
    });
   };
   
   // Handle da Importação
   const handleImport = async () => {
      const usersToImport = Object.values(selectedUsers);
    if (usersToImport.length === 0) {
      setError('Selecione pelo menos um usuário para importar.');
      return;
    }
    if (selectedGroupIds.length === 0) {
      setError('Selecione pelo menos um grupo de permissão.');
      return;
    }

    clearMessages();
    setLoadingImport(true);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const user of usersToImport) {
      const userData = {
        username: user.username,
        nome: user.nome,
        email: user.email || null,
        departamento: user.departamento || null,
        managerName: user.managerName || null,
        password: null,
        ativo: true,
        groupIds: selectedGroupIds,
      };
      
      try {
        await api.post('/admin/users', userData);
        successCount++;
      } catch (err) {
        failCount++;
        if (err.response?.data?.message?.includes('usuário já está em uso')) {
           errors.push(`${user.username}: Já existe.`);
        } else {
           errors.push(`${user.username}: ${err.response?.data?.message || 'Erro'}`);
        }
      }
    }

    setLoadingImport(false);
    setSelectedUsers({});
    setIsAllSelected(false);
    setImportMessage(`Concluído: ${successCount} sucesso(s), ${failCount} falha(s).`);
    if (errors.length > 0) {
       setError(`Falhas:\n- ${errors.join('\n- ')}`);
    } else {
        setError('');
    }
    onImportSuccess(); 
   };

  return (
    // --- MODAL ATUALIZADO ---
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      {/* - max-w-3xl (em vez de 4xl) para caber melhor na tela.
        - max-h-[90vh] e flex flex-col para scroll interno.
        - overflow-hidden no container principal.
      */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header Fixo */}
        <div className="flex-shrink-0 p-6 pb-4 border-b">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Importar Usuários (LDAP)</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* --- Wrapper de Conteúdo Rolável --- */}
        <div className="flex-grow overflow-y-auto p-6 space-y-4 min-h-0">
        
            {/* Seção de Credenciais (sempre grid-cols-2) */}
            <div className="grid grid-cols-2 gap-4 p-3 border rounded bg-gray-50">
               <div>
                  <label className="block text-sm font-medium text-gray-700">Seu Usuário AD</label>
                  <input type="text" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Ex: seu.usuario.admin" className="w-full mt-1 border border-gray-300 rounded-md p-2" autoComplete="username" />
               </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sua Senha AD</label>
                  <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Senha da sua conta AD" className="w-full mt-1 border border-gray-300 rounded-md p-2" autoComplete="current-password" />
               </div>
                <p className="col-span-2 text-xs text-gray-500">
                    Suas credenciais serão usadas apenas para esta busca e não serão salvas.
                </p>
            </div>

            {/* --- ATUALIZADO: Seção de Busca (flex-wrap) --- */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou username (mín. 3 caracteres)..."
                className="w-full sm:flex-grow border border-gray-300 rounded-md p-2 min-w-[150px]"
              />
              <button
                onClick={handleSearch}
                disabled={loadingSearch || searchTerm.length < 3 || !adminUsername || !adminPassword}
                // Botão ocupa 100% no mobile (w-full) e auto no desktop (sm:w-auto)
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loadingSearch ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                <span className="ml-2">Buscar</span>
              </button>
              
              {/* --- BOTÃO "BUSCAR TODOS" REMOVIDO --- */}
            </div>

            {/* Seção de Resultados (Altura mínima aumentada) */}
            <div className="border rounded-md p-2 min-h-[200px] overflow-y-auto">
               <div className="flex justify-between items-center mb-2 p-1 sticky top-0 bg-white border-b">
                 <h3 className="text-md font-medium text-gray-700">Resultados da Busca ({searchResults.length}):</h3>
                 {searchResults.length > 0 && (
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={(e) => handleSelectAllChange(e.target.checked)}
                            disabled={loadingSearch}
                        />
                        Selecionar Todos
                    </label>
                 )}
               </div>
               
              {loadingSearch && <div className="flex justify-center items-center h-full pt-10"><Loader2 size={32} className="animate-spin text-gray-400" /></div>}
              {!loadingSearch && searchResults.length === 0 && !error && <p className="text-sm text-gray-500 text-center py-4">Nenhum resultado para exibir. Faça uma busca.</p>}
              
              {/* Lista de resultados */}
              {!loadingSearch && searchResults.map(user => (
                <div 
                  key={user.username} 
                  className="flex items-start gap-3 p-2 border-b hover:bg-gray-50 cursor-pointer" 
                  onClick={() => handleUserSelection(user)}
                >
                  <input 
                    type="checkbox" 
                    readOnly 
                    checked={!!selectedUsers[user.username]} 
                    className="pointer-events-none mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{user.nome}</span>
                    <span className="text-sm text-gray-600"> ({user.username})</span>
                    {user.email && <span className="text-xs text-gray-500 block truncate">{user.email}</span>}
                    {user.departamento && <span className="text-xs text-blue-700 block font-medium">Depto: {user.departamento}</span>}
                    {user.managerName && <span className="text-xs text-gray-500 block truncate">Gestor AD: {user.managerName}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Seção de Grupos (Horizontal) */}
            <div>
                 <h3 className="text-md font-medium text-gray-700">Assignar aos Grupos de Permissão:</h3>
                 <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 mt-2 border rounded p-3">
                  {availableGroups.length === 0 && <p className="text-sm text-gray-500">Crie grupos na aba 'Grupos'.</p>}
                  {availableGroups.map(group => (
                    <label key={group.id} className="flex items-center gap-2 text-sm">
                      <input 
                        type="checkbox" 
                        value={group.id} 
                        checked={selectedGroupIds.includes(group.id)} 
                        onChange={handleGroupChange}
                      />
                      {group.nome}
                    </label>
                  ))}
                </div>
            </div>
            
        </div>
        {/* --- FIM Wrapper de Conteúdo Rolável --- */}


        {/* Footer Fixo */}
        <div className="flex-shrink-0 p-6 pt-4 border-t bg-gray-50">
             {/* Mensagens de Feedback movidas para o footer */}
             {importMessage && <p className="text-sm text-center text-green-600 mb-2">{importMessage}</p>}
             {error && <p className="text-sm text-center text-red-600 whitespace-pre-line mb-2">{error}</p>}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"> Fechar </button>
              <button onClick={handleImport} disabled={loadingImport || Object.keys(selectedUsers).length === 0 || selectedGroupIds.length === 0} className="px-4 py-2 text-white bg-green-700 rounded-md hover:bg-green-800 disabled:bg-gray-400">
                {loadingImport ? 'Importando...' : `Importar (${Object.keys(selectedUsers).length}) Usuário(s)`}
              </button>
            </div>
        </div>
        
      </div>
    </div>
  );
}