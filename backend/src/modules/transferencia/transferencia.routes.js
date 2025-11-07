// src/modules/transferencia/transferencia.routes.js
const express = require('express');
const router = express.Router();
const transferenciaController = require('./transferencia.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

// Todas as rotas exigem login
router.use(protect);

// Listar (Todos logados podem listar, o service filtra a visão)
router.get('/', transferenciaController.listarTransferencias);

// Criar (Precisa permissão específica para criar transferência)
// Adicionar 'canAccessAdminPanel' aqui se admin também puder criar sem a flag específica
router.post('/', restrictTo('canCreateTransferencia', 'canAccessAdminPanel'), transferenciaController.criarTransferencia);

// Registar Saída e Chegada (Precisa ser Portaria OU Admin)
router.put('/:id/saida', restrictTo('canAccessPortariaControl', 'canAccessAdminPanel'), transferenciaController.registarSaida);
router.put('/:id/chegada', restrictTo('canAccessPortariaControl', 'canAccessAdminPanel'), transferenciaController.registarChegada);

// Atualizar (Service valida criador ou admin internamente)
// Não precisa de restrictTo específico aqui, pois a lógica está no service
router.put('/:id', transferenciaController.updateTransferencia);

// Excluir (Service valida criador ou admin internamente)
// Não precisa de restrictTo específico aqui, pois a lógica está no service
router.delete('/:id', transferenciaController.deleteTransferencia);

module.exports = router;
