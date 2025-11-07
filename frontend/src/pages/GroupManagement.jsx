import React, { useEffect, useState } from 'react';
// CORREÇÃO: Tentando novamente o caminho relativo padrão.
import api from '../services/api.js'; // Importa a instância configurada do axios
import { Plus, Edit, Trash, X } from 'lucide-react'; // Ícones

// --- Componente Modal (Permanece o mesmo, com todos os checkboxes) ---
const GroupModal = ({ group, onClose, onSave }) => {
  // Inicializa o estado com dados do grupo ou valores padrão
  const [formData, setFormData] = useState({
    nome: group?.nome || '',
    descricao: group?.descricao || '',
    canAccessAdminPanel: group?.canAccessAdminPanel || false,
    canManageUsers: group?.canManageUsers || false,
    canManageGroups: group?.canManageGroups || false,
    canManageConfig: group?.canManageConfig || false,
    canPerformApprovals: group?.canPerformApprovals || false,
    canAccessPortariaControl: group?.canAccessPortariaControl || false,
    canCreateSaidaMaquina: group?.canCreateSaidaMaquina || false,
    canCreateTransferencia: group?.canCreateTransferencia || false,
    canViewAuditLog: group?.canViewAuditLog || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.nome) {
      setError('O nome do grupo é obrigatório.');
      setLoading(false);
      return;
    }

    try {
      await onSave(group?.id, formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || `Erro ao salvar grupo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!group?.id;

  const permissionFlags = [
    { key: 'canAccessAdminPanel', label: 'Acessar Painel Admin' },
    { key: 'canManageUsers', label: 'Gerenciar Usuários' },
    { key: 'canManageGroups', label: 'Gerenciar Grupos' },
    { key: 'canManageConfig', label: 'Gerenciar Configurações' },
    { key: 'canPerformApprovals', label: 'Realizar Aprovações' },
    { key: 'canAccessPortariaControl', label: 'Acessar Controle Portaria' },
    { key: 'canCreateSaidaMaquina', label: 'Criar Saída Máquina' },
    { key: 'canCreateTransferencia', label: 'Criar Transferência' },
    { key: 'canViewAuditLog', label: 'Visualizar Auditoria' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
           <h3 className="text-xl font-semibold">
            {isEditing ? 'Editar Grupo' : 'Adicionar Novo Grupo'}
           </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow pr-2">
          {/* Nome e Descrição */}
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1"> Nome do Grupo * </label>
            <input type="text" id="groupName" name="nome" value={formData.nome} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="groupDesc" className="block text-sm font-medium text-gray-700 mb-1"> Descrição (Opcional) </label>
            <input type="text" id="groupDesc" name="descricao" value={formData.descricao || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>

          {/* Permissões */}
          <fieldset className="border rounded p-3 pt-1">
             <legend className="text-sm font-medium text-gray-700 px-1">Permissões</legend>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto pr-2">
                 {permissionFlags.map(perm => (
                    <label key={perm.key} className="flex items-center space-x-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        name={perm.key}
                        checked={!!formData[perm.key]}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span>{perm.label}</span>
                    </label>
                 ))}
             </div>
          </fieldset>

          {error && <p className="text-sm text-center text-red-600 bg-red-100 p-2 rounded border border-red-200">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"> Cancelar </button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"> {loading ? 'Salvando...' : 'Salvar'} </button>
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal (Tabela Simplificada) ---
export default function GroupManagement() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/groups');
      setGroups(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao carregar grupos.');
      console.error("Erro fetchGroups:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (group = null) => {
    setCurrentGroup(group);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentGroup(null);
  };

  const handleSaveGroup = async (groupId, data) => {
    if (groupId) {
      await api.put(`/admin/groups/${groupId}`, data);
    } else {
      await api.post('/admin/groups', data);
    }
    fetchGroups();
  };

  const handleDeleteGroup = async (group) => {
    // eslint-disable-next-line no-restricted-globals
    if (confirm(`Tem certeza que deseja excluir o grupo "${group.nome}"? Usuários associados perderão as permissões deste grupo.`)) {
      setError('');
      try {
        await api.delete(`/admin/groups/${group.id}`);
        fetchGroups();
      } catch (err) {
        setError(err.response?.data?.message || `Erro ao excluir grupo: ${err.message}`);
        console.error("Erro deleteGroup:", err.response || err);
      }
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Grupos de Permissão</h2>
          <p className="text-sm text-gray-500">Crie e edite grupos para definir os níveis de acesso.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 transition-colors">
          <Plus size={16} className="mr-1" />
          Novo Grupo
        </button>
      </div>

      {error && <p className="text-sm text-center text-red-600 mb-2">{error}</p>}

      {/* Tabela de Grupos (SIMPLIFICADA) */}
      {loading ? (
        <div className="min-h-[100px] flex items-center justify-center"><p className="text-gray-500 animate-pulse">Carregando...</p></div>
      ) : (
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase text-gray-700">
              <tr>
                {/* Cabeçalhos Simplificados */}
                <th className="p-2 px-3">Nome</th>
                <th className="p-2 px-3">Descrição</th>
                <th className="p-2 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {/* Linha de "Nenhum grupo" ajustada */}
              {!error && groups.length === 0 && (<tr><td colSpan="3" className="p-4 text-center text-gray-500 italic">Nenhum grupo encontrado.</td></tr>)}
              {groups.map((group) => (
                <tr key={group.id} className="border-b hover:bg-gray-50">
                  {/* Células Simplificadas */}
                  <td className="p-2 px-3 font-medium whitespace-nowrap">{group.nome}</td>
                  <td className="p-2 px-3 text-gray-600 truncate max-w-xs">{group.descricao || '-'}</td>
                  {/* Ações */}
                  <td className="p-2 px-3 text-right whitespace-nowrap">
                    <button onClick={() => handleOpenModal(group)} className="text-blue-600 hover:text-blue-900 px-1 py-0.5 rounded hover:bg-blue-100" title="Editar"> <Edit size={16} /> </button>
                    <button onClick={() => handleDeleteGroup(group)} className="text-red-600 hover:text-red-900 px-1 py-0.5 rounded hover:bg-red-100 ml-1" title="Excluir"> <Trash size={16} /> </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <GroupModal
          group={currentGroup}
          onClose={handleCloseModal}
          onSave={handleSaveGroup}
        />
      )}
    </div>
  );
}