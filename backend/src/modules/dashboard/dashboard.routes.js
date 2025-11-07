// backend/src/modules/dashboard/dashboard.routes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/authMiddleware');
const dashboardController = require('./dashboard.controller');

/**
 * Rotas do Dashboard
 * Todas protegidas por autenticação
 */

/**
 * @route   GET /api/dashboard/stats
 * @desc    Obtém estatísticas agregadas do dashboard
 * @access  Private
 */
router.get('/stats', protect, dashboardController.getStats);

/**
 * @route   GET /api/dashboard/trends
 * @desc    Obtém dados de tendências (últimos 7 dias)
 * @access  Private
 */
router.get('/trends', protect, dashboardController.getTrends);

/**
 * @route   GET /api/dashboard/distribution
 * @desc    Obtém distribuição de processos por status
 * @access  Private
 */
router.get('/distribution', protect, dashboardController.getDistribution);

module.exports = router;