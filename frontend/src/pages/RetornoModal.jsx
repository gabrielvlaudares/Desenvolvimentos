// src/pages/RetornoModal.jsx
import React, { useState } from 'react';
import api from '../services/api';

// Data de hoje no formato YYYY-MM-DD
const today = new Date().toISOString().split('T')[0];

export default function RetornoModal({ item, onClose, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    dataRetornoEfetivo: today,
    nfRetorno: item?.nfRetorno || '', // Puxa NF existente se houver (caso de re-edição futura)
    observacoesRetorno: item?.observacoesRetorno || '', // Puxa obs existente
    pdfFile: null, // Estado para o arquivo PDF
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handler para campos de texto e data
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  // Handler específico para o input de ficheiro
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    // Validação simples do tipo de ficheiro
    if (file && file.type !== "application/pdf") {
        setError("Apenas ficheiros PDF são permitidos.");
        setFormData(prev => ({ ...prev, pdfFile: null })); // Limpa o ficheiro se inválido
        e.target.value = null; // Limpa o input de ficheiro
        return;
    }
    setFormData(prev => ({ ...prev, pdfFile: file || null }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let pdfUrlRetorno = item?.pdfUrlRetorno || null; // Mantém URL antiga se não carregar nova

    try {
      // --- Lógica de Upload (se ficheiro foi selecionado) ---
      // Esta parte requer uma API de upload genérica (que talvez já tenhamos?)
      // Se não tivermos, precisamos criar /api/upload
      if (formData.pdfFile) {
        console.log("A enviar ficheiro PDF...");
        const uploadData = new FormData();
        uploadData.append('pdfFile', formData.pdfFile); // Nome do campo esperado pela API /upload

        // Assumindo que temos uma função apiService.uploadPdf que retorna o caminho
        // Se não tivermos, esta chamada falhará.
        try {
            // Se o upload falhar, queremos parar? Ou continuar sem o PDF?
            // Vamos parar por enquanto.
            const uploadResponse = await api.post('/upload', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            pdfUrlRetorno = uploadResponse.data.filePath; // Pega o caminho retornado pela API
            console.log("PDF enviado, URL:", pdfUrlRetorno);
        } catch (uploadError) {
             console.error("Erro no upload do PDF:", uploadError.response || uploadError);
             throw new Error(`Falha ao enviar o ficheiro PDF: ${uploadError.response?.data?.message || uploadError.message}`);
        }
      }
      // --- Fim da Lógica de Upload ---

      // Prepara os dados para a API de registo de retorno
      const dadosRetorno = {
        dataRetornoEfetivo: formData.dataRetornoEfetivo,
        nfRetorno: formData.nfRetorno || null,
        pdfUrlRetorno: pdfUrlRetorno, // URL do PDF (nova ou antiga)
        observacoesRetorno: formData.observacoesRetorno || null,
        // O backend pegará 'retorno_confirmado_por_upn' do req.user
      };

      // Chama a API para registar o retorno
      await api.put(`/maquinas/${item.id}/retorno`, dadosRetorno);

      onSaveSuccess(); // Chama callback do pai (fecha modal, recarrega lista)
      onClose(); // Fecha o modal

    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao registar retorno.');
      console.error("Erro registar retorno:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Registar Retorno de Equipamento</h2>
        <p className="text-sm text-gray-600 mb-1">ID: #{item.idSequencial}</p>
        <p className="text-sm text-gray-600 mb-4 truncate">Item: {item.descricaoMaterial}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dataRetornoEfetivo" className="block text-sm font-medium text-gray-700">Data de Retorno Efetiva *</label>
            <input
              id="dataRetornoEfetivo"
              type="date"
              name="dataRetornoEfetivo"
              value={formData.dataRetornoEfetivo}
              onChange={handleChange}
              required
              // Não pode ser antes da data de saída, se disponível
              min={item.dataSaidaEfetiva ? item.dataSaidaEfetiva.split('T')[0] : undefined}
              className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="nfRetorno" className="block text-sm font-medium text-gray-700">NF de Retorno (Opcional)</label>
            <input
              id="nfRetorno"
              type="text"
              name="nfRetorno"
              value={formData.nfRetorno}
              onChange={handleChange}
              className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="pdfFile" className="block text-sm font-medium text-gray-700">Anexar NF Retorno (PDF - Opcional)</label>
            <input
              id="pdfFile"
              type="file"
              name="pdfFile"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full mt-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
             {/* Mostra link para PDF antigo, se existir */}
             {item.pdfUrlRetorno && !formData.pdfFile && (
                 <p className="text-xs text-gray-500 mt-1">
                     Já existe um PDF anexado.{' '}
                     <a href={`http://localhost:5000${item.pdfUrlRetorno}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver atual</a>.
                     {' '}Enviar um novo irá substituí-lo.
                 </p>
             )}
          </div>
          <div>
            <label htmlFor="observacoesRetorno" className="block text-sm font-medium text-gray-700">Observações (Opcional)</label>
            <textarea
              id="observacoesRetorno"
              name="observacoesRetorno"
              rows="3"
              value={formData.observacoesRetorno}
              onChange={handleChange}
              className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
            ></textarea>
          </div>

          {error && <p className="text-sm text-center text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400">
              {loading ? 'A guardar...' : 'Confirmar Retorno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}