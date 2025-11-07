// src/pages/NovaTransferenciaForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api'; //
import { useAuth } from '../hooks/useAuth'; //

// Opções
const portarias = ['P1', 'P3', 'P4', 'P5', 'P7', 'P8', 'P10', 'PCD']; //
const meiosTransporte = ['PEDESTRE', 'TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'MOTOBOY', 'CARRO PARTICULAR']; //

// Data e Hora atuais
const today = new Date().toISOString().split('T')[0];
const now = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

export default function NovaTransferenciaForm({ onSaveSuccess }) {
  const { user } = useAuth(); //
  
  // --- ATUALIZADO: gestor e setor preenchidos pelo user ---
  const [formData, setFormData] = useState({
    dataSaidaSolicitada: today,
    horaSaidaSolicitada: now,
    portariaSaida: '',
    portariaDestino: '',
    numeroNf: '',
    pdfFile: null,
    meioTransporte: '',
    tipoCarro: '',
    placaVeiculo: '',
    nomeRequisitante: user?.nome || '', 
    nomeTransportador: '',
    setor: user?.departamento || '', // <-- Preenchido pelo departamento
    gestor: user?.gestorNome || '', // <-- Preenchido pelo nome do gestor
  });
  const [showVehicleFields, setShowVehicleFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handler para inputs normais
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); setSuccessMessage('');

    if (name === 'meioTransporte') {
      const needsVehicle = ['TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'CARRO PARTICULAR', 'MOTOBOY'].includes(value.toUpperCase()); //
      setShowVehicleFields(needsVehicle);
      if (!needsVehicle) {
        setFormData(prev => ({ ...prev, tipoCarro: '', placaVeiculo: '' }));
      }
    }
  };

  // Handler para ficheiro PDF
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== "application/pdf") { setError("Apenas PDFs."); setFormData(prev => ({ ...prev, pdfFile: null })); e.target.value = null; return; } //
    setFormData(prev => ({ ...prev, pdfFile: file || null }));
    setError(''); setSuccessMessage('');
  };

  // Handler para submeter
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccessMessage(''); setLoading(true);

    // Validações
    if (formData.portariaSaida === formData.portariaDestino) {
        setError('Portaria de Saída e Destino não podem ser iguais.'); setLoading(false); return;
    }
    if (showVehicleFields && (!formData.tipoCarro || !formData.placaVeiculo)) { 
        setError('Tipo e Placa do Veículo são obrigatórios para este meio de transporte.'); setLoading(false); return;
    }
    if (!formData.gestor) {
        setError('Gestor Responsável é obrigatório. (Configure-o no seu perfil de usuário ou digite manualmente)');
        setLoading(false);
        return;
    }
    // --- NOVA VALIDAÇÃO ---
    if (!formData.setor) {
        setError('Setor é obrigatório. (Configure seu Departamento no perfil ou digite manualmente)');
        setLoading(false);
        return;
    }

    let uploadedPdfUrl = null;
    try {
      // 1. Upload do PDF
      if (formData.pdfFile) {
        console.log("A enviar PDF da NF de Transferência...");
        const uploadData = new FormData(); uploadData.append('pdfFile', formData.pdfFile);
        try {
            const uploadResponse = await api.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } }); //
            uploadedPdfUrl = uploadResponse.data.filePath;
            console.log("PDF Transferência enviado, URL:", uploadedPdfUrl);
        } catch (uploadError) { throw new Error(`Falha ao enviar PDF: ${uploadError.response?.data?.message || uploadError.message}`); } //
      }

      // 2. Criação da Transferência
      const dataHoraSaidaSolicitada = `${formData.dataSaidaSolicitada}T${formData.horaSaidaSolicitada}:00`;

      const dataToSend = {
          dataSaidaSolicitada: dataHoraSaidaSolicitada,
          portariaSaida: formData.portariaSaida,
          portariaDestino: formData.portariaDestino,
          numeroNf: formData.numeroNf,
          pdfUrl: uploadedPdfUrl,
          meioTransporte: formData.meioTransporte,
          tipoCarro: showVehicleFields ? formData.tipoCarro : null,
          placaVeiculo: showVehicleFields ? formData.placaVeiculo : null,
          nomeRequisitante: formData.nomeRequisitante,
          nomeTransportador: formData.nomeTransportador || null,
          setor: formData.setor, // <-- Vem do form (auto-preenchido)
          gestor: formData.gestor, 
      };

      const response = await api.post('/transferencias', dataToSend); //
      setSuccessMessage(`Transferência #${response.data.idSequencial} registada com sucesso!`);

      // Limpa formulário
      setFormData({
        dataSaidaSolicitada: today, horaSaidaSolicitada: now, portariaSaida: '',
        portariaDestino: '', numeroNf: '', pdfFile: null, meioTransporte: '',
        tipoCarro: '', placaVeiculo: '', 
        nomeRequisitante: user?.nome || '',
        nomeTransportador: '', 
        setor: user?.departamento || '', // Reseta para o padrão
        gestor: user?.gestorNome || '', // Reseta para o padrão
      });
      setShowVehicleFields(false);
      const fileInput = document.getElementById('pdfFileTransf');
      if (fileInput) fileInput.value = null;

      setTimeout(() => { if (onSaveSuccess) onSaveSuccess(); }, 1500);

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar transferência.');
      console.error("Erro submit Nova Transferência:", err.response || err);
    } finally {
      setLoading(false);
    }
  };
  
  // Define se os campos devem ser travados
  const isGestorReadOnly = !!user?.gestorNome;
  const isSetorReadOnly = !!user?.departamento; // <-- NOVO
  
  const gestorDisplayValue = (user?.gestorNome && user?.gestorEmail) 
                             ? `${user.gestorNome} (${user.gestorEmail})` 
                             : formData.gestor; 

  return (
    <div className="p-4 bg-white rounded-lg shadow max-w-4xl mx-auto border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-purple-800 border-b pb-2">Registar Nova Transferência</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* (Linhas 1-4 inalteradas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dataSaidaSolicitada" className="block text-sm font-medium text-gray-700">Data Saída Solicitada *</label>
            <input id="dataSaidaSolicitada" type="date" name="dataSaidaSolicitada" value={formData.dataSaidaSolicitada} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="horaSaidaSolicitada" className="block text-sm font-medium text-gray-700">Hora Saída Solicitada *</label>
            <input id="horaSaidaSolicitada" type="time" name="horaSaidaSolicitada" value={formData.horaSaidaSolicitada} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="portariaSaida" className="block text-sm font-medium text-gray-700">Portaria de Saída *</label>
            <select id="portariaSaida" name="portariaSaida" value={formData.portariaSaida} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2">
              <option value="">Selecione...</option>
              {portarias.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="portariaDestino" className="block text-sm font-medium text-gray-700">Portaria de Destino *</label>
            <select id="portariaDestino" name="portariaDestino" value={formData.portariaDestino} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2">
              <option value="">Selecione...</option>
              {portarias.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="numeroNf" className="block text-sm font-medium text-gray-700">Número da NF *</label>
            <input id="numeroNf" type="text" name="numeroNf" value={formData.numeroNf} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
          </div>
          <div>
             <label htmlFor="pdfFileTransf" className="block text-sm font-medium text-gray-700">Anexar NF (PDF - Opcional)</label>
             <input id="pdfFileTransf" type="file" name="pdfFile" accept="application/pdf" onChange={handleFileChange} className="w-full mt-1 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div>
             <label htmlFor="meioTransporte" className="block text-sm font-medium text-gray-700">Meio de Transporte *</label>
             <select id="meioTransporte" name="meioTransporte" value={formData.meioTransporte} onChange={handleChange} required className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2">
                <option value="">Selecione...</option>
                {meiosTransporte.map(m => <option key={m} value={m}>{m}</option>)}
             </select>
           </div>
            {showVehicleFields && (
                <>
                    <div>
                        <label htmlFor="tipoCarro" className="block text-sm font-medium text-gray-700">Tipo de Veículo *</label>
                        <input id="tipoCarro" type="text" name="tipoCarro" value={formData.tipoCarro} onChange={handleChange} required={showVehicleFields} className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                    <div>
                        <label htmlFor="placaVeiculo" className="block text-sm font-medium text-gray-700">Placa do Veículo *</label>
                        <input id="placaVeiculo" type="text" name="placaVeiculo" value={formData.placaVeiculo} onChange={handleChange} required={showVehicleFields} className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
                    </div>
                </>
            )}
        </div>

        {/* Linha 5: Requisitante e Transportador */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label htmlFor="nomeRequisitante" className="block text-sm font-medium text-gray-700">Nome do Requisitante</label>
            <input id="nomeRequisitante" type="text" name="nomeRequisitante" value={formData.nomeRequisitante} readOnly className="w-full mt-1 border-gray-300 rounded-md shadow-sm bg-gray-100 p-2" />
           </div>
           <div>
            <label htmlFor="nomeTransportador" className="block text-sm font-medium text-gray-700">Nome do Transportador (Opcional)</label>
            <input id="nomeTransportador" type="text" name="nomeTransportador" value={formData.nomeTransportador} onChange={handleChange} className="w-full mt-1 border-gray-300 rounded-md shadow-sm p-2" />
           </div>
        </div>

         {/* Linha 6: Setor e Gestor (ATUALIZADO) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* --- CAMPO SETOR ATUALIZADO --- */}
           <div>
            <label htmlFor="setor" className="block text-sm font-medium text-gray-700">Setor *</label>
            <input 
              id="setor" 
              type="text" 
              name="setor" 
              value={formData.setor} // <-- Vem do estado (preenchido por user.departamento)
              onChange={handleChange} 
              readOnly={isSetorReadOnly} // <-- Trava se veio do perfil
              required 
              className={`w-full mt-1 border-gray-300 rounded-md shadow-sm p-2 ${isSetorReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
              placeholder={isSetorReadOnly ? "" : "Ex: Produção, Almoxarifado"} 
            />
           </div>
           
           {/* --- CAMPO GESTOR ATUALIZADO --- */}
           <div>
            <label htmlFor="gestor" className="block text-sm font-medium text-gray-700">Gestor Responsável *</label>
            <input 
              id="gestor" 
              type="text" 
              name="gestor" 
              value={isGestorReadOnly ? gestorDisplayValue : formData.gestor}
              onChange={handleChange} 
              readOnly={isGestorReadOnly} 
              required 
              className={`w-full mt-1 border-gray-300 rounded-md shadow-sm p-2 ${isGestorReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              placeholder={isGestorReadOnly ? "" : "Gestor não definido (digite o nome)"}
            />
            {isGestorReadOnly && (
                 <p className="text-xs text-gray-500 mt-1">O gestor foi definido automaticamente pelo seu perfil.</p>
            )}
           </div>
        </div>


        {/* Mensagens e Botão */}
        <div className="pt-5">
             {error && <p className="text-sm text-center text-red-600 mb-3">{error}</p>}
            {successMessage && <p className="text-sm text-center text-green-600 mb-3">{successMessage}</p>}
            <div className="flex justify-end border-t pt-4">
              <button type="submit" disabled={loading} className="px-6 py-2 font-medium text-white bg-purple-700 rounded-md shadow-sm hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400">
                {loading ? 'A registar...' : 'Registar Transferência'}
              </button>
            </div>
        </div>
      </form>
    </div>
  );
}