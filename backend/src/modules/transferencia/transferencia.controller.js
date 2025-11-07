// src/modules/transferencia/transferencia.controller.js
const transferenciaService = require('./transferencia.service');

// Função auxiliar para tratar erros e enviar resposta
const handleError = (res, error, functionName) => {
    console.error(`Erro no Transferencia Controller [${functionName}]:`, error);
    // Tenta usar o statusCode definido no service (para erros 403, 404, etc.)
    // ou mapeia mensagens comuns
    let statusCode = 500;
    let message = `Erro interno no servidor ao ${functionName}.`;

    if (error.statusCode) { // Usa o status code definido no service (ex: 403 Forbidden)
        statusCode = error.statusCode;
        message = error.message;
    } else if (error.message) {
        if (error.message.includes('não encontrada')) statusCode = 404;
        else if (error.message.includes('inválid') || error.message.includes('obrigatório')) statusCode = 400;
        else if (error.message.includes('Acesso negado') || error.message.includes('Apenas o criador')) statusCode = 403;
        else if (error.message.includes('Não é possível editar') || error.message.includes('Não é possível excluir')) statusCode = 400;
        message = error.message;
    }

    res.status(statusCode).json({ message });
};


const transferenciaController = {

    // --- ROTA: GET / (Listar) ---
    listarTransferencias: async (req, res) => {
        try {
            // Passa userAuth (req.user) para o service filtrar
            const transferencias = await transferenciaService.listarTransferencias(req.user);
            res.status(200).json(transferencias);
        } catch (error) {
             handleError(res, error, 'listar transferências'); // <-- Usa handleError
        }
    },

    // --- ROTA: POST / (Criar) ---
    criarTransferencia: async (req, res) => {
        try {
            // req.user já era passado implicitamente
            const novaTransferencia = await transferenciaService.criarTransferencia(req.body, req.user);
            res.status(201).json(novaTransferencia);
        } catch (error) {
             handleError(res, error, 'criar transferência'); // <-- Usa handleError
        }
    },

    // --- ROTA: PUT /:id/saida (Registar Saída - Passando req) ---
    registarSaida: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                // Retorna erro diretamente para ID inválido
                return res.status(400).json({ message: 'ID inválido.' });
            }
            // req.user já está dentro de req
            const transferenciaAtualizada = await transferenciaService.registarSaida(id, req.body, req.user, req);
            res.status(200).json(transferenciaAtualizada);
        } catch (error) {
             handleError(res, error, 'registrar saída'); // <-- Usa handleError
        }
    },

    // --- ROTA: PUT /:id/chegada (Registar Chegada - Passando req) ---
    registarChegada: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                 // Retorna erro diretamente para ID inválido
                return res.status(400).json({ message: 'ID inválido.' });
            }
            // req.user já está dentro de req
            const transferenciaAtualizada = await transferenciaService.registarChegada(id, req.body, req.user, req);
            res.status(200).json(transferenciaAtualizada);
        } catch (error) {
             handleError(res, error, 'registrar chegada'); // <-- Usa handleError
        }
    },

    // --- ROTA: PUT /:id (Update) ---
    updateTransferencia: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

            // req.user já era passado implicitamente
            const transferenciaAtualizada = await transferenciaService.updateTransferencia(id, req.body, req.user);
            res.status(200).json(transferenciaAtualizada);
        } catch (error) {
            handleError(res, error, 'atualizar transferência'); // <-- Usa handleError
        }
    },

    // --- ROTA: DELETE /:id (Delete) ---
    deleteTransferencia: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

            // req.user já era passado implicitamente
            await transferenciaService.deleteTransferencia(id, req.user);
            res.status(204).send(); // Successo sem conteúdo
        } catch (error) {
            handleError(res, error, 'excluir transferência'); // <-- Usa handleError
        }
    },
};

module.exports = transferenciaController;
