// src/modules/audit/audit.routes.js
const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

// Aplicar autenticação (protect) e autorização (restrictTo) a todas as rotas de auditoria
// Permite acesso se o usuário tiver a flag 'canViewAuditLog' OU 'canAccessAdminPanel'
router.use(protect, restrictTo('canViewAuditLog', 'canAccessAdminPanel'));

// Rota principal para buscar logs com filtros e paginação
// GET /api/audit?startDate=...&page=...
router.get('/', auditController.getAuditLogs);

// Rota para obter a lista de ações únicas para o filtro
// GET /api/audit/actions
router.get('/actions', auditController.getDistinctActions);

// Rota para obter a lista de tipos de entidade únicos para o filtro
// GET /api/audit/entityTypes
router.get('/entityTypes', auditController.getDistinctEntityTypes);


module.exports = router;