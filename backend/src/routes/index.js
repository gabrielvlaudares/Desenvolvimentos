// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar roteadores
const authRoutes = require('../modules/auth/auth.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const maquinaRoutes = require('../modules/maquina/maquina.routes');
const transferenciaRoutes = require('../modules/transferencia/transferencia.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');

// Registrar rotas
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/maquinas', maquinaRoutes);
router.use('/transferencias', transferenciaRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);

// Exportar router
module.exports = router;