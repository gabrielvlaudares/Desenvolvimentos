// src/pages/MaquinaAprovacoes.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import MaquinaDetailsModal from './MaquinaDetailsModal';
import { Loader2, Check, X, AlertTriangle, Inbox, Eye } from 'lucide-react';

export default function MaquinaAprovacoes() {
    const { user } = useAuth(); // Pega o usuário logado
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [motivoRejeicao, setMotivoRejeicao] = useState('');
    const [rejeicaoId, setRejeicaoId] = useState(null); // Para qual ID o popup de rejeição está aberto
    const [actionLoading, setActionLoading] = useState(null); // Controla loading (approve/reject)

    // --- NOVO: Estado para substituições ---
    const [substitutoDe, setSubstitutoDe] = useState([]);

    // Busca dados
    useEffect(() => {
        const fetchDadosAprovacao = async () => {
            if (!user?.email) return; // Espera o usuário carregar

            setLoading(true);
            setError('');
            try {
                // 1. Busca as solicitações pendentes
                const resSolicitacoes = await api.get('/maquinas');
                
                // 2. Busca a lista de quem o usuário atual é substituto
                const resSubstitutos = await api.get('/admin/substitutos'); // Reutiliza a API do admin
                
                const hoje = new Date();
                const emailsDosGestoresOriginais = resSubstitutos.data
                    .filter(sub => {
                        // O substituto é o usuário logado?
                        const isSubstituto = sub.gestorSubstituto.id === user.id;
                        // Está no período?
                        const inicio = new Date(sub.dataInicio);
                        const fim = new Date(sub.dataFim);
                        fim.setHours(23, 59, 59); // Fim do dia
                        const isAtivo = hoje >= inicio && hoje <= fim;
                        
                        return isSubstituto && isAtivo;
                    })
                    .map(sub => sub.gestorOriginal.email.toLowerCase()); // Pega os e-mails (em minúsculo)

                setSubstitutoDe(emailsDosGestoresOriginais);
                console.log("Usuário logado é substituto de:", emailsDosGestoresOriginais);

                // 3. Filtra as solicitações
                const pendentes = resSolicitacoes.data.filter(s => {
                    const gestorEmail = s.gestorEmail.toLowerCase();
                    
                    // É o gestor original E está pendente?
                    const isGestorOriginal = gestorEmail === user.email.toLowerCase();
                    // É um substituto ativo para este gestor E está pendente?
                    const isSubstituto = emailsDosGestoresOriginais.includes(gestorEmail);

                    return s.statusProcesso === 'Aguardando Aprovação' && (isGestorOriginal || isSubstituto);
                });
                
                setSolicitacoes(pendentes);

            } catch (err) {
                setError(err.response?.data?.message || 'Erro ao buscar solicitações.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDadosAprovacao();
    }, [user]); // Depende do 'user' estar carregado

    // Ações (Aprovar/Rejeitar/Ver)
    
    // (Handler de Aprovar - inalterado)
    const handleAprovar = async (id) => {
        setActionLoading(id);
        setError('');
        try {
            await api.patch(`/maquinas/${id}/aprovar`);
            // Remove da lista
            setSolicitacoes(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao aprovar.');
        } finally {
            setActionLoading(null);
        }
    };
    
    // (Handler de Rejeitar - inalterado)
    const handleRejeitar = async (id) => {
        if (!motivoRejeicao) {
            setError('O motivo da rejeição é obrigatório.');
            return;
        }
        setActionLoading(id);
        setError('');
        try {
            await api.patch(`/maquinas/${id}/rejeitar`, { motivoRejeicao });
            // Remove da lista
            setSolicitacoes(prev => prev.filter(s => s.id !== id));
            setRejeicaoId(null);
            setMotivoRejeicao('');
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao rejeitar.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleOpenModal = (solicitacao) => {
        setSelectedSolicitacao(solicitacao);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSolicitacao(null);
    };

    // (Renderização de Loading/Erro/Vazio - inalterada)
    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <span className="ml-2">Carregando aprovações...</span>
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-4 bg-red-100 text-red-700 border border-red-200 rounded-md">
                {error}
            </div>
        );
    }
     if (solicitacoes.length === 0) {
        return (
            <div className="text-center p-12 border rounded-lg bg-gray-50">
                <Inbox size={48} className="mx-auto text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-800">Caixa de entrada limpa!</h3>
                <p className="mt-1 text-sm text-gray-500">Nenhuma solicitação aguardando sua aprovação no momento.</p>
            </div>
        );
    }

    // Renderização Principal
    return (
        <div className="space-y-4">
            {solicitacoes.map(s => {
                const isSubstituto = substitutoDe.includes(s.gestorEmail.toLowerCase());
                return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4">
                        {/* --- NOVO: Tag de Substituto --- */}
                        {isSubstituto && (
                            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2">
                                <UserCheck size={16} className="text-blue-600" />
                                <span className="text-sm text-blue-700 font-medium">
                                    Esta é uma aprovação para {s.gestorEmail} (você é o substituto).
                                </span>
                            </div>
                        )}
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                            <div>
                                <h4 className="text-lg font-semibold text-gray-800">ID: {s.idSequencial} - {s.descricaoMaterial}</h4>
                                <p className="text-sm text-gray-600">
                                    Solicitante: <span className="font-medium">{s.solicitante}</span> | Área: <span className="font-medium">{s.areaResponsavel}</span>
                                </p>
                                <p className="text-sm text-gray-500">
                                    Criado em: {new Date(s.criadoEm).toLocaleDateString('pt-BR')} | Tipo: <span className="font-medium">{s.tipoSaida}</span>
                                </p>
                            </div>
                            <div className="flex gap-2 mt-4 md:mt-0 flex-shrink-0">
                                <button onClick={() => handleOpenModal(s)} className="p-2 text-gray-500 hover:text-gray-800" title="Ver Detalhes">
                                    <Eye size={18} />
                                </button>
                                <button 
                                    onClick={() => setRejeicaoId(s.id)} 
                                    disabled={actionLoading === s.id}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-400"
                                >
                                    {actionLoading === s.id ? <Loader2 className="animate-spin" size={20} /> : <X size={20} />}
                                    <span className="ml-1 hidden sm:inline">Rejeitar</span>
                                </button>
                                <button 
                                    onClick={() => handleAprovar(s.id)} 
                                    disabled={actionLoading === s.id}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400"
                                >
                                    {actionLoading === s.id ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                    <span className="ml-1 hidden sm:inline">Aprovar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Popup de Rejeição */}
                    {rejeicaoId === s.id && (
                        <div className="p-4 bg-gray-50 border-t">
                            <label htmlFor={`motivo-${s.id}`} className="block text-sm font-medium text-gray-700 mb-1">Motivo da Rejeição (Obrigatório):</label>
                            <textarea
                                id={`motivo-${s.id}`}
                                value={motivoRejeicao}
                                onChange={(e) => setMotivoRejeicao(e.target.value)}
                                rows={2}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                            <div className="flex gap-2 mt-2 justify-end">
                                <button onClick={() => setRejeicaoId(null)} className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded-md">
                                    Cancelar
                                </button>
                                <button 
                                    onClick={() => handleRejeitar(s.id)} 
                                    disabled={!motivoRejeicao || actionLoading === s.id}
                                    className="px-3 py-1 text-sm text-white bg-red-600 rounded-md disabled:bg-gray-400"
                                >
                                    Confirmar Rejeição
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {isModalOpen && (
                <MaquinaDetailsModal 
                    solicitacao={selectedSolicitacao} 
                    onClose={handleCloseModal} 
                    userRole="gestor" 
                />
            )}
        </div>
    );
}