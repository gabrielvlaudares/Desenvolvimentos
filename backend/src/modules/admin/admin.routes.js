// src/modules/admin/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

// Aplica proteção (login necessário) a TODAS as rotas abaixo
router.use(protect);

// --- Configurações (AppConfig) ---
router.get('/config', restrictTo('canManageConfig', 'canAccessAdminPanel'), adminController.getAllConfig);
router.put('/config', restrictTo('canManageConfig', 'canAccessAdminPanel'), adminController.updateConfig);

// --- Usuários Locais (LocalUser) ---
router.get('/users', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.getAllLocalUsers);
router.post('/users', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.createLocalUser);
router.put('/users/:id', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.updateLocalUser);
router.delete('/users/:id', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.deleteLocalUser);
router.post('/users/bulk-status', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.bulkUpdateUserStatus);

// --- Grupos de Permissão (PermissionGroup) ---
router.get('/groups', restrictTo('canManageGroups', 'canAccessAdminPanel'), adminController.getAllPermissionGroups);
router.post('/groups', restrictTo('canManageGroups', 'canAccessAdminPanel'), adminController.createPermissionGroup);
router.put('/groups/:id', restrictTo('canManageGroups', 'canAccessAdminPanel'), adminController.updatePermissionGroup);
router.delete('/groups/:id', restrictTo('canManageGroups', 'canAccessAdminPanel'), adminController.deletePermissionGroup);

// --- Busca e Teste LDAP ---
router.post('/ldap/search', restrictTo('canAccessAdminPanel'), adminController.searchLdapUsers);
router.post('/ldap/test', restrictTo('canAccessAdminPanel'), adminController.testLdapConnection);

// --- Rota de Teste de E-mail ---
router.post('/email/test', restrictTo('canManageConfig', 'canAccessAdminPanel'), adminController.testEmailSettings);

// --- Rota de Sincronização Manual ---
router.post('/ldap/sync', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.manualSyncLdapUsers);

// --- NOVAS Rotas de Substituição de Gestor ---
// Permissão para gerenciar usuários pode gerenciar substitutos
router.get('/substitutos', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.getAllSubstitutos);
router.post('/substitutos', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.createSubstituto);
router.delete('/substitutos/:id', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.deleteSubstituto);
// Rota para listar gestores (dropdown)
router.get('/gestores', restrictTo('canManageUsers', 'canAccessAdminPanel'), adminController.getGestoresList);

module.exports = router;