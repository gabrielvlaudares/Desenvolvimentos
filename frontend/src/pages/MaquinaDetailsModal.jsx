// src/pages/MaquinaDetailsModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// Helper de formatação de data (pode vir de utils)
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return '-';
    try {
        const formatString = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
        return format(new Date(dateString), formatString, { locale: ptBR });
    } catch (e) { return 'Inválida'; }
};

export default function MaquinaDetailsModal({ item, onClose, onUpdateRequest, onDeleteRequest }) {
    const { user } = useAuth(); // Para verificar permissões de edição/exclusão
    const [isEditing, setIsEditing] = useState(false); // Controla se o form de edição está ativo
    const [formData, setFormData] = useState({...item}); // Estado para edição
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Verifica se a edição/exclusão são permitidas
    // Regra: Status 'Aguardando Aprovação' E (usuário é Admin OU usuário é quem criou)
    const canEditOrDelete = item.statusProcesso === 'Aguardando Aprovação' &&
                            user && (user.isAdmin || user.username === item.criadoPorUpn);

    // Campos que podem ser editados (adapte conforme necessário)
    const editableFields = [
        'tipoSaida', 'areaResponsavel', 'gestorEmail', 'descricaoMaterial',
        'quantidade', 'motivoSaida', 'dataEnvio', 'prazoRetorno',
        'portariaSaida', 'nfSaida'
    ];

    const handleEditToggle = () => {
        if (!canEditOrDelete) return; // Segurança extra
        setIsEditing(!isEditing);
        setFormData({...item}); // Reseta o form para os dados originais ao entrar/sair da edição
        setError('');
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseInt(value, 10) || 1) : value,
        }));
         // Limpa prazo se mudar para Comodato
        if (name === 'tipoSaida' && value === 'Comodato') {
            setFormData(prev => ({ ...prev, prazoRetorno: '' }));
        }
        setError('');
    };

    const handleSaveChanges = async () => {
        setError('');
        setLoading(true);

        // Validações
        if (formData.tipoSaida === 'Manutenção' && !formData.prazoRetorno) {
             setError('Prazo de Retorno obrigatório para Manutenção.'); setLoading(false); return;
        }
        if (formData.quantidade < 1) {
             setError('Quantidade deve ser >= 1.'); setLoading(false); return;
        }

        // Prepara dados SÓ dos campos editáveis
        const dataToUpdate = {};
        editableFields.forEach(field => {
             // Trata caso especial de prazoRetorno para Comodato
             if (field === 'prazoRetorno' && formData.tipoSaida !== 'Manutenção') {
                 dataToUpdate[field] = null;
             } else {
                 // Converte datas para Date se necessário (ou o backend trata)
                 if (field === 'dataEnvio' || field === 'prazoRetorno') {
                      dataToUpdate[field] = formData[field] ? new Date(formData[field]).toISOString() : null;
                 } else if (field === 'quantidade') {
                     dataToUpdate[field] = parseInt(formData[field], 10);
                 } else {
                     dataToUpdate[field] = formData[field] || null; // Envia null se vazio
                 }
             }
        });

        console.log("Dados para atualizar:", dataToUpdate);

        try {
            // Chama a API de update (que criaremos no backend)
            await api.put(`/maquinas/${item.id}`, dataToUpdate);
            onUpdateRequest(); // Callback para o pai recarregar dados
            setIsEditing(false); // Sai do modo de edição
            onClose(); // Fecha o modal
        } catch (err) {
            setError(err.response?.data?.message || 'Erro ao salvar alterações.');
            console.error("Erro update Maquina:", err.response || err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setError('');
        if (!canEditOrDelete) return;

        if (window.confirm(`Tem a certeza que deseja EXCLUIR a solicitação #${item.idSequencial}? Esta ação não pode ser desfeita.`)) {
            setLoading(true);
            try {
                // Chama a API de delete (que criaremos no backend)
                await api.delete(`/maquinas/${item.id}`);
                onDeleteRequest(); // Callback para o pai recarregar dados
                onClose(); // Fecha o modal
            } catch (err) {
                 setError(err.response?.data?.message || 'Erro ao excluir solicitação.');
                 console.error("Erro delete Maquina:", err.response || err);
            } finally {
                setLoading(false);
            }
        }
    };

    // Helper para renderizar campos (editável ou não)
    const renderField = (label, fieldName, type = 'text', options = null) => {
        if (isEditing && editableFields.includes(fieldName)) {
            if (type === 'select') {
                return (
                    <div>
                        <label className="block text-xs font-medium text-gray-500">{label}{fieldName === 'tipoSaida' ? ' *' : ''}</label>
                        <select
                            name={fieldName}
                            value={formData[fieldName] || ''}
                            onChange={handleChange}
                            required={fieldName === 'tipoSaida'}
                            className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                );
            }
             if (type === 'textarea') {
                 return (
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-500">{label} *</label>
                        <textarea
                            name={fieldName}
                            value={formData[fieldName] || ''}
                            onChange={handleChange}
                            required
                            rows="3"
                            className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"
                        ></textarea>
                    </div>
                 );
             }
            // Lógica especial para data de retorno (só visível/obrigatório se Manutenção)
             if (fieldName === 'prazoRetorno' && formData.tipoSaida !== 'Manutenção') {
                 return null; // Oculta o campo se não for manutenção
             }

            return (
                 <div>
                    <label className="block text-xs font-medium text-gray-500">
                        {label} {(fieldName !== 'nfSaida' && fieldName !== 'portariaSaida') ? '*' : ''}
                        {fieldName === 'prazoRetorno' ? ' (Manutenção)' : ''}
                    </label>
                    <input
                        type={type}
                        name={fieldName}
                        value={type === 'date' ? (formData[fieldName]?.split('T')[0] || '') : (formData[fieldName] || '')}
                        onChange={handleChange}
                        required={fieldName !== 'nfSaida' && fieldName !== 'portariaSaida' && (fieldName !== 'prazoRetorno' || formData.tipoSaida === 'Manutenção')}
                        min={type === 'number' ? 1 : (fieldName === 'prazoRetorno' ? formData.dataEnvio?.split('T')[0] : undefined)} // Validação mínima para quantidade e data
                        className="w-full mt-0.5 border-gray-300 rounded-md shadow-sm sm:text-sm p-1.5 focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>
            );
        } else {
            // Modo Apenas Leitura
            let displayValue = item[fieldName];
            if (type === 'date' || fieldName.toLowerCase().includes('data')) {
                displayValue = formatDate(item[fieldName]);
            }
            // Trata valores nulos ou vazios
            displayValue = displayValue || '-';

            // Oculta prazo de retorno se não for manutenção
            if (fieldName === 'prazoRetorno' && item.tipoSaida !== 'Manutenção') {
                return null;
            }

            return (
                <div>
                    <span className="block text-xs font-medium text-gray-500">{label}</span>
                    <span className="text-sm text-gray-800 break-words">{displayValue}</span>
                </div>
            );
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header do Modal */}
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        Detalhes da Solicitação #{item.idSequencial}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>

                {/* Corpo do Modal */}
                <div className="p-4 space-y-4 overflow-y-auto">
                    {/* Grid para exibir/editar os detalhes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        {/* Renderiza campos usando o helper */}
                        {renderField('Status', 'statusProcesso')}
                        {renderField('Tipo de Saída', 'tipoSaida', 'select', ['Manutenção', 'Comodato'])}
                        {renderField('Solicitante', 'solicitante')}
                        {renderField('Área Responsável', 'areaResponsavel')}
                        {renderField('E-mail Gestor', 'gestorEmail', 'email')}
                        {/* Campos de Aprovação/Rejeição (somente leitura) */}
                        {item.gestorAprovadorUpn && renderField('Aprovado/Rejeitado por', 'gestorAprovadorUpn')}
                        {item.dataAprovacao && renderField('Data Aprovação/Rejeição', 'dataAprovacao', 'date')}
                        {item.motivoRejeicao && renderField('Motivo Rejeição', 'motivoRejeicao')}

                         {/* Linha completa para Descrição e Motivo */}
                         {isEditing && (
                             <>
                                {renderField('Descrição Material', 'descricaoMaterial', 'textarea')}
                                {renderField('Motivo Saída', 'motivoSaida', 'textarea')}
                             </>
                         )}
                         {!isEditing && (
                             <>
                                <div className="sm:col-span-2 lg:col-span-3">{renderField('Descrição Material', 'descricaoMaterial')}</div>
                                <div className="sm:col-span-2 lg:col-span-3">{renderField('Motivo Saída', 'motivoSaida')}</div>
                             </>
                         )}


                        {renderField('Quantidade', 'quantidade', 'number')}
                        {renderField('Data Envio', 'dataEnvio', 'date')}
                        {renderField('Prazo Retorno', 'prazoRetorno', 'date')}
                        {renderField('Portaria Saída', 'portariaSaida', 'select', [''].concat(['P1', 'P3', 'P4', 'P5', 'P7', 'P8', 'P10', 'PCD']))} {/* Inclui opção vazia */}
                        {renderField('NF Saída', 'nfSaida')}

                        {/* Campos de Saída Portaria (somente leitura) */}
                        {item.vigilanteSaidaUpn && renderField('Lib. Portaria por', 'vigilanteSaidaUpn')}
                        {item.dataSaidaEfetiva && renderField('Data Saída Efetiva', 'dataSaidaEfetiva', 'date')}
                        {item.observacoes && renderField('Obs. Portaria Saída', 'observacoes')}

                        {/* Campos de Retorno (somente leitura) */}
                         {item.retornoConfirmadoPorUpn && renderField('Retorno Confirmado por', 'retornoConfirmadoPorUpn')}
                        {item.dataRetornoEfetivo && renderField('Data Retorno Efetiva', 'dataRetornoEfetivo', 'date')}
                        {item.nfRetorno && renderField('NF Retorno', 'nfRetorno')}
                        {item.observacoesRetorno && renderField('Obs. Retorno', 'observacoesRetorno')}

                        {/* Links PDF (sempre visíveis se existirem) */}
                         {item.pdfUrlSaida && <div className="lg:col-span-1"><span className="block text-xs font-medium text-gray-500">NF Saída (Anexo)</span><a href={`http://localhost:5000${item.pdfUrlSaida}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Ver PDF</a></div>}
                         {item.pdfUrlRetorno && <div className="lg:col-span-1"><span className="block text-xs font-medium text-gray-500">NF Retorno (Anexo)</span><a href={`http://localhost:5000${item.pdfUrlRetorno}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Ver PDF</a></div>}

                    </div>

                     {/* Mensagem de erro durante edição */}
                    {error && <p className="text-sm text-center text-red-600 mt-2">{error}</p>}
                </div>

                {/* Footer do Modal com Ações Condicionais */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-50 rounded-b-lg">
                   <div>
                       {/* Botão Excluir (condicional) */}
                       {canEditOrDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Excluir Solicitação
                            </button>
                       )}
                   </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                           {isEditing ? 'Cancelar Edição' : 'Fechar'}
                        </button>
                        {/* Botões Editar / Salvar (condicional) */}
                        {canEditOrDelete && !isEditing && (
                             <button onClick={handleEditToggle} className="px-4 py-2 text-white bg-yellow-600 rounded-md hover:bg-yellow-700">
                                Editar
                             </button>
                        )}
                        {canEditOrDelete && isEditing && (
                            <button
                                onClick={handleSaveChanges}
                                disabled={loading}
                                className="px-4 py-2 text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-gray-400"
                            >
                               {loading ? 'A guardar...' : 'Salvar Alterações'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}