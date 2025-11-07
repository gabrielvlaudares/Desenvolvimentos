// src/pages/AuditLogPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js'; // Verifica se o caminho está correto
import { format } from 'date-fns';
// CORREÇÃO: Importação específica do locale pt-BR
import { ptBR } from 'date-fns/locale/pt-BR'; // Importa diretamente o locale

// Helper para formatar datas (sem alteração na lógica, apenas no import do locale)
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
            console.warn(`[AuditLogPage formatDate] Data inválida recebida: ${dateString}`);
            return 'Inválida';
        }
        // Usando o locale importado corretamente
        return format(dateObj, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
    } catch (e) {
        console.error("Erro ao formatar data em AuditLogPage:", dateString, e);
        return 'Inválida';
    }
};

// Componente principal da página de auditoria
export default function AuditLogPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true); // Inicia como true
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        usuarioUpn: '',
        acao: '',
        entityType: '',
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 1,
    });
    const [distinctActions, setDistinctActions] = useState([]);
    const [distinctEntityTypes, setDistinctEntityTypes] = useState([]);

    // Busca as opções para os filtros
    const fetchFilterOptions = useCallback(async () => {
        console.log("[AuditLogPage] Buscando opções de filtro...");
        try {
            const [actionsRes, typesRes] = await Promise.all([
                api.get('/audit/actions'),
                api.get('/audit/entityTypes')
            ]);
            setDistinctActions(actionsRes.data || []);
            setDistinctEntityTypes(typesRes.data || []);
            console.log("[AuditLogPage] Opções de filtro carregadas:", { actions: actionsRes.data?.length, types: typesRes.data?.length });
        } catch (err) {
            console.error("[AuditLogPage] Erro ao buscar opções de filtro:", err.response?.data || err.message);
            setError('Falha ao carregar opções de filtro.'); // Informa o usuário
        }
    }, []); // Sem dependências, busca uma vez

    // Busca os logs da API
    const fetchLogs = useCallback(async (pageToFetch = 1) => {
        console.log(`[AuditLogPage] Iniciando busca de logs para página ${pageToFetch} com filtros:`, filters);
        setLoading(true);
        setError('');
        setLogs([]); // Limpa logs antes de buscar novos
        try {
            const params = {
                page: pageToFetch,
                limit: pagination.limit,
                // Adiciona filtros aos parâmetros apenas se tiverem valor
                ...(filters.startDate && { startDate: filters.startDate }),
                ...(filters.endDate && { endDate: filters.endDate }),
                ...(filters.usuarioUpn && { usuarioUpn: filters.usuarioUpn }),
                ...(filters.acao && { acao: filters.acao }),
                ...(filters.entityType && { entityType: filters.entityType }),
            };

            console.log("[AuditLogPage] Parâmetros da requisição:", params);
            const response = await api.get('/audit', { params });
            console.log("[AuditLogPage] Resposta da API recebida:", response.data);

            const responseData = response.data;
            const fetchedLogs = responseData?.data || [];
            const total = responseData?.total || 0;
            const currentPage = responseData?.page || 1;
            const limit = responseData?.limit || pagination.limit;
            const totalPages = Math.ceil(total / limit) || 1;

            setLogs(fetchedLogs);
            setPagination({
                page: currentPage,
                limit: limit,
                totalItems: total,
                totalPages: totalPages,
            });
            console.log(`[AuditLogPage] Logs atualizados: ${fetchedLogs.length} nesta página. Total: ${total}. Total Páginas: ${totalPages}`);
            if (fetchedLogs.length === 0 && total === 0) {
                console.log("[AuditLogPage] Nenhum log encontrado com os filtros aplicados.");
            }

        } catch (err) {
            console.error("[AuditLogPage] Erro detalhado ao buscar logs:", err.response || err);
            const errorMsg = err.response?.data?.message || err.message || 'Erro desconhecido ao carregar logs.';
            setError(`Falha ao carregar logs: ${errorMsg}`);
            setLogs([]); // Limpa logs em caso de erro
            setPagination(prev => ({ ...prev, page: 1, totalItems: 0, totalPages: 1 })); // Reseta paginação
        } finally {
            setLoading(false);
            console.log("[AuditLogPage] Busca de logs finalizada.");
        }
    }, [filters, pagination.limit]); // Depende dos filtros e do limite por página

    // Efeito para busca inicial e de opções
    useEffect(() => {
        console.log("[AuditLogPage] Montando componente. Buscando opções e logs iniciais...");
        fetchFilterOptions();
        fetchLogs(1); // Busca a primeira página ao montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchFilterOptions]); // Roda apenas uma vez ao montar para buscar opções e a primeira página

    // Handlers
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        console.log("[AuditLogPage] Aplicando filtros:", filters);
        setPagination(prev => ({ ...prev, page: 1 })); // Reseta para a página 1 ao aplicar filtros
        fetchLogs(1); // Chama a busca com a página 1
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
            console.log(`[AuditLogPage] Mudando para página ${newPage}`);
            setPagination(prev => ({ ...prev, page: newPage }));
            fetchLogs(newPage); // Busca a nova página
        }
    };
    const handleNextPage = () => handlePageChange(pagination.page + 1);
    const handlePrevPage = () => handlePageChange(pagination.page - 1);


    // Estilos (sem alterações)
    const inputStyle = "w-full border border-gray-300 rounded-md p-1.5 text-sm focus:border-blue-500 focus:ring-blue-500 bg-white";
    const buttonStyle = "px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed";

    return (
        <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">Log de Auditoria</h2>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 p-4 border rounded-md bg-gray-50">
                <div><label className="block text-xs font-medium text-gray-600">Data Início</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputStyle} max={filters.endDate || undefined} /></div>
                <div><label className="block text-xs font-medium text-gray-600">Data Fim</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} min={filters.startDate || undefined} className={inputStyle} /></div>
                <div><label className="block text-xs font-medium text-gray-600">Usuário (UPN)</label><input type="text" name="usuarioUpn" value={filters.usuarioUpn} onChange={handleFilterChange} placeholder="username..." className={inputStyle} /></div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Tipo Entidade</label>
                    <select name="entityType" value={filters.entityType} onChange={handleFilterChange} className={inputStyle}>
                        <option value="">Todos</option>
                        {distinctEntityTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600">Ação</label>
                    <select name="acao" value={filters.acao} onChange={handleFilterChange} className={inputStyle}>
                        <option value="">Todas</option>
                        {distinctActions.map(action => <option key={action} value={action}>{action}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-5 flex justify-end items-center pt-2">
                    <button onClick={handleApplyFilters} disabled={loading} className={buttonStyle}>
                        {loading ? 'Buscando...' : 'Aplicar Filtros'}
                    </button>
                </div>
            </div>

            {/* Mensagem de Erro (apenas se não estiver carregando) */}
            {!loading && error && <p className="text-sm text-center text-red-600 bg-red-50 p-3 rounded border border-red-200 mb-4">{error}</p>}

            {/* Tabela de Logs */}
            <div className="overflow-x-auto relative min-h-[300px]">
                {/* Indicador de Loading */}
                {loading && ( <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"><p className="text-gray-500 animate-pulse text-lg">A carregar logs...</p></div> )}
                <table className="w-full text-xs text-left table-fixed">
                    <thead className="bg-gray-100 text-gray-700 uppercase sticky top-0 z-5">
                        <tr>
                            <th className="p-2 w-36">Data/Hora</th>
                            <th className="p-2 w-28">Usuário</th>
                            <th className="p-2 w-40">Ação</th>
                            <th className="p-2 w-32">Entidade</th>
                            <th className="p-2 w-48">Identificador</th>
                            <th className="p-2 min-w-[200px]">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Mensagem de "Nenhum resultado" apenas se não estiver carregando e não houver erro */}
                        {!loading && !error && logs.length === 0 && (
                            <tr><td colSpan="6" className="p-4 text-center text-gray-500 italic">Nenhum registo encontrado com os filtros aplicados.</td></tr>
                        )}
                        {/* Renderiza os logs */}
                        {!loading && logs.map(log => (
                            <tr key={log.id} className="border-b hover:bg-gray-50 align-top">
                                <td className="p-2 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                                <td className="p-2 break-words">{log.usuarioUpn}</td>
                                <td className="p-2 break-words font-medium">{log.acao}</td>
                                <td className="p-2 break-words">{log.entityType}</td>
                                <td className="p-2 break-words text-gray-600">{log.entityIdentifier}</td>
                                <td className="p-2 break-words text-gray-500 text-[11px] whitespace-pre-wrap">{log.detalhes || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Paginação (apenas se houver mais de uma página e não estiver carregando) */}
            {!loading && pagination.totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-2 border-t text-sm text-gray-600">
                    <span>Página {pagination.page} de {pagination.totalPages} ({pagination.totalItems} registos)</span>
                    <div className="flex gap-2">
                        <button onClick={handlePrevPage} disabled={pagination.page <= 1 || loading} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Anterior</button>
                        <button onClick={handleNextPage} disabled={pagination.page >= pagination.totalPages || loading} className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50">Próxima</button>
                    </div>
                </div>
            )}
            {/* Informação total mesmo com 1 página */}
            {!loading && pagination.totalPages <= 1 && pagination.totalItems > 0 && (
                 <div className="flex justify-start items-center mt-4 pt-2 border-t text-sm text-gray-600">
                    <span>Total de {pagination.totalItems} registo(s)</span>
                </div>
            )}
        </div>
    );
}
