// src/pages/TransferenciaPortaria.jsx
import React, { useState } from 'react';
import api from '../services/api'; //
import { useAuth } from '../hooks/useAuth'; //

// Helper de formatação de data/hora (pode vir de utils)
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString, includeTime = true) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        return format(new Date(dateString), formatString, { locale: ptBR });
    } catch (e) { return 'Inválida'; }
};

// Data/Hora atuais para preenchimento padrão
const getCurrentDate = () => new Date().toISOString().split('T')[0];
const getCurrentTime = () => new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

// --- Componente Card para Registar SAÍDA ou CHEGADA ---
const PortariaCard = ({ item, onAction, loadingActionId, selectedPortaria, isDestino = false }) => {
    const { user } = useAuth();
    const [dataEfetiva, setDataEfetiva] = useState(getCurrentDate());
    const [horaEfetiva, setHoraEfetiva] = useState(getCurrentTime());
    const [obs, setObs] = useState('');

    const isLoading = loadingActionId === item.id;
    // Determina o endpoint correto: 'saida' ou 'chegada'
    const actionEndpoint = isDestino ? 'chegada' : 'saida';

    const handleSubmit = (decisao) => (e) => {
        e.preventDefault();
        const dataHoraEfetiva = `${dataEfetiva}T${horaEfetiva}:00`;

        const dados = {
            // Campos de Saída
            dataSaidaEfetiva: !isDestino ? dataHoraEfetiva : undefined,
            decisaoSaida: !isDestino ? decisao : undefined,
            obsSaida: !isDestino ? obs : undefined,
            // Campos de Chegada
            dataChegadaEfetiva: isDestino ? dataHoraEfetiva : undefined,
            decisaoChegada: isDestino ? decisao : undefined,
            obsChegada: isDestino ? obs : undefined,
        };
        // Chama a função do pai para executar a API
        onAction(item.id, dados, actionEndpoint);
    };

    return (
        <div className={`p-4 bg-white rounded-lg shadow border mb-4 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''} ${isDestino ? 'border-green-400' : 'border-blue-400'}`}>
            <div className="flex justify-between items-center mb-3 border-b pb-2">
                <span className="text-sm font-medium text-gray-600">NF: {item.numeroNf} | ID: #{item.idSequencial}</span>
                <span className="text-xs font-medium text-gray-700">
                    {isDestino ? `Destino: ${item.portariaDestino}` : `Origem: ${item.portariaSaida}`}
                </span>
            </div>
            {/* Detalhes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                 <div><strong>Requisitante:</strong> {item.nomeRequisitante || '-'}</div>
                 <div><strong>Solicitado:</strong> {formatDate(item.dataSaidaSolicitada, true)}</div>
                 <div className="sm:col-span-2"><strong>Meio de Transp.:</strong> {item.meioTransporte || '-'} {item.placaVeiculo && `(Placa: ${item.placaVeiculo})`}</div>
                 {item.pdfUrl && <div className="sm:col-span-2"><strong>Anexo NF:</strong> <a href={`http://localhost:5000${item.pdfUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver PDF</a></div>}
            </div>

            {/* Formulário de Ação */}
            <form className="pt-3 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">{isDestino ? 'Data Chegada' : 'Data Saída'} Efetiva</label>
                        <input type="date" value={dataEfetiva} onChange={(e) => setDataEfetiva(e.target.value)} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Hora Efetiva</label>
                        <input type="time" value={horaEfetiva} onChange={(e) => setHoraEfetiva(e.target.value)} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"/>
                    </div>
                     <div>
                        <label className="block text-xs font-medium text-gray-600">Vigilante</label>
                         <input type="text" value={user?.nome || '...'} readOnly className="w-full mt-1 border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm p-1.5 cursor-not-allowed" />
                    </div>
                    <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-gray-600">Observações (Opcional)</label>
                        <textarea rows="2" value={obs} onChange={(e)=> setObs(e.target.value)} className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"></textarea>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    {/* Botão de Cancelar/Registrar Problema */}
                    <button onClick={handleSubmit(isDestino ? 'Problema' : 'NaoAutorizado')} className="px-4 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                        {isDestino ? 'Registrar Problema' : 'Não Autorizar Saída'}
                    </button>

                    {/* Botão de Confirmação */}
                     <button onClick={handleSubmit('Aprovado')} className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                        {isDestino ? 'Confirmar Chegada' : 'Confirmar Saída'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- Componente Principal da Aba de Portaria (Transferências) ---
export default function TransferenciaPortaria({ data = [], refreshData }) {
    const { user } = useAuth();
    // Portaria selecionada (vazia se for Admin)
    const selectedPortaria = sessionStorage.getItem('selectedPortaria') || ''; 

    const [loadingActionId, setLoadingActionId] = useState(null);
    const [error, setError] = useState('');

    // --- Lógica de Filtro (Frontend) ---
    const pendentesSaida = data.filter(item =>
        item.statusProcesso === 'Em andamento' &&
        (user?.isAdmin || item.portariaSaida === selectedPortaria) // Filtra pela origem
    );

    const pendentesChegada = data.filter(item =>
        item.statusProcesso === 'Em trânsito' &&
        (user?.isAdmin || item.portariaDestino === selectedPortaria) // Filtra pelo destino
    );

    // Função de ação unificada para Saída ou Chegada
    const handlePortariaAction = async (id, dados, endpoint) => {
        setError('');
        setLoadingActionId(id);
        try {
            await api.put(`/transferencias/${id}/${endpoint}`, dados); //
            refreshData(); // Recarrega a lista
        } catch (err) {
            setError(err.response?.data?.message || `Erro ao registar ${endpoint}.`);
            console.error(`Erro registar ${endpoint}:`, err.response || err);
        } finally {
            setLoadingActionId(null);
        }
    };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-purple-800">Controle Portaria: {user?.isAdmin ? 'Todas as Fábricas' : selectedPortaria}</h2>

      {error && <p className="text-sm text-center text-red-600 mb-3 bg-red-100 p-2 rounded">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- COLUNA SAÍDA (ORIGEM) --- */}
        <div>
          <h3 className="text-lg font-bold mb-3 text-blue-800 border-b pb-2">
            Aguardando Saída ({pendentesSaida.length})
          </h3>
          {pendentesSaida.length === 0 && <p className="text-gray-500 p-4 bg-white rounded shadow">Nenhuma transferência aguardando saída {user?.isAdmin ? '' : `para ${selectedPortaria}`}.</p>}
          {pendentesSaida.map(item => (
            <PortariaCard
                key={item.id}
                item={item}
                onAction={handlePortariaAction}
                loadingActionId={loadingActionId}
                selectedPortaria={selectedPortaria}
                isDestino={false}
            />
          ))}
        </div>

        {/* --- COLUNA CHEGADA (DESTINO) --- */}
        <div>
          <h3 className="text-lg font-bold mb-3 text-green-800 border-b pb-2">
            Aguardando Chegada ({pendentesChegada.length})
          </h3>
          {pendentesChegada.length === 0 && <p className="text-gray-500 p-4 bg-white rounded shadow">Nenhuma transferência em trânsito com destino a {user?.isAdmin ? 'esta fábrica' : selectedPortaria}.</p>}
          {pendentesChegada.map(item => (
            <PortariaCard
                key={item.id}
                item={item}
                onAction={handlePortariaAction}
                loadingActionId={loadingActionId}
                selectedPortaria={selectedPortaria}
                isDestino={true} // Passa flag para mudar botões e labels (e endpoint)
            />
          ))}
        </div>
      </div>
    </div>
  );
}