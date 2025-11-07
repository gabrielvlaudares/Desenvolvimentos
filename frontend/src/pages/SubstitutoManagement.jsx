// src/pages/SubstitutoManagement.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Loader2, Plus, Trash, AlertTriangle, UserCheck } from 'lucide-react';

// Formata data para 'YYYY-MM-DD' (para input)
const formatDateForInput = (date) => {
    return date ? new Date(date).toISOString().split('T')[0] : '';
};

// Formata data para 'DD/MM/YYYY' (para exibição)
const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // UTC para evitar off-by-one
};

export default function SubstitutoManagement() {
    const [substituicoes, setSubstituicoes] = useState([]);
    const [gestores, setGestores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        gestorOriginalId: '',
        gestorSubstitutoId: '',
        dataInicio: today,
        dataFim: '',
    });

    // Função para carregar todos os dados
    const fetchData = async () => {
        try {
            setLoading(true);
            const [gestoresRes, substitutosRes] = await Promise.all([
                api.get('/admin/gestores'), // Rota que busca usuários com 'canPerformApprovals'
                api.get('/admin/substitutos'),
            ]);
            setGestores(gestoresRes.data);
            setSubstituicoes(substitutosRes.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao carregar dados.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Carrega dados iniciais
    useEffect(() => {
        fetchData();
    }, []);

    // Handler do formulário
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setFormError('');
    };

    // Handler para criar nova substituição
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        
        // Validações
        const { gestorOriginalId, gestorSubstitutoId, dataInicio, dataFim } = formData;
        if (!gestorOriginalId || !gestorSubstitutoId || !dataInicio || !dataFim) {
            setFormError('Todos os campos são obrigatórios.');
            return;
        }
        if (gestorOriginalId === gestorSubstitutoId) {
            setFormError('O gestor original não pode ser o substituto.');
            return;
        }
        if (new Date(dataFim) < new Date(dataInicio)) {
            setFormError('A data final não pode ser anterior à data inicial.');
            return;
        }

        setIsSaving(true);
        try {
            await api.post('/admin/substitutos', {
                ...formData,
                // Converte IDs para Inteiro
                gestorOriginalId: parseInt(gestorOriginalId),
                gestorSubstitutoId: parseInt(gestorSubstitutoId),
            });
            // Limpa o formulário e recarrega a lista
            setFormData({
                gestorOriginalId: '',
                gestorSubstitutoId: '',
                dataInicio: today,
                dataFim: '',
            });
            await fetchData();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Erro ao salvar substituição.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    // Handler para excluir
    const handleDelete = async (id, gestorNome) => {
        if (!window.confirm(`Tem certeza que deseja remover a substituição para ${gestorNome}?`)) {
            return;
        }
        
        try {
            await api.delete(`/admin/substitutos/${id}`);
            await fetchData(); // Recarrega a lista
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao excluir.');
            console.error(err);
        }
    };


    return (
        <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
            {/* 1. Cabeçalho */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Programar Ausências (Gestores)</h2>
                    <p className="text-sm text-gray-500">Configure gestores substitutos para períodos de ausência.</p>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md">
                    {error}
                </div>
            )}

            {/* 2. Formulário de Criação */}
            <form onSubmit={handleSubmit}>
                <fieldset className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border rounded-md bg-gray-50 items-end">
                    <legend className="text-md font-semibold text-gray-700 px-2 -mb-3">Nova Programação</legend>
                    
                    <div>
                        <label htmlFor="gestorOriginalId" className="block text-xs font-medium text-gray-600">Gestor Ausente *</label>
                        <select id="gestorOriginalId" name="gestorOriginalId" value={formData.gestorOriginalId} onChange={handleChange} className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm">
                            <option value="">Selecione...</option>
                            {gestores.map(g => (
                                <option key={g.id} value={g.id}>{g.nome}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label htmlFor="gestorSubstitutoId" className="block text-xs font-medium text-gray-600">Gestor Substituto *</label>
                        <select id="gestorSubstitutoId" name="gestorSubstitutoId" value={formData.gestorSubstitutoId} onChange={handleChange} className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm">
                            <option value="">Selecione...</option>
                            {gestores.map(g => (
                                <option key={g.id} value={g.id}>{g.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="dataInicio" className="block text-xs font-medium text-gray-600">Data Início *</label>
                        <input type="date" id="dataInicio" name="dataInicio" value={formData.dataInicio} onChange={handleChange} min={today} className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm"/>
                    </div>
                    
                    <div>
                        <label htmlFor="dataFim" className="block text-xs font-medium text-gray-600">Data Fim *</label>
                        <input type="date" id="dataFim" name="dataFim" value={formData.dataFim} onChange={handleChange} min={formData.dataInicio || today} className="w-full mt-1 border border-gray-300 rounded-md p-2 text-sm"/>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md shadow-sm hover:bg-blue-800 disabled:bg-gray-400"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        <span className="ml-2">{isSaving ? 'Salvando...' : 'Adicionar'}</span>
                    </button>
                    
                    {formError && (
                         <div className="md:col-span-5 text-sm text-red-600">{formError}</div>
                    )}
                </fieldset>
            </form>

            {/* 3. Lista de Substituições Ativas/Programadas */}
            <div className="overflow-x-auto relative">
                <h3 className="text-md font-semibold text-gray-800 mb-2 mt-4">Programações Ativas</h3>
                {loading ? (
                    <div className="min-h-[100px] flex items-center justify-center"><Loader2 className="animate-spin" /></div>
                ) : (
                    <table className="w-full text-sm text-left table-auto">
                        <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                            <tr>
                                <th className="p-2 px-3">Status</th>
                                <th className="p-2 px-3">Gestor Original (Ausente)</th>
                                <th className="p-2 px-3">Gestor Substituto</th>
                                <th className="p-2 px-3">Início</th>
                                <th className="p-2 px-3">Fim</th>
                                <th className="p-2 px-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {substituicoes.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-4 text-center text-gray-500 italic">
                                        Nenhuma programação de ausência encontrada.
                                    </td>
                                </tr>
                            )}
                            
                            {substituicoes.map(sub => {
                                const now = new Date();
                                const inicio = new Date(sub.dataInicio);
                                const fim = new Date(sub.dataFim);
                                fim.setHours(23, 59, 59); // Garante que "fim" inclua o dia todo

                                let status = "Programado";
                                let statusClass = "bg-blue-100 text-blue-800";
                                if (now >= inicio && now <= fim) {
                                    status = "Ativo";
                                    statusClass = "bg-green-100 text-green-800";
                                } else if (now > fim) {
                                    status = "Expirado";
                                    statusClass = "bg-gray-100 text-gray-600";
                                }

                                return (
                                    <tr key={sub.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 px-3">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusClass}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td className="p-2 px-3 font-medium">{sub.gestorOriginal.nome}</td>
                                        <td className="p-2 px-3">{sub.gestorSubstituto.nome}</td>
                                        <td className="p-2 px-3">{formatDateForDisplay(sub.dataInicio)}</td>
                                        <td className="p-2 px-3">{formatDateForDisplay(sub.dataFim)}</td>
                                        <td className="p-2 px-3">
                                            <button
                                                onClick={() => handleDelete(sub.id, sub.gestorOriginal.nome)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Remover programação"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
}