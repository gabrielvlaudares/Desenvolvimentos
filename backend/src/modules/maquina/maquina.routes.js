// src/modules/maquina/maquina.routes.js (Exemplo de Atualização)
const express = require('express');
const router = express.Router();
const maquinaController = require('./maquina.controller');
const { protect, restrictTo } = require('../../middleware/authMiddleware');

// Todas as rotas de máquinas exigem login
router.use(protect);

// --- Rotas Principais ---
// Listar (acessível a todos logados, o service filtra a visibilidade)
router.get('/', maquinaController.listarSaidas);

// Criar (Requer permissão específica para criar)
router.post('/', restrictTo('canCreateSaidaMaquina'), maquinaController.criarSaida);

// --- Rotas de Fluxo de Trabalho e CRUD ---

// Aprovar / Rejeitar (Requer permissão para realizar aprovações)
router.put('/:id/aprovar', restrictTo('canPerformApprovals'), maquinaController.aprovarSaida);
router.put('/:id/rejeitar', restrictTo('canPerformApprovals'), maquinaController.rejeitarSaida);

// Registrar Saída na Portaria (Requer permissão de acesso à portaria)
router.put('/:id/saida-portaria', restrictTo('canAccessPortariaControl'), maquinaController.registrarSaidaPortaria);

// Registrar Retorno (logado; service valida criador/gestor/admin internamente, não precisa restrictTo aqui)
router.put('/:id/retorno', maquinaController.registrarRetornoManutencao);

// Atualizar (logado; service valida status e criador/admin internamente)
// Poderia adicionar restrictTo('canAccessAdminPanel') se SÓ admin pudesse editar, mas a lógica atual permite o criador.
router.put('/:id', maquinaController.updateSaida);

// Excluir (logado; service valida status e criador/admin internamente)
// Poderia adicionar restrictTo('canAccessAdminPanel') se SÓ admin pudesse excluir.
router.delete('/:id', maquinaController.deleteSaida);

module.exports = router;
