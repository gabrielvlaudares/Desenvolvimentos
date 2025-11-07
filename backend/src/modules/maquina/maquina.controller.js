// src/modules/maquina/maquina.controller.js
const maquinaService = require('./maquina.service');

// Função auxiliar para tratamento de erros
const handleError = (res, error, functionName) => {
    console.error(`Erro no Maquina Controller [${functionName}]:`, error);
    let statusCode = 500;
    let message = `Erro interno no servidor ao ${functionName}.`;

    // Mapeia mensagens de erro comuns ou códigos para status HTTP
    if (error.message) {
        if (error.message.includes('não encontrada')) statusCode = 404;
        else if (error.message.includes('inválid') || error.message.includes('obrigatória')) statusCode = 400;
        else if (error.message.includes('Acesso negado') || error.message.includes('Apenas o gestor') || error.message.includes('Apenas o solicitante')) statusCode = 403; // Forbidden
        else if (error.message.includes('Não é possível editar') || error.message.includes('Não é possível excluir')) statusCode = 400; // Bad Request for invalid state
        message = error.message;
    }

    res.status(statusCode).json({ message });
};

const maquinaController = {
    // --- Listar ---
    listarSaidas: async (req, res) => {
        try {
            // Passa req.user para o service filtrar a visibilidade
            const saidas = await maquinaService.listarSaidas(req.user);
            res.status(200).json(saidas);
        } catch (error) {
            handleError(res, error, 'listar saídas');
        }
    },

    // --- Criar ---
    criarSaida: async (req, res) => {
        try {
            // --- Passar req.user ---
            const novaSaida = await maquinaService.criarSaida(req.body, req.user); // <-- Passa req.user
            res.status(201).json(novaSaida);
        } catch (error) {
             handleError(res, error, 'criar saída');
        }
    },

    // --- Aprovar ---
    aprovarSaida: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
             if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });
            // --- Passar req.user ---
            const saidaAtualizada = await maquinaService.aprovarSaida(id, req.user); // <-- Passa req.user
            res.status(200).json(saidaAtualizada);
        } catch (error) {
             handleError(res, error, 'aprovar saída');
        }
    },

    // --- Rejeitar ---
     rejeitarSaida: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { motivoRejeicao } = req.body;
             if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });
             if (!motivoRejeicao) return res.status(400).json({ message: 'Motivo da rejeição é obrigatório.' });

            // --- Passar req.user ---
            const saidaAtualizada = await maquinaService.rejeitarSaida(id, motivoRejeicao, req.user); // <-- Passa req.user
            res.status(200).json(saidaAtualizada);
        } catch (error) {
             handleError(res, error, 'rejeitar saída');
        }
    },

    // --- Saída Portaria ---
    registrarSaidaPortaria: async (req, res) => {
         try {
            const id = parseInt(req.params.id);
             if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });
            // --- Passar req.user ---
            const saidaAtualizada = await maquinaService.registrarSaidaPortaria(id, req.body, req.user); // <-- Passa req.user
            res.status(200).json(saidaAtualizada);
        } catch (error) {
             handleError(res, error, 'registrar saída na portaria');
        }
    },

    // --- Retorno Manutenção ---
     registrarRetornoManutencao: async (req, res) => {
         try {
            const id = parseInt(req.params.id);
             if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });
            // --- Passar req.user ---
            const saidaAtualizada = await maquinaService.registrarRetornoManutencao(id, req.body, req.user); // <-- Passa req.user
            res.status(200).json(saidaAtualizada);
        } catch (error) {
             handleError(res, error, 'registrar retorno de manutenção');
        }
    },

    // --- Atualizar ---
    updateSaida: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

            // --- Passar req.user ---
            const saidaAtualizada = await maquinaService.updateSaida(id, req.body, req.user); // <-- Passa req.user
            res.status(200).json(saidaAtualizada);
        } catch (error) {
            handleError(res, error, 'atualizar saída');
        }
    },

    // --- Excluir ---
    deleteSaida: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });

            // --- Passar req.user ---
            await maquinaService.deleteSaida(id, req.user); // <-- Passa req.user
            res.status(204).send(); // Sucesso sem conteúdo
        } catch (error) {
            handleError(res, error, 'excluir saída');
        }
    },
};

module.exports = maquinaController;
