// backend/src/modules/dashboard/dashboard.service.js
const prisma = require('../../config/prisma');

/**
 * Serviço para estatísticas do Dashboard
 * Fornece dados reais agregados para substituir os valores fictícios
 *
 * CORRIGIDO: Esta versão diferencia as queries para MaquinaSaida (que usa gestorEmail)
 * e Transferencia (que usa gestor (nome)), que estava causando o crash para usuários gestores.
 */
const dashboardService = {
    
    /**
     * Obtém estatísticas gerais para o dashboard do usuário
     * @param {Object} userAuth - Usuário autenticado (do token JWT)
     * @returns {Object} Estatísticas agregadas
     */
    getStats: async (userAuth) => {
        try {
            // Define o filtro baseado nas permissões do usuário
            const isAdmin = userAuth.canAccessAdminPanel;
            const isGestor = userAuth.canPerformApprovals;
            const isPortaria = userAuth.canAccessPortariaControl;

            // 1. PROCESSOS ATIVOS (Máquinas + Transferências em andamento)
            
            // --- Filtro Base para Máquinas ---
            let whereMaquinasAtivas = {
                statusProcesso: {
                    in: ['Aguardando Aprovação', 'Aguardando Portaria', 'Em Manutenção'] // 'Em Manutenção' substitui 'Aguardando Retorno'
                }
            };
            
            // --- Filtro Base para Transferências ---
            let whereTransferenciasAtivas = {
                statusProcesso: {
                    in: ['Em andamento', 'Em trânsito']
                }
            };
            
            if (!isAdmin) {
                if (isGestor) {
                    // Gestor vê os que criou + os que ele é responsável
                    whereMaquinasAtivas.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestorEmail: { equals: userAuth.email, mode: 'insensitive' } } // Maquina usa Email
                    ];
                    whereTransferenciasAtivas.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestor: { equals: userAuth.nome, mode: 'insensitive' } } // Transferencia usa Nome
                    ];
                } else if (isPortaria) {
                    // Portaria vê os que estão em seu controle (status já filtrados acima)
                    // Não precisa de filtro adicional aqui, pois portaria vê todos os pendentes
                } else {
                    // Usuário comum só vê os que criou
                    whereMaquinasAtivas.criadoPorUpn = userAuth.username;
                    whereTransferenciasAtivas.criadoPorUpn = userAuth.username;
                }
            }

            // Conta Saídas de Máquinas ativas
            const maquinasAtivas = await prisma.maquinaSaida.count({
                where: whereMaquinasAtivas
            });

            // Conta Transferências ativas
            const transferenciasAtivas = await prisma.transferencia.count({
                where: whereTransferenciasAtivas
            });

            const processosAtivos = maquinasAtivas + transferenciasAtivas;

            // 2. AGUARDANDO APROVAÇÃO (apenas para gestores e admins)
            let aguardandoAprovacao = 0;
            
            if (isGestor || isAdmin) {
                // Apenas MaquinaSaida tem fluxo de aprovação de gestor
                const whereAprovacaoMaquina = {
                    statusProcesso: 'Aguardando Aprovação'
                };
                
                if (!isAdmin) {
                    // Gestor só vê as pendentes para ele
                    whereAprovacaoMaquina.gestorEmail = { equals: userAuth.email, mode: 'insensitive' };
                }
                
                aguardandoAprovacao = await prisma.maquinaSaida.count({
                    where: whereAprovacaoMaquina
                });
            }

            // 3. CONCLUÍDOS NO MÊS (último mês)
            const primeiroDiaMes = new Date();
            primeiroDiaMes.setDate(1);
            primeiroDiaMes.setHours(0, 0, 0, 0);

            // Filtros base
            let whereConcluidosMaquina = {
                criadoEm: { gte: primeiroDiaMes },
                statusProcesso: 'Concluído'
            };
            let whereConcluidosTransf = {
                criadoEm: { gte: primeiroDiaMes },
                statusProcesso: 'Concluído'
            };

            if (!isAdmin) {
                if (isGestor) {
                    whereConcluidosMaquina.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestorEmail: { equals: userAuth.email, mode: 'insensitive' } }
                    ];
                    whereConcluidosTransf.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestor: { equals: userAuth.nome, mode: 'insensitive' } }
                    ];
                } else if (!isPortaria) { // Usuário comum (não-gestor, não-portaria)
                    whereConcluidosMaquina.criadoPorUpn = userAuth.username;
                    whereConcluidosTransf.criadoPorUpn = userAuth.username;
                }
                // Se for SÓ portaria (e não gestor/admin), vê todos concluídos do mês
            }

            const maquinasConcluidas = await prisma.maquinaSaida.count({
                where: whereConcluidosMaquina
            });

            const transferenciasConcluidas = await prisma.transferencia.count({
                where: whereConcluidosTransf
            });

            const concluidosMes = maquinasConcluidas + transferenciasConcluidas;

            // 4. PENDENTES NA PORTARIA (apenas para portaria e admins)
            let pendentesPortaria = 0;

            if (isPortaria || isAdmin) {
                // Máquinas aguardando portaria
                const maquinasPendentes = await prisma.maquinaSaida.count({
                    where: {
                        statusProcesso: 'Aguardando Portaria'
                    }
                });

                // Transferências em andamento (aguardando saída) ou em trânsito (aguardando chegada)
                const transferenciasPendentes = await prisma.transferencia.count({
                    where: {
                        statusProcesso: {
                            in: ['Em andamento', 'Em trânsito']
                        }
                    }
                });

                pendentesPortaria = maquinasPendentes + transferenciasPendentes;
            }

            // Retorna as estatísticas
            return {
                processosAtivos,
                aguardandoAprovacao,
                concluidosMes,
                pendentesPortaria
            };

        } catch (error) {
            console.error('[Dashboard Service] Erro ao buscar estatísticas:', error);
            throw new Error('Erro ao buscar estatísticas do dashboard');
        }
    },

    /**
     * Obtém gráfico de tendências (últimos 7 dias)
     * @param {Object} userAuth - Usuário autenticado
     * @returns {Array} Dados para gráfico de linha
     */
    getTrendData: async (userAuth) => {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const isAdmin = userAuth.canAccessAdminPanel;
            const isGestor = userAuth.canPerformApprovals;
            const isPortaria = userAuth.canAccessPortariaControl;
            
            // Filtros base
            let whereTrendMaquina = { criadoEm: { gte: sevenDaysAgo } };
            let whereTrendTransf = { criadoEm: { gte: sevenDaysAgo } };

            if (!isAdmin) {
                if (isGestor) {
                    whereTrendMaquina.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestorEmail: { equals: userAuth.email, mode: 'insensitive' } }
                    ];
                    whereTrendTransf.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestor: { equals: userAuth.nome, mode: 'insensitive' } }
                    ];
                } else if (isPortaria) {
                    // Portaria vê todas as tendências (sem filtro de UPN/gestor)
                } else { // Usuário comum
                    whereTrendMaquina.criadoPorUpn = userAuth.username;
                    whereTrendTransf.criadoPorUpn = userAuth.username;
                }
            }

            // Buscar processos criados nos últimos 7 dias agrupados por dia
            const maquinas = await prisma.maquinaSaida.findMany({
                where: whereTrendMaquina,
                select: { criadoEm: true }
            });

            const transferencias = await prisma.transferencia.findMany({
                where: whereTrendTransf,
                select: { criadoEm: true }
            });

            // Agrupa por dia
            const trendMap = {};
            const allProcessos = [...maquinas, ...transferencias];

            allProcessos.forEach(proc => {
                const date = new Date(proc.criadoEm);
                const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                
                if (!trendMap[dayKey]) {
                    trendMap[dayKey] = 0;
                }
                trendMap[dayKey]++;
            });

            // Converte para array ordenado
            const trendData = Object.keys(trendMap)
                .sort()
                .map(date => ({
                    date,
                    count: trendMap[date]
                }));

            return trendData;

        } catch (error) {
            console.error('[Dashboard Service] Erro ao buscar tendências:', error);
            throw new Error('Erro ao buscar tendências');
        }
    },

    /**
     * Obtém distribuição de processos por status
     * @param {Object} userAuth - Usuário autenticado
     * @returns {Object} Contadores por status
     */
    getStatusDistribution: async (userAuth) => {
        try {
            const isAdmin = userAuth.canAccessAdminPanel;
            const isGestor = userAuth.canPerformApprovals;
            const isPortaria = userAuth.canAccessPortariaControl;
            
            // Filtros base
            let whereStatusMaquina = {};
            let whereStatusTransf = {};

            if (!isAdmin) {
                if (isGestor) {
                    whereStatusMaquina.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestorEmail: { equals: userAuth.email, mode: 'insensitive' } }
                    ];
                    whereStatusTransf.OR = [
                        { criadoPorUpn: userAuth.username },
                        { gestor: { equals: userAuth.nome, mode: 'insensitive' } }
                    ];
                } else if (isPortaria) {
                    // Portaria vê todos os status (sem filtro de UPN/gestor)
                } else { // Usuário comum
                    whereStatusMaquina.criadoPorUpn = userAuth.username;
                    whereStatusTransf.criadoPorUpn = userAuth.username;
                }
            }

            // Buscar todas as saídas de máquinas
            const maquinas = await prisma.maquinaSaida.groupBy({
                by: ['statusProcesso'],
                where: whereStatusMaquina,
                _count: true
            });

            // Buscar todas as transferências
            const transferencias = await prisma.transferencia.groupBy({
                by: ['statusProcesso'],
                where: whereStatusTransf,
                _count: true
            });

            // Combinar os resultados
            const distribution = {};

            maquinas.forEach(item => {
                distribution[item.statusProcesso] = (distribution[item.statusProcesso] || 0) + item._count;
            });

            transferencias.forEach(item => {
                distribution[item.statusProcesso] = (distribution[item.statusProcesso] || 0) + item._count;
            });

            return distribution;

        } catch (error) {
            console.error('[Dashboard Service] Erro ao buscar distribuição:', error);
            throw new Error('Erro ao buscar distribuição de status');
        }
    }
};

module.exports = dashboardService;