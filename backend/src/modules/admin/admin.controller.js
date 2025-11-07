// src/modules/admin/admin.controller.js
const adminService = require('./admin.service');

// Função auxiliar para tratamento de erros
const handleError = (res, error, functionName) => {
    console.error(`Erro no Admin Controller [${functionName}]:`, error);
    let statusCode = 500;
    let message = `Erro interno no servidor ao ${functionName}.`;

    if (error.code === 'P2002') { 
        statusCode = 400;
        const target = error.meta?.target || [];
        if (target.includes('username')) message = 'Este nome de usuário já está em uso.';
        else if (target.includes('email')) message = 'Este e-mail já está em uso.';
        else if (target.includes('nome') && functionName.includes('Group')) message = 'Um grupo com este nome já existe.';
        else message = 'Violação de constraint única.';
    } else if (error.code === 'P2025') { 
        statusCode = 404;
        message = 'Recurso não encontrado.';
    } else if (error.message) {
        if (error.message.includes('inválid') || error.message.includes('obrigatório') || error.message.includes('encontrad') || error.message.includes('Falha') || error.message.includes('conflita')) {
            statusCode = error.message.includes('encontrad') ? 404 : 400;
            message = error.message;
        }
    }

    res.status(statusCode).json({ message });
};


// --- Config ---
// (Funções getAllConfig, updateConfig permanecem iguais)
const getAllConfig = async (req, res) => {
  try {
    const config = await adminService.getAllConfig();
    res.status(200).json(config);
  } catch (error) {
    handleError(res, error, 'buscar configurações');
  }
};

const updateConfig = async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [req.body];
    await adminService.updateConfig(updates, req.user); 
    res.status(200).json({ message: 'Configurações atualizadas com sucesso.' });
  } catch (error) {
    handleError(res, error, 'salvar configurações');
  }
};

// --- Users ---
// (Funções getAllLocalUsers, createLocalUser, updateLocalUser, deleteLocalUser permanecem iguais)
const getAllLocalUsers = async (req, res) => {
  try {
    const users = await adminService.getAllLocalUsers();
    res.status(200).json(users);
  } catch (error) {
    handleError(res, error, 'buscar usuários');
  }
};

const createLocalUser = async (req, res) => {
  try {
    const newUser = await adminService.createLocalUser(req.body, req.user); 
    res.status(201).json(newUser);
  } catch (error) {
    handleError(res, error, 'criar usuário');
  }
};

const updateLocalUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de usuário inválido.' });
    const updatedUser = await adminService.updateLocalUser(id, req.body, req.user); 
    res.status(200).json(updatedUser);
  } catch (error) {
    handleError(res, error, 'atualizar usuário');
  }
};

const deleteLocalUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de usuário inválido.' });
    await adminService.deleteLocalUser(id, req.user); 
    res.status(204).send();
  } catch (error) {
    handleError(res, error, 'deletar usuário');
  }
};


// --- Grupos ---
// (Funções de Grupo permanecem iguais)
const getAllPermissionGroups = async (req, res) => {
  try {
    const groups = await adminService.getAllPermissionGroups();
    res.status(200).json(groups);
  } catch (error) {
    handleError(res, error, 'buscar grupos');
  }
};

const createPermissionGroup = async (req, res) => {
  try {
    const newGroup = await adminService.createPermissionGroup(req.body, req.user); 
    res.status(201).json(newGroup);
  } catch (error) {
    handleError(res, error, 'criar grupo');
  }
};

const updatePermissionGroup = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
     if (isNaN(id)) return res.status(400).json({ message: 'ID de grupo inválido.' });
    const updatedGroup = await adminService.updatePermissionGroup(id, req.body, req.user); 
    res.status(200).json(updatedGroup);
  } catch (error) {
    handleError(res, error, 'atualizar grupo');
  }
};

