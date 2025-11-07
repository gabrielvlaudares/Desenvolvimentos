// src/pages/NovaSaidaForm.jsx
import React, { useState } from 'react';
import api from '../services/api'; //
import { useAuth } from '../hooks/useAuth'; //

// Opções de portaria
const portarias = ['P1', 'P3', 'P4', 'P5', 'P7', 'P8', 'P10', 'PCD'];
const today = new Date().toISOString().split('T')[0];

export default function NovaSaidaForm({ onSaveSuccess }) {
  const { user } = useAuth(); //

  // --- ATUALIZADO: areaResponsavel e gestorEmail ---
  const [formData, setFormData] = useState({
    tipoSaida: '',
    solicitante: user?.nome || '',
    areaResponsavel: user?.departamento || '', // <-- Preenchido pelo departamento
    gestorEmail: user?.gestorEmail || '', 
    descricaoMaterial: '',
    quantidade: 1,
    motivoSaida: '',
    dataEnvio: today,
    prazoRetorno: '',
    portariaSaida: '',
    nfSaida: '',
    pdfFile: null, 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handler para inputs normais
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseInt(value, 10) || 1) : value,
    }));
    setError('');
    setSuccessMessage('');
    if (name === 'tipoSaida' && value === 'Comodato') {
        setFormData(prev => ({ ...prev, prazoRetorno: '' }));
    }
  };

  // Handler para o ficheiro
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== "application/pdf") {
        setError("Apenas ficheiros PDF são permitidos.");
        setFormData(prev => ({ ...prev, pdfFile: null }));
        e.target.value = null; // Limpa o input
        return;
    }
    setFormData(prev => ({ ...prev, pdfFile: file || null }));
    setError('');
    setSuccessMessage('');
  };


  // handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Validações
    if (formData.tipoSaida === 'Manutenção' && !formData.prazoRetorno) { setError('Prazo de Retorno obrigatório para Manutenção.'); setLoading(false); return; }
    if (formData.quantidade < 1) { setError('Quantidade deve ser >= 1.'); setLoading(false); return; }
    if (!formData.gestorEmail) {
        setError('E-mail do Gestor Aprovador é obrigatório. (Configure-o no seu perfil de usuário ou digite manualmente)');
        setLoading(false);
        return;
    }
    // --- VALIDAÇÃO DE ÁREA (DEPARTAMENTO) ---
    if (!formData.areaResponsavel) {
        setError('Área Responsável é obrigatória. (Configure seu Departamento no perfil ou digite manualmente)');
        setLoading(false);
        return;
    }

    let uploadedPdfUrl = null; 

    try {
      // --- PASSO 1: UPLOAD DO PDF ---
      if (formData.pdfFile) {
        console.log("A enviar PDF da NF de Saída...");
        const uploadData = new FormData();
        uploadData.append('pdfFile', formData.pdfFile);

        try {
            const uploadResponse = await api.post('/upload', uploadData, { 
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            uploadedPdfUrl = uploadResponse.data.filePath;
            console.log("PDF de Saída enviado, URL:", uploadedPdfUrl);
        } catch (uploadError) {
             console.error("Erro no upload do PDF de Saída:", uploadError.response || uploadError);
             throw new Error(`Falha ao enviar o PDF: ${uploadError.response?.data?.message || uploadError.message}`);
        }
      }

      // --- PASSO 2: CRIAR A SOLICITAÇÃO ---
      const dataToSend = {
          tipoSaida: formData.tipoSaida,
          solicitante: formData.solicitante,
          areaResponsavel: formData.areaResponsavel, // <-- Envia o valor (auto-preenchido ou digitado)
          gestorEmail: formData.gestorEmail, 
          descricaoMaterial: formData.descricaoMaterial,
          quantidade: formData.quantidade,
          motivoSaida: formData.motivoSaida,
          dataEnvio: formData.dataEnvio,
          prazoRetorno: formData.tipoSaida === 'Manutenção' && formData.prazoRetorno ? formData.prazoRetorno : null,
          portariaSaida: formData.portariaSaida || null,
          nfSaida: formData.nfSaida || null,
          pdfUrlSaida: uploadedPdfUrl,
      };

      const response = await api.post('/maquinas', dataToSend); 
      setSuccessMessage(`Solicitação #${response.data.idSequencial} criada com sucesso! Aguardando aprovação.`);
      
      // Limpa o formulário
      setFormData({
        tipoSaida: '', 
        solicitante: user?.nome || '', 
        areaResponsavel: user?.departamento || '', // Reseta para o padrão
        gestorEmail: user?.gestorEmail || '', // Reseta para o padrão
        descricaoMaterial: '', 
        quantidade: 1, 
        motivoSaida: '',
        dataEnvio: today, 
        prazoRetorno: '', 
        portariaSaida: '', 
        nfSaida: '',
        pdfFile: null, 
      });
      
      const fileInput = document.getElementById('pdfFileSaida');
      if (fileInput) fileInput.value = null;

      setTimeout(() => { if (onSaveSuccess) onSaveSuccess(); }, 1500);

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar solicitação.');
      console.error("Erro submit Nova Saída:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  const isManutencao = formData.tipoSaida === 'Manutenção';
  
  // Define se os campos devem ser travados
  const isGestorReadOnly = !!user?.gestorEmail;
  const isAreaReadOnly = !!user?.departamento; // <-- Trava o campo Área
  
  const gestorDisplayValue = (user?.gestorNome && user?.gestorEmail) 
                             ? `${user.gestorNome} (${user.gestorEmail})` 
                             : formData.gestorEmail;

  // --- JSX ---
  return (
    <div className="p-4 bg-white rounded-lg shadow max-w-4xl mx-auto border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-blue-800 border-b pb-2">Registrar Nova Saída de Máquina/Equipamento</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
         {/* Tipo Saída */}
         <div> <label htmlFor="tipoSaida" className="block text-sm font-medium text-gray-700">Tipo de Saída *</label> <select id="tipoSaida" name="tipoSaida" value={formData.tipoSaida} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"> <option value="">Selecione...</option> <option value="Manutenção">Manutenção</option> <option value="Comodato">Retorno de Equipamento em Comodato</option> </select> </div>
        
        {/* Solicitante e Área Responsável (COM A LÓGICA) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
          <div> 
            <label htmlFor="solicitante" className="block text-sm font-medium text-gray-700">Solicitante</label> 
            <input id="solicitante" type="text" name="solicitante" value={formData.solicitante} readOnly className="w-full mt-1 border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed sm:text-sm p-2" /> 
          </div> 
          <div> 
            <label htmlFor="areaResponsavel" className="block text-sm font-medium text-gray-700">Área Responsável *</label> 
            <input 
              id="areaResponsavel" 
              type="text" 
              name="areaResponsavel" 
              value={formData.areaResponsavel} // <-- Vem do estado (preenchido pelo user.departamento)
              onChange={handleChange} 
              readOnly={isAreaReadOnly} // <-- Trava se veio do perfil
              required 
              className={`w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ${isAreaReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              placeholder={isAreaReadOnly ? "" : "Digite sua área/departamento"}
            /> 
          </div> 
        </div>
        
        {/* Gestor */}
        <div> 
          <label htmlFor="gestorEmail" className="block text-sm font-medium text-gray-700">E-mail do Gestor Aprovador *</label> 
          <input 
            id="gestorEmail" 
            type="email" 
            name="gestorEmail" 
            value={isGestorReadOnly ? gestorDisplayValue : formData.gestorEmail}
            onChange={handleChange} 
            readOnly={isGestorReadOnly} 
            required 
            placeholder={isGestorReadOnly ? "" : "Gestor não definido (digite o e-mail)"} 
            className={`w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 ${isGestorReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          /> 
          <p className="text-xs text-gray-500 mt-1">
            {isGestorReadOnly 
              ? "O gestor foi definido automaticamente pelo seu perfil." 
              : "O gestor receberá a notificação para aprovar."
            }
          </p> 
        </div>

        {/* Descrição, Quantidade, Motivo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> <div className="md:col-span-2"> <label htmlFor="descricaoMaterial" className="block text-sm font-medium text-gray-700">Descrição do Material *</label> <textarea id="descricaoMaterial" name="descricaoMaterial" value={formData.descricaoMaterial} onChange={handleChange} required rows="3" className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"></textarea> </div> <div> <label htmlFor="quantidade" className="block text-sm font-medium text-gray-700">Quantidade *</label> <input id="quantidade" type="number" name="quantidade" value={formData.quantidade} min="1" onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2" /> </div> </div>
        <div> <label htmlFor="motivoSaida" className="block text-sm font-medium text-gray-700">Motivo da Saída *</label> <input id="motivoSaida" type="text" name="motivoSaida" value={formData.motivoSaida} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2" /> </div>

        {/* Datas */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div> <label htmlFor="dataEnvio" className="block text-sm font-medium text-gray-700">Data de Envio *</label> <input id="dataEnvio" type="date" name="dataEnvio" value={formData.dataEnvio} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2" /> </div> {isManutencao && ( <div> <label htmlFor="prazoRetorno" className="block text-sm font-medium text-gray-700"> Data Prevista de Retorno * </label> <input id="prazoRetorno" type="date" name="prazoRetorno" value={formData.prazoRetorno} onChange={handleChange} required={isManutencao} min={formData.dataEnvio} className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2" /> </div> )} </div>

        {/* Portaria, NF e Anexo */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="portariaSaida" className="block text-sm font-medium text-gray-700">Portaria de Saída (Opcional)</label>
              <select id="portariaSaida" name="portariaSaida" value={formData.portariaSaida} onChange={handleChange} className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2">
                 <option value="">Selecione...</option>
                 {portarias.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
             <div>
              <label htmlFor="nfSaida" className="block text-sm font-medium text-gray-700">NF de Saída (Opcional)</label>
              <input id="nfSaida" type="text" name="nfSaida" value={formData.nfSaida} onChange={handleChange} className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2" />
            </div>
            <div>
                <label htmlFor="pdfFileSaida" className="block text-sm font-medium text-gray-700">Anexar NF (PDF - Opcional)</label>
                <input
                    id="pdfFileSaida"
                    type="file"
                    name="pdfFile" 
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="w-full mt-1 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                 />
            </div>
        </div>


        {/* Mensagens e Botão */}
        <div className="pt-5">
             {error && <p className="text-sm text-center text-red-600 mb-3">{error}</p>}
            {successMessage && <p className="text-sm text-center text-green-600 mb-3">{successMessage}</p>}
            <div className="flex justify-end border-t pt-4">
              <button type="submit" disabled={loading} className="px-6 py-2 font-medium text-white bg-blue-700 rounded-md shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                {loading ? 'Enviando...' : 'Criar Solicitação'}
              </button>
            </div>
        </div>
      </form>
    </div>
  );
}