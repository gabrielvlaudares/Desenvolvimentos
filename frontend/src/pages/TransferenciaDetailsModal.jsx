// src/pages/TransferenciaDetailsModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth'; //
import api from '../services/api'; //

// Opções
const portarias = ['P1', 'P3', 'P4', 'P5', 'P7', 'P8', 'P10', 'PCD']; //
const meiosTransporte = ['PEDESTRE', 'TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'MOTOBOY', 'CARRO PARTICULAR']; //

// Helper de formatação de data
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        const dateObj = new Date(dateString); 
        return format(dateObj, formatString, { locale: ptBR });
    } catch (e) { return 'Inválida'; }
};

// Helper de conversão para formato HTML (YYYY-MM-DDTHH:MM)
const toHtmlDateTime = (isoString) => {
    if (!isoString) return '';
    try {
        // new Date().toISOString() retorna YYYY-MM-DDTHH:MM:SS.sssZ
        // Substring(0, 16) recorta exatamente para YYYY-MM-DDTHH:MM
        return new Date(isoString).toISOString().substring(0, 16);
    } catch (e) {
        return '';
    }
};


export default function TransferenciaDetailsModal({ item, onClose, onUpdateRequest, onDeleteRequest }) {
    const { user } = useAuth(); //
    const [isEditing, setIsEditing] = useState(false);
    
    // Inicializa o formData com a data/hora no formato compatível com input type="datetime-local"
    const [formData, setFormData] = useState({
        ...item,
        dataSaidaSolicitada: toHtmlDateTime(item.dataSaidaSolicitada),
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // CONDIÇÃO DE EDIÇÃO/EXCLUSÃO (SÓ se o status for 'Em andamento' E o criador for o usuário ou Admin)
    const canEditOrDelete = item.statusProcesso === 'Em andamento' &&
                            user && (user.isAdmin || user.username === item.criadoPorUpn);
    
    // Verifica se os campos de veículo devem ser exibidos/validados
    const isVehicleTransport = ['TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'CARRO PARTICULAR', 'MOTOBOY'].includes((isEditing ? formData.meioTransporte : item.meioTransporte)?.toUpperCase());

    const editableFields = [
        'portariaSaida', 'portariaDestino', 'numeroNf', 'meioTransporte', 'tipoCarro', 
        'placaVeiculo', 'nomeTransportador', 'setor', 'gestor', 'dataSaidaSolicitada'
    ];

    const handleEditToggle = () => {
        if (!canEditOrDelete) return;
        setIsEditing(!isEditing);
        // Reseta o form para os dados originais ao entrar/sair da edição
        setFormData({
            ...item,
            dataSaidaSolicitada: toHtmlDateTime(item.dataSaidaSolicitada),
        });
        setError('');
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseInt(value, 10) || 1) : value,
        }));
        setError('');

        // Atualiza campos de veículo se o transporte mudar
        if (name === 'meioTransporte') {
            const needsVehicle = meiosTransporte.includes(value.toUpperCase());
            if (!needsVehicle) {
                setFormData(prev => ({ ...prev, tipoCarro: '', placaVeiculo: '' }));
            }
        }
    };

    const handleSaveChanges = async () => {
        setError('');
        setLoading(true);

        // 1. Validações
        const needsVehicle = ['TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'CARRO PARTICULAR', 'MOTOBOY'].includes(formData.meioTransporte?.toUpperCase());
         if (needsVehicle && (!formData.tipoCarro || !formData.placaVeiculo)) {
            // CORREÇÃO: String fechada corretamente
            setError('Tipo e Placa do Veículo são obrigatórios para este meio de transporte.'); 
            setLoading(false); return;
        }

        // 2. Prepara dados para o backend
        const dataToUpdate = {};
        editableFields.forEach(field => {
             dataToUpdate[field] = formData[field] || null;
        });

        // 3. Converte a data/hora para o formato ISO completo (YYYY-MM-DDTHH:MM:SSZ)
        if (dataToUpdate.dataSaidaSolicitada) {
             // O input datetime-local fornece YYYY-MM-DDTHH:MM. Adicionamos ':00Z' para torná-lo ISO válido.
            dataToUpdate.dataSaidaSolicitada = `${dataToUpdate.dataSaidaSolicitada}:00Z`;
        }
        
        // 4. Trata campos condicionais
        if (!needsVehicle) {
            dataToUpdate.tipoCarro = null;
            dataToUpdate.placaVeiculo = null;
        }

        try {
            // Remove dados que o backend não deve processar
            delete dataToUpdate.id; delete dataToUpdate.processoId; delete dataToUpdate.idSequencial; delete dataToUpdate.statusProcesso;

            // Chama a API de update (PUT /api/transferencias/:id)
            await api.put(`/transferencias/${item.id}`, dataToUpdate);
            onUpdateRequest(); // Recarrega a lista
            onClose(); // Fecha o modal
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao salvar alterações.');
            console.error("Erro update Transferencia:", err.response || err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setError('');
        if (!canEditOrDelete) return;

        if (window.confirm(`Tem a certeza que deseja EXCLUIR a Transferência #${item.idSequencial}? Esta ação é irreversível.`)) {
            setLoading(true);
            try {
                // Chama a API de delete (DELETE /api/transferencias/:id)
                await api.delete(`/transferencias/${item.id}`);
                onDeleteRequest(); // Recarrega a lista
                onClose(); // Fecha o modal
            } catch (err) {
                 setError(err.response?.data?.message || 'Erro ao excluir solicitação.');
                 console.error("Erro delete Transferencia:", err.response || err);
            } finally {
                setLoading(false);
            }
        }
    };

    // Helper para renderizar campos (editável ou não)
    const renderField = (label, fieldName, type = 'text', options = null, span = 1) => {
        const displayValue = item[fieldName];
        const isEditable = isEditing && editableFields.includes(fieldName);
        const isDateField = type === 'datetime-local' || type === 'date';

        if (isEditable) {
             const isSelect = type === 'select';
             const isTextArea = type === 'textarea';
            
             // Lógica condicional para campos de veículo (só visível/requerido se o transporte for veículo)
             const isVehicleField = fieldName === 'tipoCarro' || fieldName === 'placaVeiculo';
            
             if (isVehicleField && !isVehicleTransport && isEditing) {
                 return null; // Oculta campo de veículo se não for transporte veicular
             }
             if (isVehicleField && !isVehicleTransport && !isEditing) {
                 return null; // Oculta campo de veículo se não for transporte veicular
             }


             if (isSelect) {
                return (
                    <div className={`sm:col-span-${span}`}>
                        <label className="block text-xs font-medium text-gray-500">{label}</label>
                        <select
                            name={fieldName}
                            value={formData[fieldName] || ''}
                            onChange={handleChange}
                            required={fieldName !== 'nomeTransportador'}
                            className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="">{fieldName.includes('portaria') ? 'Selecione...' : '-'}</option>
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                 );
             }
             if (isTextArea) {
                 return (
                    <div className={`sm:col-span-${span}`}>
                        <label className="block text-xs font-medium text-gray-500">{label}</label>
                        <textarea name={fieldName} value={formData[fieldName] || ''} onChange={handleChange} rows="3" className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"></textarea>
                    </div>
                 );
             }
            
            // Renderiza inputs normais (date/text/datetime-local)
            
            return (
                 <div className={`sm:col-span-${span}`}>
                    <label className="block text-xs font-medium text-gray-500">
                        {label} {isVehicleField && isVehicleTransport ? '*' : ''}
                    </label>
                    <input
                        type={type}
                        name={fieldName}
                        value={isDateField ? (formData[fieldName] || '') : (formData[fieldName] || '')}
                        onChange={handleChange}
                        required={!isVehicleField && fieldName !== 'nomeTransportador'}
                        readOnly={fieldName === 'nomeRequisitante'}
                        className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>
            );

        } else {
            // Modo Apenas Leitura
            if (fieldName === 'tipoCarro' || fieldName === 'placaVeiculo') {
                 if (!isVehicleTransport) return null; // Oculta se não foi transporte veicular
            }
             if (fieldName.toLowerCase().includes('obs')) { span = 3; } // Expande observações

            return (
                <div className={`sm:col-span-${span}`}>
                    <span className="block text-xs font-medium text-gray-500">{label}</span>
                    <span className="text-sm text-gray-800 break-words">
                        {isDateField ? formatDate(displayValue, true) : (displayValue || '-')}
                    </span>
                </div>
            );
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header do Modal */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        Detalhes da Transferência #{item.idSequencial}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>

                {/* Corpo do Modal */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {error && <p className="text-sm text-center text-red-600 mt-2">{error}</p>}
                    
                    {/* Status e Ações */}
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                         <span className={`text-sm font-semibold`}>
                             Status Atual: {item.statusProcesso}
                         </span>
                         {canEditOrDelete && !isEditing && (
                              <button onClick={handleEditToggle} className="px-3 py-1 text-xs text-white bg-purple-600 rounded-md hover:bg-purple-700">
                                 Editar Solicitação
                              </button>
                         )}
                         {isEditing && (
                             <div className='flex gap-3'>
                                 <button onClick={handleEditToggle} className="px-3 py-1 text-xs text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                                    Cancelar Edição
                                 </button>
                                  <button onClick={handleSaveChanges} disabled={loading} className="px-3 py-1 text-xs text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                                     {loading ? 'A guardar...' : 'Salvar Alterações'}
                                 </button>
                             </div>
                         )}
                    </div>

                    {/* Grid de Detalhes / Edição */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        {renderField('Status', 'statusProcesso')}
                        {renderField('NF', 'numeroNf')}
                        {renderField('Setor', 'setor')}
                        {renderField('Gestor', 'gestor')}
                        {renderField('Portaria Origem', 'portariaSaida', 'select', portarias)}
                        {renderField('Portaria Destino', 'portariaDestino', 'select', portarias)}
                        {renderField('Data Saída Solicitada', 'dataSaidaSolicitada', 'datetime-local', null, 3)}
                        {renderField('Requisitante', 'nomeRequisitante')}
                        {renderField('Meio de Transporte', 'meioTransporte', 'select', meiosTransporte)}
                        
                        {/* Campos Condicionais de Veículo */}
                        {isVehicleTransport && renderField('Tipo Carro', 'tipoCarro')}
                        {isVehicleTransport && renderField('Placa Veículo', 'placaVeiculo')}
                        {renderField('Nome Transportador', 'nomeTransportador')}

                        {/* Informações de Etapas do Processo (SÓ LEITURA) */}
                         <div className="sm:col-span-3 border-t pt-2 mt-4">
                            <h3 className='text-md font-semibold text-gray-700 mb-1'>Rastreamento do Processo</h3>
                         </div>
                        
                        {renderField('Lib. Saída (Vigilante)', 'vigilanteSaidaUpn')}
                        {renderField('Data Saída Efetiva', 'dataSaidaEfetiva', 'date')}
                        {renderField('Decisão Saída', 'decisaoSaida')}
                        {renderField('Obs. Saída', 'obsSaida')}
                        
                        {renderField('Lib. Chegada (Vigilante)', 'vigilanteChegadaUpn')}
                        {renderField('Data Chegada Efetiva', 'dataChegadaEfetiva', 'date')}
                        {renderField('Decisão Chegada', 'decisaoChegada')}
                        {renderField('Obs. Chegada', 'obsChegada')}

                        {/* Links PDF */}
                         {item.pdfUrl && <div className="lg:col-span-1"><span className="block text-xs font-medium text-gray-500">NF (Anexo)</span><a href={`http://localhost:5000${item.pdfUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Ver PDF</a></div>}

                    </div>
                </div>

                {/* Footer do Modal com Ações Condicionais */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-50 rounded-b-lg">
                   <div>
                       {/* Botão Excluir (condicional) */}
                       {canEditOrDelete && !isEditing && (
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50"
                            >
                                Excluir Solicitação
                            </button>
                       )}
                   </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}