// src/modules/audit/audit.service.js
const prisma = require('../../config/prisma');

const auditService = {
  /**
   * Busca eventos de auditoria com filtros e paginação.
   * @param {object} filters - Objeto contendo os filtros.
   * @param {string} [filters.startDate] - Data de início (YYYY-MM-DD).
   * @param {string} [filters.endDate] - Data de fim (YYYY-MM-DD).
   * @param {string} [filters.usuarioUpn] - Username do usuário.
   * @param {string} [filters.acao] - Tipo de ação.
   * @param {string} [filters.entityType] - Tipo de entidade.
   * @param {number} [page=1] - Número da página.
   * @param {number} [limit=25] - Quantidade de itens por página.
   * @returns {Promise<{ total: number, page: number, limit: number, data: ProcessoEvento[] }>} - Resultado paginado.
   */
  getAuditLogs: async (filters = {}, page = 1, limit = 25) => {
    const { startDate, endDate, usuarioUpn, acao, entityType } = filters;
    const whereClause = {};

    // Construção da cláusula WHERE baseada nos filtros
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        // Inclui o dia inteiro da data de início
        whereClause.timestamp.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        // Inclui o dia inteiro da data de fim
        whereClause.timestamp.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }
    if (usuarioUpn) {
      // Usar 'contains' para busca parcial ou 'equals' para exata
      whereClause.usuarioUpn = { contains: usuarioUpn, mode: 'insensitive' };
    }
    if (acao) {
      whereClause.acao = { equals: acao, mode: 'insensitive' };
    }
    if (entityType) {
      whereClause.entityType = { equals: entityType, mode: 'insensitive' };
    }

    // Calcular offset para paginação
    const skip = (page - 1) * limit;

    try {
      // Contar o total de registos que correspondem aos filtros
      const total = await prisma.processoEvento.count({
        where: whereClause,
      });

      // Buscar os registos da página atual
      const data = await prisma.processoEvento.findMany({
        where: whereClause,
        orderBy: {
          timestamp: 'desc', // Ordena pelos mais recentes primeiro
        },
        skip: skip,
        take: limit,
      });

      console.log(`[AuditService] Busca realizada com filtros: ${JSON.stringify(whereClause)}, Página: ${page}, Limite: ${limit}. Encontrados: ${total}`);

      return {
        total,
        page,
        limit,
        data,
      };
    } catch (error) {
      console.error('[AuditService] Erro ao buscar logs de auditoria:', error);
      throw new Error('Falha ao consultar os logs de auditoria.');
    }
  },

  /**
   * Obtém uma lista de todas as ações distintas registradas no log.
   * @returns {Promise<string[]>} - Array de strings com os nomes das ações.
   */
  getDistinctActions: async () => {
    try {
      const distinctActions = await prisma.processoEvento.findMany({
        select: {
          acao: true,
        },
        distinct: ['acao'],
        orderBy: {
          acao: 'asc',
        },
      });
      return distinctActions.map(item => item.acao);
    } catch (error) {
      console.error('[AuditService] Erro ao buscar ações distintas:', error);
      throw new Error('Falha ao buscar tipos de ações.');
    }
  },

  /**
   * Obtém uma lista de todos os tipos de entidade distintos registrados no log.
   * @returns {Promise<string[]>} - Array de strings com os tipos de entidade.
   */
    getDistinctEntityTypes: async () => {
        try {
          const distinctTypes = await prisma.processoEvento.findMany({
            select: {
              entityType: true,
            },
            distinct: ['entityType'],
            orderBy: {
              entityType: 'asc',
            },
          });
          return distinctTypes.map(item => item.entityType);
        } catch (error) {
          console.error('[AuditService] Erro ao buscar tipos de entidade distintos:', error);
          throw new Error('Falha ao buscar tipos de entidade.');
        }
      },
};

module.exports = auditService;
