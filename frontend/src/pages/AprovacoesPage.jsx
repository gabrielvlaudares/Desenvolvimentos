// src/pages/AprovacoesPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../services/api';

// --- Reutilizando Helpers e Componentes ---
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        // Tenta criar o objeto Date. Se falhar, retorna 'Inválida'.
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
            return 'Inválida';
        }
        return format(dateObj, formatString, { locale: ptBR });
    } catch (e) {
        console.error("Erro ao formatar data em AprovacaoCard:", dateString, e);
        return 'Inválida';
    }
};

// --- Componente Card de Aprovação ---
const AprovacaoCard = ({ item, onApprove, onReject, loadingActionId }) => {
    // Usa chave composta 'tipo-id' para evitar conflito
    const isLoading = loadingActionId === `${item.tipoProcesso}-${item.id}`;

    return (
        <div className={`p-4 bg-white rounded-lg shadow border border-gray-200 mb-4 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-3 border-b pb-2">
                 <span className="text-sm font-medium text-gray-600">ID #{item.idSequencial} ({item.tipoProcesso === 'maquina' ? 'Máquina' : 'Transferência'})</span>
                <span className="px-2 py-0.5 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                    {item.statusProcesso} {/* Geralmente 'Aguardando Aprovação' aqui */}
                </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4">
                {/* Campos Comuns */}
                <div><strong>Solicitante:</strong> {item.solicitante || item.nomeRequisitante || '-'}</div>
                 {item.areaResponsavel && <div><strong>Área:</strong> {item.areaResponsavel}</div>}
                 {item.setor && <div><strong>Setor:</strong> {item.setor}</div>}

                 {/* Campos específicos de Máquina */}
                {item.tipoProcesso === 'maquina' && (
                    <>
                        {item.tipoSaida && <div><strong>Tipo Saída:</strong> {item.tipoSaida}</div>}
                        {item.quantidade && <div><strong>Quantidade:</strong> {item.quantidade}</div>}
                        {item.dataEnvio && <div><strong>Data Envio:</strong> {formatDate(item.dataEnvio, false)}</div>}
                        {item.prazoRetorno && <div><strong>Prazo Retorno:</strong> {formatDate(item.prazoRetorno, false)}</div>}
                        {item.nfSaida && <div><strong>NF Saída:</strong> {item.nfSaida}</div>}
                        {item.motivoSaida && <div className="sm:col-span-2 lg:col-span-3"><strong>Motivo:</strong> {item.motivoSaida}</div>}
                        {item.descricaoMaterial && <div className="sm:col-span-2 lg:col-span-3"><strong>Descrição:</strong> {item.descricaoMaterial}</div>}
                        {item.pdfUrlSaida && (
                            <div>
                                <strong>Anexo NF Saída:</strong>{' '}
                                <a href={`http://localhost:5000${item.pdfUrlSaida}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    Ver PDF
                                </a>
                            </div>
                        )}
                    </>
                )}

                 {/* Campos específicos de Transferência */}
                 {item.tipoProcesso === 'transferencia' && (
                     <>
                        {item.numeroNf && <div><strong>NF Transf.:</strong> {item.numeroNf}</div>}
                        {item.portariaSaida && <div><strong>Origem:</strong> {item.portariaSaida}</div>}
                        {item.portariaDestino && <div><strong>Destino:</strong> {item.portariaDestino}</div>}
                        {item.dataSaidaSolicitada && <div><strong>Saída Solicitada:</strong> {formatDate(item.dataSaidaSolicitada, true)}</div>}
                         {item.pdfUrl && (
                            <div>
                                <strong>Anexo NF Transf.:</strong>{' '}
                                <a href={`http://localhost:5000${item.pdfUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    Ver PDF
                                </a>
                            </div>
                        )}
                    </>
                 )}
            </div>
            {/* Botões */}
            <div className="flex justify-end gap-3 pt-3 border-t">
                 <button
                    onClick={() => onReject(item.id, item.tipoProcesso)}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                   {isLoading ? 'Aguarde...' : 'Rejeitar'}
                </button>
                <button
                    onClick={() => onApprove(item.id, item.tipoProcesso)}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Aguarde...' : 'Aprovar'}
                </button>
            </div>
        </div>
    );
};


// --- Componente Header ---
const Header = () => {
  const { user, logout } = useAuth();
  // Usa a nova flag para determinar se é admin, senão verifica se tem permissão de aprovação
  const userRole = user?.canAccessAdminPanel ? 'Admin' : (user?.canPerformApprovals ? 'Gestor' : 'Usuário');

  return (
     <header className="flex items-center justify-between p-4 bg-white shadow-md">
      <div className="flex items-center gap-4">
         <Link to="/dashboard" className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300">
            &larr; Voltar
          </Link>
        <h1 className="text-xl font-bold text-green-700">Aprovações Pendentes</h1>
      </div>
      <div className="flex items-center gap-4">
        {/* Mostra o papel correto */}
        <span className="text-sm">{userRole}: {user?.nome}</span>
        <button
          onClick={logout}
          className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
        >
          Sair
        </button>
      </div>
    </header>
  )
}

// --- Componente Principal da Página (CORRIGIDO) ---
export default function AprovacoesPage() {
  const { user } = useAuth(); // user agora tem as flags can...
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Usa chave composta 'tipo-id'
  const [loadingActionId, setLoadingActionId] = useState(null);

  useEffect(() => {
    // Adiciona verificação para user não ser null antes de buscar
    if(user) {
        fetchPendingApprovals();
    } else if (!user && !useAuth().loading) { // Se user é null e auth não está carregando
        setLoading(false); // Para o loading se não há usuário
        setError("Usuário não autenticado."); // Ou redireciona para login
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Depende do user

  const fetchPendingApprovals = async () => {
    if (!user) return; // Segurança extra

    setLoading(true);
    setError('');
    try {
        // Busca TODAS as saídas de máquinas
        const responseMaquinas = await api.get('/maquinas');
        const maquinas = responseMaquinas.data.map(item => ({...item, tipoProcesso: 'maquina'}));

        // Busca TODAS as transferências
        const responseTransferencias = await api.get('/transferencias');
        const transferencias = responseTransferencias.data.map(item => ({...item, tipoProcesso: 'transferencia'}));

        // Combina os dados
        const allData = [...maquinas, ...transferencias];

        // Filtra localmente: Status 'Aguardando Aprovação' E (Admin OU Gestor da solicitação)
        const filtered = allData.filter(item =>
            item.statusProcesso === 'Aguardando Aprovação' &&
            (
                user?.canAccessAdminPanel || // <-- CORRIGIDO AQUI
                (
                  // Gestor (não admin) só vê se tiver a permissão E for o gestor da solicitação
                  user?.canPerformApprovals &&
                  item.gestorEmail &&
                  user?.email &&
                  item.gestorEmail.toLowerCase() === user.email.toLowerCase()
                )
            )
        );

        console.log(`[AprovacoesPage] Itens pendentes para ${user.username} (Admin: ${user.canAccessAdminPanel}):`, filtered);
        setPendingItems(filtered);

    } catch (err) {
      setError('Erro ao carregar aprovações pendentes.');
      console.error("Erro fetchAprovacoes:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  // Funções handleApprove e handleReject (sem alterações na lógica interna)
  const handleApprove = async (id, tipo) => {
    setError('');
    const actionId = `${tipo}-${id}`;
    setLoadingActionId(actionId);
    try {
      const apiUrl = tipo === 'maquina' ? `/maquinas/${id}/aprovar` : `/transferencias/${id}/aprovar`; // Precisa existir para transferencias
      await api.put(apiUrl);
      fetchPendingApprovals(); // Recarrega a lista
    } catch (err) {
      setError(err.response?.data?.message || `Erro ao aprovar ${tipo} #${id}.`);
      console.error(`Erro aprovar ${tipo} ${id}:`, err.response || err);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReject = async (id, tipo) => {
    setError('');
    const motivo = prompt(`Informe o motivo da rejeição para ${tipo} #${id} (obrigatório):`);
    if (!motivo || motivo.trim() === '') {
      console.log('Rejeição cancelada, motivo não fornecido.');
      return;
    }
    const actionId = `${tipo}-${id}`;
    setLoadingActionId(actionId);
    try {
      const apiUrl = tipo === 'maquina' ? `/maquinas/${id}/rejeitar` : `/transferencias/${id}/rejeitar`; // Precisa existir para transferencias
      await api.put(apiUrl, { motivoRejeicao: motivo.trim() });
      fetchPendingApprovals(); // Recarrega
    } catch (err) {
      setError(err.response?.data?.message || `Erro ao rejeitar ${tipo} #${id}.`);
      console.error(`Erro rejeitar ${tipo} ${id}:`, err.response || err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Renderização
   if (loading && pendingItems.length === 0) { // Mostra loading inicial
       return (
           <div className="min-h-screen bg-gray-100">
               {user && <Header />}
               <p className="text-center text-gray-500 py-10">Carregando aprovações...</p>
           </div>
       );
   }

  return (
    <div className="min-h-screen bg-gray-100">
      {user && <Header />} {/* Só renderiza header se user existir */}
      <main className="p-4 m-4 max-w-5xl mx-auto">
        {/* Mostra erro apenas se não estiver carregando */}
        {!loading && error && <p className="text-center text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>}

        {/* Mensagem de 'nenhum item' apenas se não estiver carregando e não houver erro */}
        {!loading && !error && pendingItems.length === 0 && (
            <div className="p-6 bg-white rounded-lg shadow border border-gray-200 text-center text-gray-500">
             Nenhuma solicitação aguardando sua aprovação no momento.
            </div>
        )}

        {/* Lista os itens */}
        {!loading && pendingItems.map(item => (
            <AprovacaoCard
                key={`${item.tipoProcesso}-${item.id}`} // Chave única composta
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
                loadingActionId={loadingActionId} // Passa o ID em progresso ('tipo-id')
            />
        ))}
      </main>
    </div>
  );
}

