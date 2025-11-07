// src/pages/TransferenciaDashboard.jsx
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Importa o novo Modal de Detalhes
import TransferenciaDetailsModal from './TransferenciaDetailsModal'; 

// Função helper para formatar datas (sem alteração)
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        let dateObj = dateString.endsWith('Z') ? new Date(dateString) : new Date(dateString);
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        return format(dateObj, formatString, { locale: ptBR });
    } catch (e) {
        console.error("Erro ao formatar data:", dateString, e);
        return 'Inválida';
    }
};

// Componente para exibir a Tabela do Dashboard de Transferências
export default function TransferenciaDashboard({ data = [], refreshData }) {

    // Estados para Modais
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false); 
    const [selectedItemForDetails, setSelectedItemForDetails] = useState(null); 

    // --- Funções para Modal de Detalhes ---
    const handleOpenDetailsModal = (item) => {
        setSelectedItemForDetails(item);
        setIsDetailsModalOpen(true);
    };
    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedItemForDetails(null);
    };
    // Funções de callback para o modal chamar após update/delete
    const handleUpdateRequest = () => { if (refreshData) refreshData(); };
    const handleDeleteRequest = () => { if (refreshData) refreshData(); };
    // --- FIM NOVAS Funções ---

    const filteredData = data; 

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">Dashboard - Transferências</h2>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
            <tr>
              <th className="px-4 py-3">ID Seq.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">NF / Setor</th>
              <th className="px-4 py-3">Requisitante</th>
              <th className="px-4 py-3">Origem / Destino</th>
              <th className="px-4 py-3">Saída Solicit.</th>
              <th className="px-4 py-3">Saída Efet.</th>
              <th className="px-4 py-3">Chegada Efet.</th>
              <th className="px-4 py-3">Transporte</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 && (
              <tr><td colSpan="10" className="px-4 py-4 text-center text-gray-500">Nenhuma transferência encontrada.</td></tr>
            )}
            {filteredData.map((transf) => (
              <tr key={transf.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">#{transf.idSequencial}</td>
                <td className="px-4 py-2">
                  {/* Badge de Status */}
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        transf.statusProcesso === 'Concluído' ? 'bg-green-100 text-green-800' :
                        transf.statusProcesso === 'Em trânsito' ? 'bg-blue-100 text-blue-800' :
                        transf.statusProcesso === 'Em andamento' ? 'bg-yellow-100 text-yellow-800' :
                        transf.statusProcesso === 'Cancelado' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {transf.statusProcesso}
                  </span>
                </td>
                <td className="px-4 py-2">
                    {transf.numeroNf || '-'}
                    <div className="text-xs text-gray-500">{transf.setor || '-'}</div>
                </td>
                <td className="px-4 py-2">{transf.nomeRequisitante || '-'}</td>
                <td className="px-4 py-2">
                    <span className='font-medium'>{transf.portariaSaida || '-'}</span>
                    <span className='text-gray-500'> &rarr; </span>
                    <span className='font-medium'>{transf.portariaDestino || '-'}</span>
                </td>
                <td className="px-4 py-2">{formatDate(transf.dataSaidaSolicitada, true)}</td>
                <td className="px-4 py-2">{formatDate(transf.dataSaidaEfetiva, true)}</td>
                <td className="px-4 py-2">{formatDate(transf.dataChegadaEfetiva, true)}</td>
                <td className="px-4 py-2 text-xs">{transf.meioTransporte || '-'}</td>
                 <td className="px-4 py-2">
                    {/* Botão de Detalhes (agora abre o modal) */}
                    <button 
                        onClick={() => handleOpenDetailsModal(transf)}
                        className="text-purple-600 hover:underline text-xs font-semibold"
                    >
                        Detalhes
                    </button>
                    {/* Ações como Cancelar/Excluir (se aplicável, para o criador) virão aqui */}
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        {/* Renderiza Modal de Detalhes Condicionalmente */}
        {isDetailsModalOpen && selectedItemForDetails && (
            <TransferenciaDetailsModal
                item={selectedItemForDetails}
                onClose={handleCloseDetailsModal}
                onUpdateRequest={handleUpdateRequest}
                onDeleteRequest={handleDeleteRequest}
            />
        )}
    </div>
  );
}