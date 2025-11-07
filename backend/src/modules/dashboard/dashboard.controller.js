// backend/src/modules/dashboard/dashboard.controller.js
const dashboardService = require('./dashboard.service');

/**
 * Controlador para endpoints do Dashboard
 */
const dashboardController = {
    
    /**
     * GET /api/dashboard/stats
     * Retorna estatísticas agregadas para o dashboard
     */
    getStats: async (req, res) => {
        try {
            const userAuth = req.user;
            
            if (!userAuth) {
                return res.status(401).json({ message: 'Usuário não autenticado' });
            }

            const stats = await dashboardService.getStats(userAuth);
            
            res.status(200).json(stats);
        } catch (error) {
            console.error('[Dashboard Controller] Erro em getStats:', error);
            res.status(500).json({ 
                message: 'Erro ao buscar estatísticas',
                error: error.message 
            });
        }
    },

    /**
     * GET /api/dashboard/trends
     * Retorna dados de tendências (últimos 7 dias)
     */
    getTrends: async (req, res) => {
        try {
            const userAuth = req.user;
            
            if (!userAuth) {
                return res.status(401).json({ message: 'Usuário não autenticado' });
            }

            const trends = await dashboardService.getTrendData(userAuth);
            
            res.status(200).json({ trends });
        } catch (error) {
            console.error('[Dashboard Controller] Erro em getTrends:', error);
            res.status(500).json({ 
                message: 'Erro ao buscar tendências',
                error: error.message 
            });
        }
    },

    /**
     * GET /api/dashboard/distribution
     * Retorna distribuição de processos por status
     */
    getDistribution: async (req, res) => {
        try {
            const userAuth = req.user;
            
            if (!userAuth) {
                return res.status(401).json({ message: 'Usuário não autenticado' });
            }

            const distribution = await dashboardService.getStatusDistribution(userAuth);
            
            res.status(200).json({ distribution });
        } catch (error) {
            console.error('[Dashboard Controller] Erro em getDistribution:', error);
            res.status(500).json({ 
                message: 'Erro ao buscar distribuição',
                error: error.message 
            });
        }
    }
};

module.exports = dashboardController;