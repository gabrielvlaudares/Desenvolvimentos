// src/pages/MaquinaPortaria.jsx
import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

// Helper para formatar datas (pode vir de utils)
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString) => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR }); }
    catch (e) { return 'Inválida'; }
};

// Data/Hora atuais para preenchimento padrão
const getCurrentDate = () => new Date().toISOString().split('T')[0];
const getCurrentTime = () => new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

// --- Componente Card da Portaria ---
const PortariaCard = ({ item, onRegisterExit, loadingActionId }) => {
    const { user } = useAuth(); // Pegar nome do vigilante logado
    const [dataSaida, setDataSaida] = useState(getCurrentDate());
    const [horaSaida, setHoraSaida] = useState(getCurrentTime());
    // const [observacoes, setObservacoes] = useState(''); // Campo opcional

    const isLoading = loadingActionId === item.id;

    const handleSubmit = (e) => {
        e.preventDefault();
        const dadosSaida = {
            dataSaidaEfetiva: `${dataSaida}T${horaSaida}:00`, // Formato ISO simplificado esperado pelo backend
            vigilanteSaidaUpn: user?.username, // Incluído automaticamente pelo backend, mas podemos mandar
            // Adicionar outros campos se necessário: observacoes
        };
        onRegisterExit(item.id, dadosSaida);
    };

    return (
        <div className={`p-4 bg-white rounded-lg shadow border border-orange-300 mb-4 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Header do Card */}
            <div className="flex justify-between items-center mb-3 border-b pb-2">
                <span className="text-sm font-medium text-gray-600">ID: #{item.idSequencial} ({item.tipoSaida})</span>
                <span className="px-2 py-0.5 text-xs font-semibold text-orange-800 bg-orange-100 rounded-full">
                    {item.statusProcesso}
                </span>
            </div>

            {/* Detalhes Rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                <div><strong>Solicitante:</strong> {item.solicitante || '-'}</div>
                <div><strong>Gestor Aprov.:</strong> {item.gestorAprovadorUpn || '-'} ({formatDate(item.dataAprovacao)})</div>
                <div className="sm:col-span-2"><strong>Descrição:</strong> {item.descricaoMaterial || '-'}</div>
                {item.nfSaida && <div><strong>NF Saída:</strong> {item.nfSaida}</div>}
                 {item.pdfUrlSaida && (
                    <div><strong>Anexo NF:</strong> <a href={`http://localhost:5000${item.pdfUrlSaida}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver PDF</a></div>
                 )}
            </div>

            {/* Formulário de Saída */}
            <form onSubmit={handleSubmit} className="pt-3 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Data Saída Efetiva</label>
                        <input
                            type="date"
                            value={dataSaida}
                            onChange={(e) => setDataSaida(e.target.value)}
                            required
                            className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Hora Saída Efetiva</label>
                        <input
                            type="time"
                            value={horaSaida}
                            onChange={(e) => setHoraSaida(e.target.value)}
                            required
                            className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-medium text-gray-600">Vigilante</label>
                         <input type="text" value={user?.nome || 'Desconhecido'} readOnly className="w-full mt-1 border-gray-300 rounded-md shadow-sm bg-gray-100 sm:text-sm p-1.5 cursor-not-allowed" />
                    </div>
                     {/* Campo Observações (Opcional) */}
                     {/* <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-gray-600">Observações (Opcional)</label>
                        <textarea rows="2" value={observacoes} onChange={(e)=> setObservacoes(e.target.value)} className="w-full mt-1 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5"></textarea>
                    </div> */}
                </div>
                <div className="flex justify-end">
                     <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Registando...' : 'Confirmar Saída'}
                    </button>
                </div>
            </form>
        </div>
    );
};


// --- Componente Principal da Aba da Portaria ---
export default function MaquinaPortaria({ data = [], refreshData }) {
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [error, setError] = useState('');

  const handleRegisterExit = async (id, dadosSaida) => {
    setError('');
    setLoadingActionId(id);
    try {
      await api.put(`/maquinas/${id}/saida-portaria`, dadosSaida);
      refreshData(); // Recarrega a lista
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao registrar saída na portaria.');
      console.error("Erro registrar saida:", err.response || err);
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto"> {/* Centraliza e limita largura */}
      <h2 className="text-xl font-semibold mb-4 text-orange-800">Controle da Portaria - Saídas Pendentes</h2>

      {error && <p className="text-sm text-center text-red-600 mb-3 bg-red-100 p-2 rounded">{error}</p>}

      {data.length === 0 && (
        <div className="p-4 bg-white rounded-lg shadow border border-gray-200 text-center text-gray-500">
          Nenhuma saída aguardando liberação na portaria no momento.
        </div>
      )}

      {data.map(item => (
        <PortariaCard
          key={item.id}
          item={item}
          onRegisterExit={handleRegisterExit}
          loadingActionId={loadingActionId}
        />
      ))}
    </div>
  );
}