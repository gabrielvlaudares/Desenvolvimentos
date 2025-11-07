// src/pages/ConfigManagement.jsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Save, Loader2, Send, CheckCircle, AlertTriangle, HelpCircle, Zap } from 'lucide-react'; // Ícones atualizados

/**
 * Componente Refatorado para Gerenciamento de Configurações
 * - Adicionado botão de TESTE de conexão LDAP (Usuário de Serviço)
 */
export default function ConfigManagement() {
  const [configMap, setConfigMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados para o teste de E-mail
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState({ type: '', message: '' });

  // --- NOVO: Estados para o Teste LDAP ---
  const [isTestingLdap, setIsTestingLdap] = useState(false);
  const [ldapTestStatus, setLdapTestStatus] = useState({ type: '', message: '' });

  // Definindo as chaves que este componente gerencia
  const generalKeys = ['FRONTEND_URL'];
  const ldapKeys = ['AD_URL', 'AD_BASE_DN', 'AD_BIND_DN', 'AD_BIND_PASSWORD'];
  const emailKeys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'];
  const emailTemplateKeys = ['EMAIL_APROVACAO_SUBJECT', 'EMAIL_APROVACAO_BODY'];
  
  const allKeys = [...generalKeys, ...ldapKeys, ...emailKeys, ...emailTemplateKeys]; 

  // Busca inicial de todas as configurações
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/admin/config');
        
        const configAsMap = res.data.reduce((acc, item) => {
          acc[item.key] = item.value || '';
          return acc;
        }, {});

        allKeys.forEach(key => {
            if (!configAsMap.hasOwnProperty(key)) {
                configAsMap[key] = '';
            }
        });

        if (!configAsMap.EMAIL_APROVACAO_BODY) {
            configAsMap.EMAIL_APROVACAO_BODY = 
`Olá, {{GESTOR_NOME}}!\n
Uma nova solicitação de saída de equipamento (ID #{{ID_SOLICITACAO}}) foi criada por {{SOLICITANTE}} e requer sua aprovação.\n
Detalhes:
- Descrição: {{DESCRICAO_MATERIAL}}
- Motivo: {{MOTIVO_SAIDA}}
- Prazo de Retorno: {{PRAZO_RETORNO}}\n
Por favor, acesse o painel para revisar e aprovar ou rejeitar.
{{LINK_APROVACAO}}\n
Obrigado,
Sistema SCSE`;
        }
        if (!configAsMap.EMAIL_APROVACAO_SUBJECT) {
            configAsMap.EMAIL_APROVACAO_SUBJECT = '[SCSE] Aprovação Necessária: Saída de Equipamento #{{ID_SOLICITACAO}}';
        }

        setConfigMap(configAsMap);
      } catch (err) {
        setError('Erro ao carregar configurações.');
        console.error("Erro fetchConfig:", err.response || err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Roda apenas uma vez

  // Handler único para qualquer alteração nos inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfigMap(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccessMessage('');
    // Limpa status de teste se os campos relevantes mudarem
    if (ldapKeys.includes(name)) {
        setLdapTestStatus({ type: '', message: '' });
    }
    if (emailKeys.includes(name)) {
        setEmailTestStatus({ type: '', message: '' });
    }
  };

  // Handler para o campo de e-mail de teste
  const handleTestEmailChange = (e) => {
    setTestEmail(e.target.value);
    setEmailTestStatus({ type: '', message: '' }); // Limpa status do teste ao digitar
  };

  // Handler único para salvar TODAS as configurações
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || isTestingLdap || isTestingEmail) return;
    
    setIsSaving(true);
    setError('');
    setSuccessMessage('');
    setLdapTestStatus({ type: '', message: '' });
    setEmailTestStatus({ type: '', message: '' }); 

    const dataToSave = allKeys
      .map(key => ({
        key: key,
        value: configMap[key] || '',
      }));

    try {
      await api.put('/admin/config', dataToSave);
      setSuccessMessage('Configurações salvas com sucesso!');
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar configurações.');
      console.error("Erro saveConfig:", err.response || err);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  // --- NOVO: Handler para o Teste de Conexão LDAP ---
  const handleTestLdapConnection = async () => {
      setIsTestingLdap(true);
      setLdapTestStatus({ type: 'info', message: 'Testando...' });
      setError('');
      setSuccessMessage('');

      try {
          // Pega os valores *atuais* do formulário (antes de salvar)
          const configToTest = {
              AD_URL: configMap.AD_URL,
              AD_BIND_DN: configMap.AD_BIND_DN,
              AD_BIND_PASSWORD: configMap.AD_BIND_PASSWORD,
          };
          
          if (!configToTest.AD_URL || !configToTest.AD_BIND_DN || !configToTest.AD_BIND_PASSWORD) {
              throw new Error("Preencha AD_URL, AD_BIND_DN e AD_BIND_PASSWORD para testar.");
          }

          const response = await api.post('/admin/ldap/test', configToTest);
          setLdapTestStatus({ type: 'success', message: response.data.message });
      } catch (err) {
          const errorMsg = err.response?.data?.message || 'Erro desconhecido ao testar conexão.';
          setLdapTestStatus({ type: 'error', message: `Falha no teste: ${errorMsg}` });
          console.error("Erro ao testar LDAP:", err.response || err);
      } finally {
          setIsTestingLdap(false);
      }
  };

  // Handler para o Teste de E-mail
  const handleTestEmail = async () => {
    if (!testEmail) {
        setEmailTestStatus({ type: 'error', message: 'Por favor, insira um e-mail de destino.' });
        return;
    }
    
    setIsTestingEmail(true);
    setError('');
    setSuccessMessage('');
    setEmailTestStatus({ type: 'info', message: 'Testando...' }); 

    try {
        // Usa a API que busca as credenciais SALVAS
        const response = await api.post('/admin/email/test', { testEmail });
        setEmailTestStatus({ type: 'success', message: response.data.message });
    } catch (err) {
        const errorMsg = err.response?.data?.message || 'Erro desconhecido ao enviar teste.';
        setEmailTestStatus({ type: 'error', message: `Falha no teste: ${errorMsg}` });
        console.error("Erro ao testar e-mail:", err.response || err);
    } finally {
        setIsTestingEmail(false);
    }
  };
  
  // Helper para renderizar um campo de input
  const renderField = (key, type = 'text') => {
    const isPassword = key.includes('PASS') || key.includes('BIND_PASSWORD') || type === 'password';
    
    let placeholder = '';
    if (isPassword) {
      placeholder = '*** Deixe em branco para não alterar ***';
    } else if (key === 'FRONTEND_URL') {
      placeholder = 'Ex: http://localhost:5173';
    } else if (key === 'AD_BIND_DN') {
      placeholder = 'Ex: svc-scse@liotecnica.com.br (UPN) ou CN=... (DN)';
    }

    return (
      <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
        <input
          type={isPassword ? 'password' : 'text'}
          id={key}
          name={key}
          value={configMap[key] || ''}
          onChange={handleChange}
          placeholder={placeholder}
          autoComplete={isPassword ? 'new-password' : 'off'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>
    );
  };
  
  // Helper para renderizar <textarea>
  const renderTextarea = (key) => {
     return (
       <div key={key}>
        <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
        <textarea
          id={key}
          name={key}
          value={configMap[key] || ''}
          onChange={handleChange}
          rows={10} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
        />
       </div>
     );
  };

  // Renderização do Loading inicial
  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow border border-gray-100 flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center text-gray-500 animate-pulse">
            <Loader2 size={32} className="animate-spin" />
            <p className="mt-2">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  // Tags disponíveis
  const availableTags = [
      '{{GESTOR_NOME}}', '{{SOLICITANTE}}', '{{AREA_RESPONSAVEL}}', '{{ID_SOLICITACAO}}', 
      '{{DESCRICAO_MATERIAL}}', '{{MOTIVO_SAIDA}}', '{{DATA_ENVIO}}',
      '{{PRAZO_RETORNO}}', '{{LINK_APROVACAO}}'
  ];

  // Renderização principal do componente
  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-100">
      {/* 1. Cabeçalho Padronizado */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Configurações do Sistema</h2>
          <p className="text-sm text-gray-500">Gerencie as configurações globais de integração (AD/LDAP, E-mail) e templates.</p>
        </div>
      </div>

      {/* 2. Formulário Único */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Seção 0: Configurações Gerais */}
        <fieldset className="border rounded-md p-4 pt-2 shadow-sm">
          <legend className="text-md font-semibold text-gray-700 px-2">Configurações Gerais</legend>
          <div className="space-y-4 pt-2">
            {generalKeys.map(key => renderField(key))}
             <p className="text-xs text-gray-500 -mt-2">
              URL base do frontend, usada para gerar links nos e-mails (Ex: http://localhost:5173 ou http://seu-dominio.com).
            </p>
          </div>
        </fieldset>
      
        {/* Seção 1: AD/LDAP (ATUALIZADO COM BOTÃO DE TESTE) */}
        <fieldset className="border rounded-md p-4 pt-2 shadow-sm">
          <legend className="text-md font-semibold text-gray-700 px-2">Configurações AD/LDAP</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {ldapKeys.filter(k => !k.includes('BIND')).map(key => (
              <div key={key} className="md:col-span-1">{renderField(key)}</div>
            ))}
            {ldapKeys.filter(k => k.includes('BIND')).map(key => (
              <div key={key} className="md:col-span-1">{renderField(key)}</div>
            ))}
          </div>
           <p className="text-xs text-gray-500 mt-2">
              <b>AD_BIND_DN</b> e <b>AD_BIND_PASSWORD</b> são as credenciais de um **usuário de serviço** (Ex: `svc-scse@liotecnica.com.br`) usado para a sincronização automática.
            </p>
            
            {/* --- NOVO: Botão de Teste LDAP --- */}
            <div className="flex flex-col items-end mt-4 pt-4 border-t">
                 <button
                    type="button"
                    onClick={handleTestLdapConnection}
                    disabled={isTestingLdap || isSaving}
                    className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isTestingLdap ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                        <Zap size={16} className="mr-2" />
                    )}
                    {isTestingLdap ? 'Testando...' : 'Testar Conexão de Serviço'}
                </button>
                
                {/* Feedback do Teste LDAP */}
                {ldapTestStatus.message && (
                    <div className={`mt-3 p-2 rounded-md text-sm flex items-center gap-2 w-full ${
                        ldapTestStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
                        ldapTestStatus.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
                        'bg-blue-50 border border-blue-200 text-blue-700'
                    }`}>
                    {ldapTestStatus.type === 'success' && <CheckCircle size={16} />}
                    {ldapTestStatus.type === 'error' && <AlertTriangle size={16} />}
                    {ldapTestStatus.type === 'info' && <Loader2 size={16} className="animate-spin" />}
                    <span className="flex-1">{ldapTestStatus.message}</span>
                    </div>
                )}
            </div>
            {/* --- FIM Botão Teste LDAP --- */}
            
        </fieldset>

        {/* Seção 3: E-mail (SMTP) */}
        <fieldset className="border rounded-md p-4 pt-2 shadow-sm">
          <legend className="text-md font-semibold text-gray-700 px-2">Configurações de E-mail (SMTP)</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {emailKeys.map(key => (
              <div key={key} className={key === 'EMAIL_FROM' ? 'sm:col-span-2' : ''}>
                {renderField(key)}
              </div>
            ))}
          </div>
        </fieldset>

        {/* Seção 4: Templates de E-mail */}
        <fieldset className="border rounded-md p-4 pt-2 shadow-sm">
          <legend className="text-md font-semibold text-gray-700 px-2">Template E-mail (Saída de Máquina)</legend>
          <div className="space-y-4 pt-2">
            {renderField('EMAIL_APROVACAO_SUBJECT')}
            {renderTextarea('EMAIL_APROVACAO_BODY')}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <HelpCircle size={14} /> Tags Disponíveis (serão substituídas automaticamente):
              </label>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {availableTags.map(tag => (
                  <code key={tag} className="text-xs text-blue-700 bg-blue-50 px-1 py-0.5 rounded">{tag}</code>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        {/* Bloco de Teste de E-mail */}
        <fieldset className="border rounded-md p-4 pt-2 shadow-sm">
          <legend className="text-md font-semibold text-gray-700 px-2">Testar Configuração de E-mail</legend>
          <p className="text-xs text-gray-500 pt-2 mb-3">
            O teste usará as configurações **salvas** no banco de dados, não as que estão digitadas acima (ainda não salvas).
          </p>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label htmlFor="testEmail" className="block text-sm font-medium text-gray-700 mb-1">E-mail de Destino *</label>
              <input
                type="email"
                id="testEmail"
                name="testEmail"
                value={testEmail}
                onChange={handleTestEmailChange}
                placeholder="seu.email@exemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isTestingEmail || !testEmail || isSaving}
              className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-150 w-full sm:w-auto"
            >
              {isTestingEmail ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Send size={16} className="mr-2" />
              )}
              {isTestingEmail ? 'Enviando...' : 'Enviar Teste'}
            </button>
          </div>
          {/* Feedback do Teste */}
          {emailTestStatus.message && (
            <div className={`mt-3 p-2 rounded-md text-sm flex items-center gap-2 ${
                emailTestStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
                emailTestStatus.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
                'bg-blue-50 border border-blue-200 text-blue-700'
            }`}>
              {emailTestStatus.type === 'success' && <CheckCircle size={16} />}
              {emailTestStatus.type === 'error' && <AlertTriangle size={16} />}
              {emailTestStatus.type === 'info' && <Loader2 size={16} className="animate-spin" />}
              <span className="flex-1">{emailTestStatus.message}</span>
            </div>
          )}
        </fieldset>

        {/* 3. Mensagens e Botão de Salvar Único */}
        <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4 border-t mt-4">
          
          <div className="flex-1 text-center sm:text-right min-h-[20px]">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {successMessage && (
              <p className="text-sm text-green-600">{successMessage}</p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isSaving || isTestingLdap || isTestingEmail}
            className="flex items-center justify-center px-6 py-2 text-sm font-medium text-white bg-blue-700 rounded-md shadow-sm hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-150 w-full sm:w-auto"
          >
            {isSaving ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
                <Save size={16} className="mr-2" />
            )}
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

      </form>
    </div>
  );
}