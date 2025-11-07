// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Truck,
  Activity,
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  Calendar,
  Loader2
} from 'lucide-react';

/**
 * Dashboard PREMIUM com design imersivo
 * * ALTERAÇÕES:
 * - Adicionada verificação de permissão (canViewAuditLog) antes de buscar /api/audit.
 * - Separada a lógica de busca de stats (obrigatória) da busca de audit (opcional)
 * para evitar que a falha de permissão na auditoria quebre o dashboard.
 */

// --- Helpers de Formatação (sem alteração) ---

const getActivityType = (entityType) => {
    const typeMap = { 'MAQUINA': 'maquina', 'TRANSFERENCIA': 'transferencia', 'USER': 'admin', 'GROUP': 'admin', 'CONFIG': 'admin' };
    return typeMap[entityType] || 'system';
};
const getActionLabel = (acao) => {
    const labelMap = {
      'MAQUINA_SAIDA_CREATED': 'Saída criada',
      'MAQUINA_SAIDA_APPROVED': 'Saída aprovada',
      'MAQUINA_SAIDA_REJECTED': 'Saída rejeitada',
      'MAQUINA_SAIDA_UPDATED': 'Saída atualizada',
      'MAQUINA_SAIDA_DELETED': 'Saída excluída',
      'MAQUINA_SAIDA_PORTARIA': 'Saída confirmada (Portaria)', // Corrigido
      'MAQUINA_RETORNO_CONFIRMED': 'Retorno confirmado',
      'TRANSFERENCIA_CREATED': 'Transferência criada',
      'TRANSFERENCIA_SAIDA_CONFIRMED': 'Saída confirmada (Origem)',
      'TRANSFERENCIA_SAIDA_REJECTED': 'Saída rejeitada (Origem)',
      'TRANSFERENCIA_CHEGADA_CONFIRMED': 'Chegada confirmada',
      'TRANSFERENCIA_CHEGADA_PROBLEM': 'Chegada com Problema', // Corrigido
      'TRANSFERENCIA_UPDATED': 'Transferência atualizada',
      'TRANSFERENCIA_DELETED': 'Transferência excluída',
      'USER_CREATED': 'Usuário criado',
      'USER_UPDATED': 'Usuário atualizado',
      'USER_DELETED': 'Usuário excluído',
      'GROUP_CREATED': 'Grupo criado',
      'GROUP_UPDATED': 'Grupo atualizado',
      'GROUP_DELETED': 'Grupo excluído',
      'CONFIG_UPDATED': 'Configuração atualizada',
      'PDF_DOWNLOADED': 'PDF baixado',
      'EMAIL_TEST_SENT': 'Teste de e-mail enviado',
      'EMAIL_TEST_FAILED': 'Falha no teste de e-mail'
    };
    return labelMap[acao] || acao;
};
const getActivityIcon = (acao) => {
    if (acao.includes('APPROVED') || acao.includes('CONFIRMED') || acao.includes('CREATED') || acao.includes('SENT')) return CheckCircle;
    if (acao.includes('REJECTED') || acao.includes('DELETED') || acao.includes('PROBLEM') || acao.includes('FAILED')) return AlertCircle;
    if (acao.includes('MAQUINA')) return Package;
    if (acao.includes('TRANSFERENCIA')) return Truck;
    return Activity;
};
const getActivityColor = (acao) => {
    if (acao.includes('APPROVED') || acao.includes('CONFIRMED') || acao.includes('SENT')) return 'from-green-500 to-green-600';
    if (acao.includes('REJECTED') || acao.includes('DELETED') || acao.includes('PROBLEM') || acao.includes('FAILED')) return 'from-red-500 to-red-600';
    if (acao.includes('MAQUINA')) return 'from-blue-500 to-blue-600';
    if (acao.includes('TRANSFERENCIA')) return 'from-purple-500 to-purple-600';
    return 'from-gray-500 to-gray-600';
};
const getActivityStatus = (acao) => {
    if (acao.includes('APPROVED') || acao.includes('CONFIRMED') || acao.includes('CREATED') || acao.includes('SENT')) return 'success';
    if (acao.includes('REJECTED') || acao.includes('DELETED') || acao.includes('PROBLEM') || acao.includes('FAILED')) return 'error';
    return 'info';
};
const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
    if (diffDays === 1) return 'ontem';
    return `${diffDays} dias atrás`;
};
// --- Fim Helpers ---


