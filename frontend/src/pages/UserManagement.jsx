// src/pages/UserManagement.jsx
import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import AdImportModal from './AdImportModal';
// --- Ícones Atualizados ---
import { Plus, Edit, X, RefreshCw, Loader2, FilterX, ToggleLeft, ToggleRight, CheckSquare, Square, ShieldOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// --- Componente Modal (Inalterado) ---
const UserModal = ({ user, groups, managers, onClose, onSave }) => {
    // (O código completo do UserModal está aqui, sem alterações)
    const [formData, setFormData] = useState({
        id: user?.id || null,
        username: user?.username || '',
        nome: user?.nome || '',
        email: user?.email || '',
        departamento: user?.departamento || '',
        password: '', 
        ativo: user ? user.ativo : true,
        groupIds: user?.grupos?.map(gLink => gLink.grupo.id) || [],
        gestorId: user?.gestor?.id || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        setError('');
    };

    const handleGroupChange = (e) => {
        const groupId = parseInt(e.target.value);
        const checked = e.target.checked;
        setFormData(prev => ({
            ...prev,
            groupIds: checked
                ? [...prev.groupIds, groupId]
                : prev.groupIds.filter(id => id !== groupId)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!formData.username || !formData.nome) {
            setError('Nome de usuário e Nome são obrigatórios.');
            setLoading(false);
            return;
        }
        if (!formData.id && !formData.password && !formData.username.includes('@')) {
            setError('Senha é obrigatória para criar novo usuário local.');
            setLoading(false);
            return;
        }

        const dataToSend = { ...formData };
        if (!dataToSend.password) {
            delete dataToSend.password;
        }
        if (dataToSend.gestorId === '' || dataToSend.gestorId === 0) {
            dataToSend.gestorId = null;
        }
        if (dataToSend.departamento === '') {
            dataToSend.departamento = null;
        }

        try {
            await onSave(dataToSend); 
            onClose(); 
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao salvar usuário.');
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!formData.id;

    const availableManagers = useMemo(() => {
        if (!managers) return [];
        if (isEditing) {
            return managers.filter(m => m.id !== user.id);
        }
        return managers;
    }, [managers, isEditing, user]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
                 <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h2 className="text-xl font-semibold">{isEditing ? 'Editar Usuário' : 'Criar Novo Usuário'}</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-grow pr-2">
                    {/* (Campos do formulário - inalterados) */}
                    <div><label className="block text-sm font-medium text-gray-700">Username *</label><input type="text" name="username" value={formData.username} onChange={handleChange} required className="w-full mt-1 border border-gray-300 rounded-md p-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">Nome Completo *</label><input type="text" name="nome" value={formData.nome} onChange={handleChange} required className="w-full mt-1 border border-gray-300 rounded-md p-2" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">E-mail</label><input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full mt-1 border border-gray-300 rounded-md p-2" /></div>
                    <div>
                        <label htmlFor="departamento" className="block text-sm font-medium text-gray-700">Departamento (Opcional)</label>
                        <input type="text" id="departamento" name="departamento" value={formData.departamento || ''} onChange={handleChange} placeholder="Ex: TI, Manutenção, Produção" className="w-full mt-1 border border-gray-300 rounded-md p-2" />
                    </div>
                    <div>
                        <label htmlFor="gestorId" className="block text-sm font-medium text-gray-700">Gestor Imediato (Opcional)</label>
                        <select id="gestorId" name="gestorId" value={formData.gestorId || ''} onChange={handleChange} className="w-full mt-1 border border-gray-300 rounded-md p-2 bg-white">
                            <option value="">Nenhum</option>
                            {availableManagers.map(manager => (
                                <option key={manager.id} value={manager.id}>
                                    {manager.nome} ({manager.username})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700">Senha {isEditing ? '(Deixe em branco para não alterar)' : '*'}</label><input type="password" name="password" value={formData.password} onChange={handleChange} required={!isEditing && !formData.username.includes('@')} placeholder={isEditing ? 'Nova Senha (Opcional)' : ''} className="w-full mt-1 border border-gray-300 rounded-md p-2" /></div>
                    <div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} /> Ativo</label></div>
                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grupos de Permissão</label>
                        <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                            {groups.map(group => (
                                <label key={group.id} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" value={group.id} checked={formData.groupIds.includes(group.id)} onChange={handleGroupChange}/>
                                    {group.nome}
                                </label>
                            ))}
                        </div>
                    </div>
                    {error && <p className="text-sm text-center text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-200">{error}</p>}
                </form>

                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-gray-400">{loading ? 'Salvando...' : 'Salvar'}</button>
                </div>
            </div>
        </div>
    );
};


// --- Componente Principal (ATUALIZADO) ---
export default function UserManagement() {
    const { user: currentUser } = useAuth(); // Pega o usuário logado
    const [users, setUsers] = useState([]); // Lista original da API
    const [groups, setGroups] = useState([]); 
    const [managers, setManagers] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ type: '', message: '' });
    
    const [togglingUserId, setTogglingUserId] = useState(null);

    // --- NOVOS ESTADOS PARA SELEÇÃO MÚLTIPLA ---
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    // --- FIM NOVOS ESTADOS ---

    const [departamentos, setDepartamentos] = useState([]); 
    const [filters, setFilters] = useState({
        searchTerm: '',
        grupoId: '',
        departamento: '',
        status: 'ativos',
        tipoUsuario: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        // Não reseta o loading principal se for uma ação em massa ou toggle
        if (!isSyncing && !togglingUserId && !isBulkUpdating) {
            setLoading(true);
        }
        setError('');
        
        try {
            const [usersRes, groupsRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/groups')
            ]);
            
            const allUsers = usersRes.data;
            const allGroups = groupsRes.data;

            setUsers(allUsers);
            setGroups(allGroups);

            const potentialManagers = allUsers.filter(u =>
                u.ativo && 
                u.grupos.some(gLink => gLink.grupo.canPerformApprovals)
            );
            setManagers(potentialManagers);

            const depts = [...new Set(allUsers.map(u => u.departamento).filter(Boolean))].sort();
            setDepartamentos(depts);

        } catch (err) {
            setError('Erro ao carregar dados.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    
    // ATUALIZADO: Limpa seleção ao mudar filtros
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
        setSelectedUserIds(new Set()); // Limpa seleção
    };

    // Lógica de filtragem (inalterada)
    const filteredUsers = useMemo(() => {
        const term = filters.searchTerm.toLowerCase();
        const status = filters.status;
        const grupoId = parseInt(filters.grupoId, 10);
        const depto = filters.departamento;
        const tipo = filters.tipoUsuario;

        return users.filter(user => {
            if (status === 'ativos' && !user.ativo) return false;
            if (status === 'inativos' && user.ativo) return false;
            if (term && 
                !user.nome.toLowerCase().includes(term) &&
                !user.username.toLowerCase().includes(term) &&
                !(user.email && user.email.toLowerCase().includes(term))
            ) {
                return false;
            }
            if (grupoId && !user.grupos.some(gLink => gLink.grupo.id === grupoId)) {
                return false;
            }
            if (depto && user.departamento !== depto) {
                return false;
            }
            if (tipo === 'ad' && user.passwordHash) return false; 
            if (tipo === 'local' && !user.passwordHash) return false;
            return true;
        });
    }, [users, filters]);
    
    // ATUALIZADO: Limpa seleção ao limpar filtros
    const clearFilters = () => {
        setFilters({
            searchTerm: '',
            grupoId: '',
            departamento: '',
            status: 'ativos',
            tipoUsuario: '',
        });
        setSelectedUserIds(new Set()); // Limpa seleção
    };

    // (Funções de Modal e Save permanecem iguais)
    const handleOpenCreateUser = () => { setSelectedUser(null); setIsUserModalOpen(true); };
    const handleOpenEditUser = (user) => { setSelectedUser(user); setIsUserModalOpen(true); };
    const handleCloseUserModal = () => { setIsUserModalOpen(false); setSelectedUser(null); };
    const handleOpenImportModal = () => { setIsImportModalOpen(true); };
    const handleCloseImportModal = () => { setIsImportModalOpen(false); };

    const handleSaveUser = async (userData) => {
        const { id, ...data } = userData;
        if (id) {
            await api.put(`/admin/users/${id}`, data);
        } else {
            await api.post('/admin/users', data);
        }
        fetchData(); 
    };
    
    // Handler para Ativar/Desativar Usuário (Individual)
    const handleToggleUserStatus = async (user) => {
        if (user.username === 'admin') {
            setError("Não é permitido desativar o usuário 'admin'.");
            return;
        }
        if (user.id === currentUser.id) {
            setError("Não é possível desativar a si mesmo.");
            return;
        }
        const newStatus = !user.ativo;
        const actionText = newStatus ? "ativar" : "desativar";
        if (!window.confirm(`Tem certeza que deseja ${actionText} o usuário "${user.nome}"?`)) {
            return;
        }
        setTogglingUserId(user.id);
        setError('');
        setSyncStatus({ type: '', message: '' });
        try {
            const { passwordHash, ...userPayload } = user;
            const dataToSend = {
                ...userPayload,
                ativo: newStatus,
                groupIds: user.grupos.map(gLink => gLink.grupo.id),
                gestorId: user.gestor?.id || null,
            };
            delete dataToSend.gestor; 
            delete dataToSend.grupos;

            await api.put(`/admin/users/${user.id}`, dataToSend);
            fetchData(); 
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao atualizar status do usuário.');
        } finally {
            setTogglingUserId(null);
        }
    };
    
    // (Função de Sync permanece igual)
    const handleManualSync = async () => {
        if (isSyncing || !!togglingUserId || isBulkUpdating) return;
        
        const confirmed = window.confirm(
            "Deseja iniciar a sincronização manual com o AD?\n\n" +
            "Isso irá verificar TODOS os usuários importados (sem senha local) e atualizar:\n" +
            "- Nome\n" +
            "- E-mail\n" +
            "- Departamento\n" +
            "- Gestor (se o gestor do AD for encontrado no banco local)\n" +
            "- Status (desativará usuários não encontrados no AD)\n\n" +
            "Isso pode demorar alguns segundos."
        );
        if (!confirmed) return;

        setIsSyncing(true);
        setSyncStatus({ type: 'info', message: 'Sincronizando...' });
        setError('');
        try {
            const res = await api.post('/admin/ldap/sync');
            setSyncStatus({ type: 'success', message: res.data.message });
            fetchData(); 
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Falha na sincronização.';
            setSyncStatus({ type: 'error', message: errorMsg });
            console.error(err);
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus({ type: '', message: '' }), 10000);
        }
    };

    // --- NOVAS FUNÇÕES PARA SELEÇÃO MÚLTIPLA ---
    
    // Lida com o clique no checkbox de um usuário
    const handleSelectUser = (userId) => {
        setSelectedUserIds(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(userId)) {
                newSelection.delete(userId);
            } else {
                newSelection.add(userId);
            }
            return newSelection;
        });
    };

    // Lida com o clique no checkbox "Selecionar Todos"
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            // Seleciona todos os usuários *visíveis (filtrados)*
            // Filtra 'admin' e 'self' para não serem selecionáveis
            const safeFilteredIds = filteredUsers
                .filter(u => u.username !== 'admin' && u.id !== currentUser.id)
                .map(u => u.id);
            setSelectedUserIds(new Set(safeFilteredIds));
        } else {
            // Limpa todos
            setSelectedUserIds(new Set());
        }
    };
    
    // Ação de Desativar em Massa
    const handleBulkDisable = async () => {
        if (isBulkUpdating || isSyncing) return;
        
        const count = selectedUserIds.size;
        if (!window.confirm(`Tem certeza que deseja DESATIVAR ${count} usuário(s) selecionado(s)?`)) {
            return;
        }

        setIsBulkUpdating(true);
        setSyncStatus({ type: 'info', message: `Desativando ${count} usuários...` });
        setError('');

        try {
            const payload = {
                userIds: Array.from(selectedUserIds),
                ativo: false, // Ação específica de desativar
            };
            const res = await api.post('/admin/users/bulk-status', payload);
            setSyncStatus({ type: 'success', message: res.data.message });
            setSelectedUserIds(new Set()); // Limpa a seleção
            fetchData(); // Recarrega
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Falha na ação em massa.';
            setSyncStatus({ type: 'error', message: errorMsg });
            console.error(err);
        } finally {
            setIsBulkUpdating(false);
            setTimeout(() => setSyncStatus({ type: '', message: '' }), 10000);
        }
    };

    // --- FIM NOVAS FUNÇÕES ---
    
    const displayUserGroups = (userGroups) => {
        if (!userGroups || userGroups.length === 0) return '-';
        return userGroups.map(gLink => gLink.grupo.nome).join(', ');
    };

    const inputStyle = "w-full border border-gray-300 rounded-md p-1.5 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white";

    // --- Variáveis para o checkbox "Selecionar Todos" ---
    const totalVisivel = filteredUsers.length;
    const totalSelecionado = selectedUserIds.size;
    const totalVisivelSelecionavel = filteredUsers.filter(u => u.username !== 'admin' && u.id !== currentUser.id).length;
    
    const isAllChecked = totalSelecionado > 0 && totalSelecionado === totalVisivelSelecionavel;
    const isIndeterminate = totalSelecionado > 0 && totalSelecionado < totalVisivelSelecionavel;


    return (
        <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
            {/* Header com botões */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                 <div>
                    <h2 className="text-lg font-semibold text-gray-800">Gerenciar Usuários</h2>
                    <p className="text-sm text-gray-500">Adicione, edite ou remova usuários locais e importe do AD.</p>
                 </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={handleManualSync} 
                        disabled={isSyncing || !!togglingUserId || isBulkUpdating}
                        className="flex items-center justify-center px-3 py-1 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-wait"
                        title="Sincronizar usuários importados com o AD"
                    >
                      {isSyncing ? ( <Loader2 size={16} className="mr-1 animate-spin" /> ) : ( <RefreshCw size={16} className="mr-1" /> )}
                      Sincronizar AD
                    </button>
                    <button onClick={handleOpenImportModal} className="px-3 py-1 text-sm text-white bg-purple-600 rounded hover:bg-purple-700">
                      Importar do AD
                    </button>
                    <button onClick={handleOpenCreateUser} className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700">
                      <Plus size={16} className="mr-1 inline-block" />
                      Novo Usuário Local
                    </button>
                </div>
            </div>
            
            {/* Painel de Filtros */}
            <fieldset className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4 p-4 border rounded-md bg-gray-50 items-end">
                <legend className="text-md font-semibold text-gray-700 px-2 -mb-3">Filtros</legend>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600">Buscar (Nome, Usuário, E-mail)</label>
                    <input type="text" name="searchTerm" value={filters.searchTerm} onChange={handleFilterChange} placeholder="Digite para buscar..." className={inputStyle} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Departamento</label>
                    <select name="departamento" value={filters.departamento} onChange={handleFilterChange} className={inputStyle}>
                        <option value="">Todos</option>
                        {departamentos.map(dept => ( <option key={dept} value={dept}>{dept}</option> ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Grupo</label>
                    <select name="grupoId" value={filters.grupoId} onChange={handleFilterChange} className={inputStyle}>
                        <option value="">Todos</option>
                        {groups.map(g => ( <option key={g.id} value={g.id}>{g.nome}</option> ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Tipo de Usuário</label>
                    <select name="tipoUsuario" value={filters.tipoUsuario} onChange={handleFilterChange} className={inputStyle}>
                        <option value="">Todos</option>
                        <option value="local">Locais</option>
                        <option value="ad">Importados (AD)</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Status</label>
                        <select name="status" value={filters.status} onChange={handleFilterChange} className={inputStyle}>
                            <option value="ativos">Ativos</option>
                            <option value="inativos">Inativos</option>
                            <option value="todos">Todos</option>
                        </select>
                    </div>
                    <button onClick={clearFilters} className="flex items-center justify-center px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300" title="Limpar filtros">
                        Limpar
                    </button>
                </div>
            </fieldset>

            {/* --- NOVA: Barra de Ação em Massa --- */}
            <div className={`transition-all duration-300 overflow-hidden ${totalSelecionado > 0 ? 'max-h-20 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">
                        {totalSelecionado} usuário(s) selecionado(s)
                    </span>
                    <button
                        onClick={handleBulkDisable}
                        disabled={isBulkUpdating || isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
                    >
                        {isBulkUpdating ? <Loader2 size={16} className="animate-spin"/> : <ShieldOff size={16} />}
                        Desativar Selecionados
                    </button>
                </div>
            </div>
            {/* --- FIM BARRA DE AÇÃO --- */}

            {/* Mensagens de Feedback */}
            {syncStatus.message && (
                <div className={`text-sm text-center p-2 rounded mb-2 ${
                    syncStatus.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                    syncStatus.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
                    'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                    {syncStatus.message}
                </div>
            )}
            {error && <p className="text-sm text-center text-red-600 mb-2">{error}</p>}

            {/* Tabela de Usuários (ATUALIZADA) */}
            {loading ? (
                 <div className="min-h-[100px] flex items-center justify-center"><p className="text-gray-500 animate-pulse">Carregando...</p></div>
            ) : (
                <div className="overflow-x-auto relative">
                    <table className="w-full text-sm text-left table-auto">
                        <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                            <tr>
                                {/* --- NOVO: Checkbox Header --- */}
                                <th className="p-2 px-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-400"
                                        checked={isAllChecked}
                                        ref={el => el && (el.indeterminate = isIndeterminate)} // Seta o estado "intermediário"
                                        onChange={handleSelectAll}
                                        disabled={totalVisivelSelecionavel === 0}
                                        title={totalVisivelSelecionavel > 0 ? "Selecionar todos os visíveis" : "Nenhum usuário selecionável"}
                                    />
                                </th>
                                {/* --- FIM NOVO --- */}
                                <th className="p-2 px-3">Username</th>
                                <th className="p-2 px-3">Nome</th>
                                <th className="p-2 px-3">E-mail</th>
                                <th className="p-2 px-3">Departamento</th>
                                <th className="p-2 px-3">Gestor Imediato</th> 
                                <th className="p-2 px-3">Grupos</th>
                                <th className="p-2 px-3">Status</th>
                                <th className="p-2 px-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!error && filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="p-4 text-center text-gray-500 italic">
                                        {users.length > 0
                                            ? 'Nenhum usuário encontrado com os filtros aplicados.'
                                            : 'Nenhum usuário local encontrado.'
                                        }
                                    </td>
                                </tr>
                            )}
                            
                            {filteredUsers.map(user => {
                                const isProtected = user.username === 'admin' || user.id === currentUser.id;
                                const isSelected = selectedUserIds.has(user.id);
                                return (
                                <tr key={user.id} className={`border-b ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                    {/* --- NOVO: Checkbox da Linha --- */}
                                    <td className="p-2 px-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-400"
                                            checked={isSelected}
                                            disabled={isProtected || isBulkUpdating || isSyncing}
                                            onChange={() => handleSelectUser(user.id)}
                                            title={isProtected ? "Não é possível selecionar este usuário" : `Selecionar ${user.nome}`}
                                        />
                                    </td>
                                    {/* --- FIM NOVO --- */}
                                    <td className="p-2 px-3 font-medium">{user.username}</td>
                                    <td className="p-2 px-3">{user.nome}</td>
                                    <td className="p-2 px-3 text-gray-600">{user.email || '-'}</td>
                                    <td className="p-2 px-3 text-gray-600">{user.departamento || '-'}</td>
                                    <td className="p-2 px-3 text-gray-600">{user.gestor?.nome || '-'}</td> 
                                    <td className="p-2 px-3 text-xs">{displayUserGroups(user.grupos)}</td>
                                    
                                    {/* Status como Botão */}
                                    <td className="p-2 px-3">
                                        <button
                                            onClick={() => handleToggleUserStatus(user)}
                                            disabled={isSyncing || togglingUserId === user.id || isProtected || isBulkUpdating}
                                            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer
                                                ${user.ativo 
                                                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                                    : 'bg-red-100 text-red-800 hover:bg-red-200'}
                                                ${(isProtected) ? 'opacity-60 cursor-not-allowed' : ''}
                                                ${togglingUserId === user.id ? 'opacity-50 cursor-wait' : ''}
                                            `}
                                            title={isProtected ? 'Não é possível alterar este usuário' : (user.ativo ? 'Clique para desativar' : 'Clique para ativar')}
                                        >
                                            {togglingUserId === user.id ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                user.ativo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />
                                            )}
                                            {user.ativo ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    
                                    {/* Ações (Sem Excluir) */}
                                    <td className="p-2 px-3 space-x-2 whitespace-nowrap">
                                        <button 
                                            onClick={() => handleOpenEditUser(user)} 
                                            className="text-blue-600 hover:underline text-xs font-medium"
                                            title="Editar Usuário"
                                        >
                                            <Edit size={14} className="inline-block mr-1" />
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modais */}
            {isUserModalOpen && (
                <UserModal
                    user={selectedUser}
                    groups={groups} 
                    managers={managers} 
                    onClose={handleCloseUserModal}
                    onSave={handleSaveUser}
                />
            )}
            {isImportModalOpen && (
                <AdImportModal
                    availableGroups={groups} 
                    onClose={handleCloseImportModal}
                    onImportSuccess={fetchData} 
                />
            )}
        </div>
    );
}