const deletePermissionGroup = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID de grupo inválido.' });
    await adminService.deletePermissionGroup(id, req.user); 
    res.status(204).send();
  } catch (error) {
    handleError(res, error, 'deletar grupo');
  }
};

// --- Teste LDAP ---
const testLdapConnection = async (req, res) => {
  try {
    const configData = req.body;
    const result = await adminService.testLdapConnection(configData);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// --- Busca LDAP ---
const searchLdapUsers = async (req, res) => {
  try {
    const { searchTerm, adminUsername, adminPassword } = req.body; 

    if (!searchTerm || searchTerm.length < 3) {
      return res.status(400).json({ message: 'Termo de busca deve ter pelo menos 3 caracteres.' });
    }
    if (!adminUsername || !adminPassword) {
        return res.status(400).json({ message: 'Credenciais do administrador AD são obrigatórias para a busca.' });
    }

    const users = await adminService.searchLdapUsers(searchTerm, adminUsername, adminPassword);
    res.status(200).json(users);
  } catch (error) {
    const statusCode = error.message.includes('Configuração') || error.message.includes('Credenciais') || error.message.includes('Falha') || error.message.includes('Erro') ? 400 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

// --- Teste E-mail ---
const testEmailSettings = async (req, res) => {
    try {
        const { testEmail } = req.body;
        if (!testEmail) {
            return res.status(400).json({ message: 'O e-mail de destino é obrigatório para o teste.' });
        }
        const result = await adminService.testEmailSettings(testEmail, req.user);
        res.status(200).json(result);
    } catch (error) {
        handleError(res, error, 'testar configurações de e-mail');
    }
};

// --- Sincronização Manual ---
const manualSyncLdapUsers = async (req, res) => {
    try {
      const results = await adminService.syncLdapUsers(req.user);
      res.status(200).json(results);
    } catch (error) {
      handleError(res, error, 'sincronizar usuários AD');
    }
};

// --- Ação em Massa ---
const bulkUpdateUserStatus = async (req, res) => {
    try {
        const { userIds, ativo } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0 || typeof ativo !== 'boolean') {
            return res.status(400).json({ message: 'Payload inválido. "userIds" (array) e "ativo" (boolean) são obrigatórios.' });
        }
        const results = await adminService.bulkUpdateUserStatus({ userIds, ativo, auditorUser: req.user });
        res.status(200).json(results);
    } catch (error) {
        handleError(res, error, 'atualizar status de usuários em massa');
    }
};

// --- NOVOS: Controladores de Substituição ---
const getAllSubstitutos = async (req, res) => {
  try {
    const substitutos = await adminService.getAllSubstitutos();
    res.status(200).json(substitutos);
  } catch (error) {
    handleError(res, error, 'buscar substituições');
  }
};

const createSubstituto = async (req, res) => {
  try {
    const newSubstituto = await adminService.createSubstituto(req.body, req.user);
    res.status(201).json(newSubstituto);
  } catch (error) {
    handleError(res, error, 'criar substituição');
  }
};

const deleteSubstituto = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'ID inválido.' });
    await adminService.deleteSubstituto(id, req.user);
    res.status(204).send();
  } catch (error) {
    handleError(res, error, 'deletar substituição');
  }
};

const getGestoresList = async (req, res) => {
    try {
        const gestores = await adminService.getGestoresList();
        res.status(200).json(gestores);
    } catch (error) {
        handleError(res, error, 'listar gestores');
    }
};

module.exports = {
  getAllConfig,
  updateConfig,
  getAllLocalUsers,
  createLocalUser,
  updateLocalUser,
  deleteLocalUser,
  getAllPermissionGroups,
  createPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
  testLdapConnection,
  searchLdapUsers,
  testEmailSettings,
  manualSyncLdapUsers,
  bulkUpdateUserStatus,
  
  // --- NOVOS Exports ---
  getAllSubstitutos,
  createSubstituto,
  deleteSubstituto,
  getGestoresList,
};