export default function DashboardPage() {
  // ATUALIZADO: Pega 'loading' do useAuth para saber quando 'user' está pronto
  const { user, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true); // Loading interno da página
  const [animatedValues, setAnimatedValues] = useState({});
  const [statsData, setStatsData] = useState({
    processosAtivos: 0,
    aguardandoAprovacao: 0,
    concluidosMes: 0,
    pendentesPortaria: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [error, setError] = useState(null);

  // Animar contadores (sem alteração)
  const animateStats = (stats) => {
    const values = {
      processos: stats.processosAtivos || 0,
      aprovacoes: stats.aguardandoAprovacao || 0,
      concluidos: stats.concluidosMes || 0,
      portaria: stats.pendentesPortaria || 0
    };

    Object.keys(values).forEach(key => {
      let current = 0;
      const target = values[key];
      // Evita divisão por zero se target for 0
      const increment = target === 0 ? 0 : (target / 20);
      
      if (increment === 0) {
         setAnimatedValues(prev => ({ ...prev, [key]: 0 }));
         return;
      }
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setAnimatedValues(prev => ({ ...prev, [key]: Math.floor(current) }));
      }, 50);
    });
  };

  // --- ATUALIZADO: useEffect com lógica de busca separada ---
  useEffect(() => {
    // Não faz nada se o auth estiver carregando ou se o usuário for nulo
    if (authLoading || !user) {
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Buscar estatísticas (chamada principal e obrigatória)
        console.log("[Dashboard] Buscando estatísticas...");
        const statsResponse = await api.get('/dashboard/stats');
        const stats = statsResponse.data;

        setStatsData({
          processosAtivos: stats.processosAtivos || 0,
          aguardandoAprovacao: stats.aguardandoAprovacao || 0,
          concluidosMes: stats.concluidosMes || 0,
          pendentesPortaria: stats.pendentesPortaria || 0
        });
        
        // Anima os números assim que chegarem
        animateStats(stats);
        
        // 2. Verifica permissão para auditoria
        const canViewAudit = user?.canViewAuditLog || user?.canAccessAdminPanel;

        if (canViewAudit) {
          console.log("[Dashboard] Usuário tem permissão. Buscando logs de auditoria...");
          // 3. Busca atividades recentes (chamada opcional em try/catch separado)
          try {
            const auditResponse = await api.get('/audit?limit=4');
            const auditLogs = auditResponse.data.data || []; // <-- CORREÇÃO: A API de audit retorna { logs: [] } ou { data: [] }? Verificando AuditLogPage... é { data: [] }
            
            const activities = auditLogs.map(log => ({
              id: log.id,
              type: getActivityType(log.entityType),
              action: getActionLabel(log.acao),
              description: log.detalhes || 'Sem detalhes',
              user: log.usuarioUpn,
              time: formatTimeAgo(log.timestamp),
              icon: getActivityIcon(log.acao),
              color: getActivityColor(log.acao),
              status: getActivityStatus(log.acao)
            }));
            setRecentActivities(activities);
          } catch (auditError) {
            // Se SÓ a auditoria falhar, loga o aviso mas não quebra a página
            console.warn("[Dashboard] Erro ao carregar logs de auditoria (mas estatísticas OK):", auditError.response?.data || auditError.message);
            setRecentActivities([]); // Garante que as atividades fiquem vazias
          }
        } else {
          // 3b. Se não tem permissão, apenas seta como vazio
          console.log("[Dashboard] Usuário sem permissão para auditoria. Pulando busca de atividades.");
          setRecentActivities([]);
        }
        
        // Se tudo (principalmente stats) correu bem
        setLoaded(true);

      } catch (err) {
        // Este 'catch' agora só pega erros da chamada /dashboard/stats
        console.error('[Dashboard] Erro fatal ao carregar estatísticas:', err);
        setError('Erro ao carregar dados do dashboard');
        // Define valores zerados em caso de erro
        setStatsData({
          processosAtivos: 0,
          aguardandoAprovacao: 0,
          concluidosMes: 0,
          pendentesPortaria: 0
        });
        animateStats({
          processosAtivos: 0,
          aguardandoAprovacao: 0,
          concluidosMes: 0,
          pendentesPortaria: 0
        }); // Anima para zero
      } finally {
        // Finaliza o loading da página (mesmo que a auditoria falhe)
        setLoading(false);
      }
    };

    fetchDashboardData();
    
  }, [user, authLoading]); // <-- Depende do user e do authLoading

  // --- Definição dos cards de 'stats' e 'quickActions' ---
  // (Usa 'user' para links condicionais)
  
  const stats = [
    {
      title: 'Processos Ativos',
      value: animatedValues.processos || 0,
      target: statsData.processosAtivos,
      change: statsData.processosAtivos > 0 ? '+12%' : '0%',
      changeType: statsData.processosAtivos > 0 ? 'positive' : 'neutral',
      icon: Activity,
      gradient: 'from-blue-500 to-blue-600',
      color: '#001f3f',
      link: null
    },
    {
      title: 'Aguardando Aprovação',
      value: animatedValues.aprovacoes || 0,
      target: statsData.aguardandoAprovacao,
      change: statsData.aguardandoAprovacao > 0 ? 'Requer atenção' : 'Nenhuma',
      changeType: statsData.aguardandoAprovacao > 0 ? 'neutral' : 'positive',
      icon: Clock,
      gradient: 'from-amber-500 to-orange-500',
      color: '#f59e0b',
      link: user?.canPerformApprovals ? '/aprovacoes' : null,
      urgent: statsData.aguardandoAprovacao > 5
    },
    {
      title: 'Concluídos (Mês)',
      value: animatedValues.concluidos || 0,
      target: statsData.concluidosMes,
      change: statsData.concluidosMes > 0 ? '+23%' : '0%',
      changeType: statsData.concluidosMes > 0 ? 'positive' : 'neutral',
      icon: CheckCircle,
      gradient: 'from-green-500 to-emerald-600',
      color: '#10b981',
      link: null
    },
    {
      title: 'Pendentes Portaria',
      value: animatedValues.portaria || 0,
      target: statsData.pendentesPortaria,
      change: statsData.pendentesPortaria > 0 ? 'Atenção' : 'Nenhum',
      changeType: statsData.pendentesPortaria > 0 ? 'alert' : 'positive',
      icon: AlertCircle,
      gradient: 'from-orange-500 to-red-500',
      color: '#f97316',
      link: user?.canAccessPortariaControl ? '/portaria' : null,
      urgent: statsData.pendentesPortaria > 3
    }
  ];

  const quickActions = [
    {
      title: 'Nova Saída de Máquina',
      description: 'Registrar saída de equipamento',
      icon: Package,
      gradient: 'from-blue-500 to-blue-600',
      link: '/maquinas',
      show: user?.canCreateSaidaMaquina
    },
    {
      title: 'Nova Transferência',
      description: 'Criar transferência entre fábricas',
      icon: Truck,
      gradient: 'from-purple-500 to-purple-600',
      link: '/transferencias',
      show: user?.canCreateTransferencia
    },
    {
      title: 'Aprovar Solicitações',
      description: 'Revisar pendências da equipe',
      icon: CheckCircle,
      gradient: 'from-green-500 to-green-600',
      link: '/aprovacoes',
      show: user?.canPerformApprovals
    }
  ].filter(action => action.show);


  // --- Renderização ---

  // Loading state (Auth ou da Página)
  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#001f3f] mx-auto mb-4" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state (Se a busca de stats falhou)
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-semibold mb-2">Erro ao carregar dashboard</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#001f3f] text-white rounded-lg hover:bg-[#002d52] transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Renderização de Sucesso
  return (
    <div className={`space-y-6 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header Premium com Gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#001f3f] via-[#002d52] to-[#001f3f] p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Sparkles size={24} className="text-yellow-300 animate-pulse" />
              <h1 className="text-3xl font-bold text-white">
                Bem-vindo de volta, {user?.nome?.split(' ')[0]}! 👋
              </h1>
            </div>
            <p className="text-blue-200">
              Aqui está um resumo do que está acontecendo hoje
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-xl">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-white">Sistema Operacional</span>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas - 4 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const progress = stat.target > 0 ? (stat.value / stat.target) * 100 : 0;

          return (
            <div
              key={index}
              className={`
                relative overflow-hidden
                bg-white/80 backdrop-blur-xl rounded-2xl
                shadow-lg border border-gray-200
                p-6
                hover:shadow-2xl hover:scale-105
                transition-all duration-300
                group
                ${stat.urgent ? 'ring-2 ring-red-500 ring-offset-2' : ''}
              `}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  
                  {stat.urgent && (
                    <div className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold animate-pulse">
                      URGENTE
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 font-medium mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</p>
                
                <div className="flex items-center justify-between">
                  <div className={`
                    flex items-center space-x-1 text-xs font-semibold
                    ${stat.changeType === 'positive' ? 'text-green-600' : ''}
                    ${stat.changeType === 'negative' ? 'text-red-600' : ''}
                    ${stat.changeType === 'neutral' ? 'text-amber-600' : ''}
                    ${stat.changeType === 'alert' ? 'text-red-600' : ''}
                  `}>
                    {stat.changeType === 'positive' && <TrendingUp size={14} />}
                    {stat.changeType === 'negative' && <TrendingDown size={14} />}
                    {stat.changeType === 'neutral' && <Clock size={14} />}
                    {stat.changeType === 'alert' && <AlertCircle size={14} />}
                    <span>{stat.change}</span>
                  </div>
                  
                  {stat.link && (
                    <Link
                      to={stat.link}
                      className="text-xs font-semibold text-[#001f3f] hover:underline flex items-center space-x-1"
                    >
                      <span>Ver</span>
                      <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
                
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${stat.gradient} transition-all duration-1000`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Principal - Atividades e Ações */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* ATUALIZADO: Renderização condicional do card de Atividades */}
        {(user?.canViewAuditLog || user?.canAccessAdminPanel) ? (
            <div className="xl:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Atividades Recentes</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {recentActivities.length > 0 
                        ? 'Últimas atualizações do sistema' 
                        : 'Nenhuma atividade recente'}
                    </p>
                  </div>
                  <Link
                    to="/audit"
                    className="px-4 py-2 bg-[#001f3f] text-white rounded-xl hover:scale-105 transition-transform duration-300 text-sm font-semibold shadow-lg"
                  >
                    Ver Todas
                  </Link>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div 
                        key={activity.id} 
                        className="p-6 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-300 group cursor-pointer"
                      >
                        <div className="flex items-start space-x-4">
                          <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${activity.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                            <Icon size={22} className="text-white" />
                            <div className={`absolute inset-0 bg-gradient-to-br ${activity.color} blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300`}></div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-900 group-hover:text-[#001f3f] transition-colors">
                                  {activity.action}
                                </p>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                                  {activity.description}
                                </p>
                              </div>
                              <ArrowRight size={18} className="text-gray-400 group-hover:text-[#001f3f] group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                            </div>
                            
                            <div className="flex items-center space-x-4 mt-3 text-xs">
                              <div className="flex items-center space-x-1.5 text-gray-500">
                                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold">
                                  {activity.user.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium">{activity.user}</span>
                              </div>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500">{activity.time}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center text-gray-500">
                    <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">Nenhuma atividade recente</p>
                    <p className="text-sm mt-1">As ações no sistema aparecerão aqui</p>
                  </div>
                )}
              </div>
              
              {recentActivities.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <Link 
                    to="/audit" 
                    className="flex items-center justify-center space-x-2 text-sm text-[#001f3f] hover:text-[#002d52] font-semibold group"
                  >
                    <span>Ver histórico completo</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              )}
            </div>
        ) : (
          // Se o usuário NÃO PODE ver auditoria, este card não é renderizado
          null 
        )}
        
        {/* Coluna Lateral - Ações Rápidas */}
        {/* ATUALIZADO: Faz o 'span 3' se a auditoria não for renderizada */}
        <div className={`space-y-6 ${(user?.canViewAuditLog || user?.canAccessAdminPanel) ? '' : 'xl:col-span-3'}`}>
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="text-lg font-bold text-gray-900">Ações Rápidas</h2>
              <p className="text-xs text-gray-600 mt-1">Acesso rápido</p>
            </div>
            
            <div className="p-4 space-y-3">
              {quickActions.length > 0 ? (
                quickActions.map((action, index) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={index}
                      to={action.link}
                      className="group relative flex items-center space-x-3 p-4 rounded-xl border-2 border-gray-200 hover:border-transparent hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                      
                      <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon size={22} className="text-white" />
                      </div>
                      
                      <div className="relative flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 group-hover:text-white transition-colors">
                          {action.title}
                        </p>
                        <p className="text-xs text-gray-600 group-hover:text-white/80 transition-colors">
                          {action.description}
                        </p>
                      </div>
                      
                      <ArrowRight size={18} className="relative text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <Package size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-medium">Nenhuma ação disponível</p>
                  <p className="text-xs mt-1">Entre em contato com o administrador</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta Importante (se houver aprovações pendentes) */}
      {user?.canPerformApprovals && statsData.aguardandoAprovacao > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-lg animate-fadeIn">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl"></div>
          
          <div className="relative flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg animate-pulse">
              <AlertCircle size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-900 mb-1">
                Você tem aprovações pendentes
              </h3>
              <p className="text-sm text-amber-700 mb-4">
                Existem <strong>{statsData.aguardandoAprovacao} {statsData.aguardandoAprovacao === 1 ? 'solicitação' : 'solicitações'}</strong> aguardando sua análise. Não deixe para depois!
              </p>
              <Link 
                to="/aprovacoes" 
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <span>Revisar Agora</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Animações CSS */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }

        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}