// src/pages/PortariaPage.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

// --- Reutilizando Helpers e Componentes ---
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString, includeTime = true) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
            console.warn(`[formatDate] Data inválida recebida: ${dateString}`);
            return 'Inválida';
        }
        return format(dateObj, formatString, { locale: ptBR });
    } catch (e) {
        console.error("Erro ao formatar data em PortariaCard:", dateString, e);
        return 'Inválida';
    }
};
const getCurrentDate = () => new Date().toISOString().split('T')[0];
const getCurrentTime = () => new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

// --- Componente Card (Unificado) ---
// (Nenhuma alteração necessária dentro do PortariaCard)
const PortariaCard = ({ item, onAction, loadingActionId, selectedPortaria }) => {
    const { user } = useAuth();
    const [dataEfetiva, setDataEfetiva] = useState(getCurrentDate());
    const [horaEfetiva, setHoraEfetiva] = useState(getCurrentTime());
    const [obs, setObs] = useState('');
    const isLoading = loadingActionId === `${item.tipoProcesso}-${item.id}`;
    const isMaquina = item.tipoProcesso === 'maquina';
    const isTransferenciaSaida = item.tipoProcesso === 'transferencia' && item.statusProcesso === 'Em andamento';
    const isTransferenciaChegada = item.tipoProcesso === 'transferencia' && item.statusProcesso === 'Em trânsito';
    const endpoint = isMaquina ? 'saida-portaria' : (isTransferenciaChegada ? 'chegada' : 'saida');

    const handleSubmit = (decisao) => (e) => {
        e.preventDefault();
        const [hora, minuto] = horaEfetiva.split(':').map(num => num.padStart(2, '0'));
        const dataHoraEfetiva = `${dataEfetiva}T${hora}:${minuto}:00`;
        let dados;
        if (isMaquina) { dados = { dataSaidaEfetiva: dataHoraEfetiva, decisao: decisao, observacoes: obs || null }; }
        else if (isTransferenciaSaida) { dados = { dataSaidaEfetiva: dataHoraEfetiva, decisaoSaida: decisao, obsSaida: obs || null }; }
        else if (isTransferenciaChegada) { dados = { dataChegadaEfetiva: dataHoraEfetiva, decisaoChegada: decisao, obsChegada: obs || null }; }
        else { console.error("Tipo de item inválido no PortariaCard:", item); return; }
        onAction(item.id, dados, endpoint, item.tipoProcesso);
    };
    const getProcessLabel = () => {
        if (item.tipoProcesso === 'maquina') { return item.tipoSaida === 'Manutenção' ? 'Saída Equipamento' : 'Retorno Comodato'; }
        if (item.tipoProcesso === 'transferencia') { return `Transferência P/${item.portariaDestino || '?'}`; }
        return 'Processo';
    };
    const pdfUrl = item.pdfUrlSaida || item.pdfUrl;

    return (
        <div className={`p-4 bg-white rounded-lg shadow border mb-4 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''} ${isMaquina ? 'border-orange-400' : (isTransferenciaChegada ? 'border-green-400' : 'border-blue-400')}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3 border-b pb-2">
                <span className="text-sm font-medium text-gray-600">ID: #{item.idSequencial} ({getProcessLabel()})</span>
                <span className="text-xs font-medium text-gray-700">
                    {isMaquina && `Portaria Origem: ${item.portariaSaida || 'N/A'}`}
                    {isTransferenciaSaida && `Origem: ${item.portariaSaida} -> Destino: ${item.portariaDestino}`}
                    {isTransferenciaChegada && `Destino: ${item.portariaDestino} (Em Trânsito)`}
                </span>
            </div>
            {/* Detalhes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                 <div><strong>Solicitante:</strong> {item.solicitante || item.nomeRequisitante || '-'}</div>
                 <div><strong>NF:</strong> {item.nfSaida || item.numeroNf || '-'}</div>
                 <div><strong>Descrição/Setor:</strong> {item.descricaoMaterial || item.setor || '-'}</div>
                 <div><strong>Meio Transp.:</strong> {item.meioTransporte || '-'} {item.placaVeiculo && `(Placa: ${item.placaVeiculo})`}</div>
                 {pdfUrl && ( <div className="sm:col-span-2"> <strong>Anexo NF:</strong>{' '} <a href={`http://localhost:5000${pdfUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline"> Ver PDF </a> </div> )}
            </div>
            {/* Formulário */}
            <form className="pt-3 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 items-end">
                    <div> <label className="block text-xs font-medium text-gray-600">{isTransferenciaChegada ? 'Data Chegada' : 'Data Saída'} Efetiva *</label> <input type="date" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"/> </div>
                    <div> <label className="block text-xs font-medium text-gray-600">Hora Efetiva *</label> <input type="time" value={horaEfetiva} onChange={(e) => setHoraEfetiva(e.target.value)} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"/> </div>
                    <div> <label className="block text-xs font-medium text-gray-600">Vigilante</label> <input type="text" value={user?.nome || '...'} readOnly className="w-full mt-1 border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm p-1.5 cursor-not-allowed" /> </div>
                    <div className="sm:col-span-3"> <label className="block text-xs font-medium text-gray-600">Observações (Opcional)</label> <textarea rows="2" value={obs} onChange={(e)=> setObs(e.target.value)} className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"></textarea> </div>
                </div>
                {/* Botões */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={handleSubmit(isTransferenciaChegada ? 'Problema' : 'NaoAutorizado')} disabled={isLoading} className="px-4 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"> {isTransferenciaChegada ? 'Registrar Problema' : 'Não Autorizar/Cancelar'} </button>
                    <button type="button" onClick={handleSubmit('Aprovado')} disabled={isLoading} className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"> {isTransferenciaChegada ? 'Confirmar Chegada' : 'Confirmar Saída'} </button>
                </div>
            </form>
        </div>
    );
};


// --- Componente Principal da Página Portaria (useEffect REFEITO) ---
export default function PortariaPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // Estado para a portaria selecionada, inicializado lendo sessionStorage
  const [selectedPortaria, setSelectedPortaria] = useState(() => {
      if (typeof window !== 'undefined' && sessionStorage) {
          return sessionStorage.getItem('selectedPortaria') || '';
      }
      return '';
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // Controla o estado de carregamento dos dados da API
  const [error, setError] = useState('');
  const [loadingActionId, setLoadingActionId] = useState(null); // Para feedback visual nas ações

  // --- Efeito 1: Lida APENAS com autenticação, permissão e redirecionamento ---
  useEffect(() => {
    // Espera autenticação carregar
    if (authLoading) {
      console.log("[PortariaPage Effect 1] Aguardando autenticação...");
      return; // Sai se auth ainda está carregando
    }

    // Se terminou auth e não tem user, redireciona para login
    if (!user) {
      console.log("[PortariaPage Effect 1] Usuário não autenticado, redirecionando para login...");
      navigate('/login', { replace: true });
      return;
    }

    // Verifica permissões
    const hasPortariaPermission = user.canAccessPortariaControl;
    const isAdmin = user.canAccessAdminPanel;

    // Se não tem permissão de portaria NEM é admin, redireciona para dashboard
    if (!hasPortariaPermission && !isAdmin) {
      console.log("[PortariaPage Effect 1] Usuário sem permissão, redirecionando para dashboard...");
      navigate('/dashboard', { replace: true });
      return;
    }

    // Se for portaria (não admin), verifica se JÁ selecionou a portaria
    const portariaSalva = sessionStorage.getItem('selectedPortaria');
    if (hasPortariaPermission && !isAdmin && !portariaSalva) {
      console.log("[PortariaPage Effect 1] Usuário portaria sem seleção salva, redirecionando para /select-portaria...");
      navigate('/select-portaria', { replace: true });
      return; // Interrompe para redirecionar
    }

    // Se chegou aqui, o acesso é permitido. Atualiza o estado da portaria se necessário.
    // Isso garante que o estado `selectedPortaria` reflita o sessionStorage atual ou '' se for admin
    const currentPortariaContext = isAdmin ? '' : portariaSalva || '';
    setSelectedPortaria(prevSelected => {
        if (prevSelected !== currentPortariaContext) {
             console.log(`[PortariaPage Effect 1] Contexto da portaria definido/atualizado para: '${currentPortariaContext || 'Admin (Todas)'}'`);
            return currentPortariaContext;
        }
        return prevSelected;
    });

  // Depende do user e authLoading para reavaliar o acesso
  }, [user, authLoading, navigate]);


  // --- fetchData (MEMOIZED com useCallback) ---
  // A função em si não muda, mas é envolvida por useCallback
  const fetchData = useCallback(async (currentPortaria) => {
    // Só busca se tivermos usuário (redundante, mas seguro)
    if (!user) {
        console.warn("[fetchData] Tentativa de buscar dados sem usuário logado.");
        setLoading(false);
        setError("Autenticação necessária.");
        return;
    }

    console.log(`[fetchData] Iniciando busca para portaria: '${currentPortaria || 'Admin (Todas)'}'`);
    setLoading(true);
    setError('');
    setData([]); // Limpa dados antes da nova busca
    try {
      // Busca máquinas e transferências
      const [resMaquinas, resTransferencias] = await Promise.all([
          api.get('/maquinas'),
          api.get('/transferencias')
      ]);

      const maquinas = resMaquinas.data.map(item => ({...item, tipoProcesso: 'maquina'}));
      const transferencias = resTransferencias.data.map(item => ({...item, tipoProcesso: 'transferencia'}));
      console.log(`[fetchData] Recebido ${maquinas.length} máquinas, ${transferencias.length} transferências.`);


      // Filtra pelos status relevantes
      const allRelevant = [...maquinas, ...transferencias].filter(item => {
          const status = item.statusProcesso;
          return status === 'Aguardando Portaria' || status === 'Em andamento' || status === 'Em trânsito';
      });
      console.log(`[fetchData] ${allRelevant.length} itens com status relevante.`);

      // Filtro Final por Portaria (se não for Admin)
      let finalPending = allRelevant;
      const isAdminUser = user?.canAccessAdminPanel;

      if (!isAdminUser && currentPortaria) {
          console.log(`[fetchData] Aplicando filtro para portaria específica: ${currentPortaria}`);
          finalPending = allRelevant.filter(item => {
              // Verifica se o item pertence à portaria atual (seja origem ou destino)
              if (item.statusProcesso === 'Aguardando Portaria' || item.statusProcesso === 'Em andamento') {
                   return item.portariaSaida === currentPortaria; // Item esperando SAÍDA nesta portaria
              }
              if (item.statusProcesso === 'Em trânsito') {
                   return item.portariaDestino === currentPortaria; // Item esperando CHEGADA nesta portaria
              }
              return false; // Ignora outros status (embora já filtrados antes)
          });
      } else if (isAdminUser) {
           console.log("[fetchData] Usuário Admin, exibindo todos os itens pendentes relevantes.");
      } else if (!isAdminUser && !currentPortaria){
           console.warn("[fetchData] Usuário Portaria sem portaria selecionada, exibindo 0 itens.");
           finalPending = [];
      }

      console.log(`[fetchData] Itens finais para exibir: ${finalPending.length}`);
      setData(finalPending);

    } catch (err) {
      setError('Erro ao carregar lista de itens pendentes para a portaria.');
      console.error("Erro fetchData Portaria:", err.response || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  // useCallback depende do 'user' para saber se é admin ou não ao filtrar
  }, [user]); // Inclui 'user' como dependência do useCallback


  // --- Efeito 3: Dispara fetchData quando as condições forem atendidas ---
  useEffect(() => {
    // Não busca se auth estiver carregando ou não houver usuário
    if (authLoading || !user) {
      return;
    }

    const isAdmin = user.canAccessAdminPanel;
    // Condição para buscar: Ou é Admin, ou é Portaria E JÁ TEM uma portaria no estado
    if (isAdmin || (user.canAccessPortariaControl && selectedPortaria)) {
        console.log(`[PortariaPage Effect 3] Condições atendidas, chamando fetchData...`);
        fetchData(selectedPortaria); // Chama a função memoizada
    } else if (user.canAccessPortariaControl && !selectedPortaria) {
        console.log("[PortariaPage Effect 3] Condições NÃO atendidas (Portaria sem seleção no state), aguardando...");
        setLoading(true); // Mantém loading até `selectedPortaria` ser definido pelo Effect 1
    }

  // Dispara quando user, selectedPortaria mudam, ou quando fetchData (memoizada) é definida
  }, [user, selectedPortaria, authLoading, fetchData]);


  // handleAction: Envia header X-Selected-Portaria (sem alterações)
  const handleAction = async (id, dados, endpoint, tipoProcesso) => {
    setError('');
    const actionId = `${tipoProcesso}-${id}`;
    setLoadingActionId(actionId);
    try {
      const urlSegment = tipoProcesso === 'maquina' ? '/maquinas' : '/transferencias';
      const fullEndpoint = tipoProcesso === 'maquina' ? 'saida-portaria' : endpoint;
      const config = { headers: { 'X-Selected-Portaria': selectedPortaria || '' } };
      console.log(`[handleAction] Enviando PUT para ${urlSegment}/${id}/${fullEndpoint} com header X-Selected-Portaria: '${selectedPortaria || ''}' e dados:`, dados);
      await api.put(`${urlSegment}/${id}/${fullEndpoint}`, dados, config);
      console.log(`[handleAction] Ação ${endpoint} para ${tipoProcesso} #${id} bem-sucedida. Recarregando dados...`);
      fetchData(selectedPortaria); // Recarrega usando o estado atual
    } catch (err) {
      const errorMsg = err.response?.data?.message || `Erro ao registrar ${tipoProcesso}/${endpoint} #${id}.`;
      setError(errorMsg);
      console.error(`Erro registrar ${tipoProcesso}/${endpoint} ${id}:`, err.response?.status, err.response?.data || err);
    } finally {
      setLoadingActionId(null);
    }
  };


  // Cálculos para exibição
  const pendentesSaida = data.filter(item => item.statusProcesso === 'Aguardando Portaria' || item.statusProcesso === 'Em andamento');
  const pendentesChegada = data.filter(item => item.statusProcesso === 'Em trânsito');

  // JSX do Header
  const Header = ({ selectedPortaria }) => {
    const { user, logout } = useAuth();
    const userRole = user?.canAccessAdminPanel ? 'Admin' : (user?.canAccessPortariaControl ? 'Portaria' : 'Usuário');
    const portariaDisplay = user?.canAccessAdminPanel ? ' - Todas' : (selectedPortaria ? ` - ${selectedPortaria}` : '');
    return (
      <header className="flex items-center justify-between p-4 bg-white shadow-md">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> &larr; Voltar </Link>
          <h1 className="text-xl font-bold text-orange-800">Controle da Portaria{portariaDisplay}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{userRole}: {user?.nome}</span>
          {user?.canAccessPortariaControl && !user?.canAccessAdminPanel && (
              <Link to="/select-portaria" className="text-xs text-blue-600 hover:underline">(Trocar Portaria)</Link>
          )}
          <button onClick={logout} className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"> Sair </button>
        </div>
      </header>
    );
   };

  // Renderização Principal
   // Mostra loading se auth estiver carregando OU se fetchData estiver carregando (e não houver erro)
   if (authLoading || (loading && !error)) {
       return (
           <div className="min-h-screen bg-gray-100">
               {user && <Header selectedPortaria={selectedPortaria} />}
               <p className="text-center text-gray-500 py-10 text-lg">Carregando...</p>
           </div>
       );
   }

   // Fallback se não tiver usuário ou permissão
   if (!user || (!user.canAccessPortariaControl && !user.canAccessAdminPanel)) {
        return (
             <div className="min-h-screen bg-gray-100 p-10">
                 <p className="text-center text-red-600">Acesso negado.</p>
                 <div className="text-center mt-4">
                    <Link to="/login" className="text-blue-600 hover:underline">Ir para Login</Link>
                 </div>
             </div>
        );
   }


  return (
    <div className="min-h-screen bg-gray-100">
      <Header selectedPortaria={selectedPortaria} />
      <main className="p-4 m-4 max-w-7xl mx-auto">
         {!loading && error && <p className="text-center text-red-600 bg-red-100 p-3 rounded mb-4">{error}</p>}

        {/* Renderiza as colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA SAÍDA */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-blue-800 border-b pb-2"> Aguardando Saída ({pendentesSaida.length}) </h3>
            {!loading && pendentesSaida.length === 0 && ( <p className="text-gray-500 p-4 bg-white rounded shadow text-center italic"> Nenhum item aguardando saída {user?.canAccessAdminPanel ? 'em nenhuma portaria' : `para ${selectedPortaria || 'a portaria selecionada'}`}. </p> )}
            {!loading && pendentesSaida.map(item => ( <PortariaCard key={`${item.tipoProcesso}-${item.id}`} item={item} onAction={handleAction} loadingActionId={loadingActionId} selectedPortaria={selectedPortaria} /> ))}
          </div>
          {/* COLUNA CHEGADA */}
          <div>
            <h3 className="text-lg font-bold mb-3 text-green-800 border-b pb-2"> Aguardando Chegada ({pendentesChegada.length}) </h3>
            {!loading && pendentesChegada.length === 0 && ( <p className="text-gray-500 p-4 bg-white rounded shadow text-center italic"> Nenhuma transferência aguardando chegada {user?.canAccessAdminPanel ? 'em nenhuma portaria' : `para ${selectedPortaria || 'a portaria selecionada'}`}. </p> )}
            {!loading && pendentesChegada.map(item => ( <PortariaCard key={`${item.tipoProcesso}-${item.id}`} item={item} onAction={handleAction} loadingActionId={loadingActionId} selectedPortaria={selectedPortaria} isDestino={true} /> ))}
          </div>
        </div>
      </main>
    </div>
  );
}

