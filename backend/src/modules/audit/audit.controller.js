// src/modules/audit/audit.controller.js
const auditService = require('./audit.service');

const auditController = {
  /**
   * GET /api/audit
   * Busca logs de auditoria com filtros e paginação.
   * Query Params: startDate, endDate, usuarioUpn, acao, entityType, page, limit
   */
  getAuditLogs: async (req, res) => {
    try {
      // Extrai filtros da query string
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        usuarioUpn: req.query.usuarioUpn,
        acao: req.query.acao,
        entityType: req.query.entityType,
      };

      // Extrai paginação (com valores padrão)
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 25; // Padrão de 25 itens por página

      // Remove filtros vazios para não interferir na query do Prisma
      Object.keys(filters).forEach(key => {
        if (!filters[key]) {
          delete filters[key];
        }
      });

      const result = await auditService.getAuditLogs(filters, page, limit);
      res.status(200).json(result);

    } catch (error) {
      console.error('[AuditController] Erro em getAuditLogs:', error);
      res.status(500).json({ message: error.message || 'Erro interno ao buscar logs de auditoria.' });
    }
  },

  /**
   * GET /api/audit/actions
   * Retorna uma lista de ações únicas registradas.
   */
  getDistinctActions: async (req, res) => {
    try {
      const actions = await auditService.getDistinctActions();
      res.status(200).json(actions);
    } catch (error) {
        console.error('[AuditController] Erro em getDistinctActions:', error);
        res.status(500).json({ message: error.message || 'Erro interno ao buscar ações distintas.' });
    }
  },

  /**
   * GET /api/audit/entityTypes
   * Retorna uma lista de tipos de entidade únicos registrados.
   */
  getDistinctEntityTypes: async (req, res) => {
    try {
      const entityTypes = await auditService.getDistinctEntityTypes();
      res.status(200).json(entityTypes);
    } catch (error) {
        console.error('[AuditController] Erro em getDistinctEntityTypes:', error);
        res.status(500).json({ message: error.message || 'Erro interno ao buscar tipos de entidade distintos.' });
    }
  },
};

module.exports = auditController;
