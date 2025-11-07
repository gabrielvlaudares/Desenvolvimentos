// src/pages/MaquinaDashboard.jsx
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import RetornoModal from './RetornoModal';
import MaquinaDetailsModal from './MaquinaDetailsModal';

// Função helper para formatar datas
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        // Tenta criar o objeto Date. Se falhar, retorna 'Inválida'.
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
            console.warn(`[formatDate] Data inválida recebida: ${dateString}`); // Adiciona um aviso no console
            return 'Inválida';
        }
        return format(dateObj, formatString, { locale: ptBR });
    } catch (e) {
        console.error("Erro ao formatar data:", dateString, e);
        return 'Inválida';
    }
};


// Componente para exibir a Tabela do Dashboard
export default function MaquinaDashboard({ data = [], refreshData }) {
    const { user } = useAuth(); // user agora tem as flags can...

    // Estados para Modais
    const [isRetornoModalOpen, setIsRetornoModalOpen] = useState(false);
    const [selectedItemForRetorno, setSelectedItemForRetorno] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState(null);

    // Funções para Modal de Retorno
    const handleOpenRetornoModal = (item) => { setSelectedItemForRetorno(item); setIsRetornoModalOpen(true); };
    const handleCloseRetornoModal = () => { setIsRetornoModalOpen(false); setSelectedItemForRetorno(null); };
    const handleRetornoSaveSuccess = () => {
        setIsRetornoModalOpen(false);
        setSelectedItemForRetorno(null);
        if (refreshData) {
             console.log("Retorno salvo com sucesso, atualizando dashboard...");
             refreshData();
        }
    };

    // Funções para Modal de Detalhes
    const handleOpenDetailsModal = (item) => {
        setSelectedItemForDetails(item);
        setIsDetailsModalOpen(true);
    };
    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedItemForDetails(null);
    };
    // Funções de callback para o modal chamar após update/delete
    const handleUpdateRequest = () => {
        if (refreshData) {
            console.log("Item atualizado via modal detalhes, atualizando dashboard...");
            refreshData();
        }
     };
    const handleDeleteRequest = () => {
        if (refreshData) {
            console.log("Item excluído via modal detalhes, atualizando dashboard...");
            refreshData();
        }
    };


    // --- FUNÇÃO canRegisterRetorno CORRIGIDA ---
    // Permite registrar retorno APENAS se:
    // 1. O status for 'Em Manutenção'
    // 2. O usuário estiver logado
    // 3. O usuário logado for o CRIADOR da solicitação OU for ADMIN
    const canRegisterRetorno = (item) => {
        if (item.statusProcesso !== 'Em Manutenção') return false;
        if (!user) return false;

        // Verifica se é o criador (comparando usernames) OU se tem a permissão de admin
        const isCreator = user.username === item.criadoPorUpn;
        const isAdmin = user.canAccessAdminPanel === true; // Usa a nova flag

        return isCreator || isAdmin;
     };
     // --- FIM FUNÇÃO canRegisterRetorno ---


  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-blue-800 border-b pb-2">Dashboard - Saída de Máquinas</h2>

      {/* Tabela de Dados */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">ID Seq.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tipo Saída</th>
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Gestor (Email)</th>
              <th className="px-4 py-3">Data Envio</th>
              <th className="px-4 py-3">Prazo Retorno</th>
              <th className="px-4 py-3">Saída Efetiva</th>
              <th className="px-4 py-3">Retorno Efetivo</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {/* Mensagem se não houver dados */}
            {data.length === 0 && (
              <tr><td colSpan="10" className="px-4 py-4 text-center text-gray-500 italic">Nenhuma solicitação de saída de máquina encontrada.</td></tr>
            )}
            {/* Mapeamento dos dados */}
            {data.map((saida) => (
              <tr key={saida.id} className="border-b hover:bg-gray-50 transition-colors duration-150">
                {/* ID */}
                <td className="px-4 py-2 font-medium text-gray-800">#{saida.idSequencial}</td>
                {/* Status com Badge */}
                <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                        saida.statusProcesso === 'Concluído' ? 'bg-green-100 text-green-800' :
                        saida.statusProcesso === 'Em Manutenção' ? 'bg-yellow-100 text-yellow-800' :
                        saida.statusProcesso === 'Aguardando Aprovação' ? 'bg-blue-100 text-blue-800' :
                        saida.statusProcesso === 'Aguardando Portaria' ? 'bg-orange-100 text-orange-800' :
                        saida.statusProcesso === 'Rejeitado' || saida.statusProcesso === 'Cancelado' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800' // Default
                    }`}>
                        {saida.statusProcesso}
                    </span>
                </td>
                 {/* Tipo */}
                 <td className="px-4 py-2 text-gray-600">{saida.tipoSaida || '-'}</td>
                 {/* Solicitante */}
                 <td className="px-4 py-2 text-gray-600">{saida.solicitante || '-'}</td>
                 {/* Gestor */}
                <td className="px-4 py-2 text-gray-600">{saida.gestorEmail || '-'}</td>
                 {/* Datas */}
                 <td className="px-4 py-2">{formatDate(saida.dataEnvio, false)}</td>
                 <td className="px-4 py-2">{formatDate(saida.prazoRetorno, false)}</td>
                 <td className="px-4 py-2">{formatDate(saida.dataSaidaEfetiva, true)}</td>
                 <td className="px-4 py-2">{formatDate(saida.dataRetornoEfetivo, true)}</td>

                {/* Ações */}
                 <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                    {/* Botão Detalhes */}
                    <button
                        onClick={() => handleOpenDetailsModal(saida)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-semibold transition-colors duration-150"
                        title="Ver detalhes da solicitação"
                    >
                        Detalhes
                    </button>
                    {/* Botão Registrar Retorno (Condicional) */}
                    {canRegisterRetorno(saida) && (
                        <button
                            onClick={() => handleOpenRetornoModal(saida)}
                            className="text-green-600 hover:text-green-800 hover:underline text-xs font-semibold transition-colors duration-150"
                            title="Registrar o retorno deste equipamento"
                        >
                            Registrar Retorno
                        </button>
                    )}
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       {/* Renderiza Modais Condicionalmente */}
        {isRetornoModalOpen && selectedItemForRetorno && (
            <RetornoModal
                item={selectedItemForRetorno}
                onClose={handleCloseRetornoModal}
                onSaveSuccess={handleRetornoSaveSuccess}
            />
        )}

        {isDetailsModalOpen && selectedItemForDetails && (
            <MaquinaDetailsModal
                item={selectedItemForDetails}
                onClose={handleCloseDetailsModal}
                onUpdateRequest={handleUpdateRequest}
                onDeleteRequest={handleDeleteRequest}
            />
        )}
    </div>
  );
}

