// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
// Não precisamos mais do prisma aqui se o payload do JWT já contém as permissões
// const prisma = require('../config/prisma');

// Middleware principal de autenticação
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Obter token do header
      token = req.headers.authorization.split(' ')[1];

      // 2. Verificar o token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Anexar o usuário à requisição (req.user)
      // O payload do token (gerado no authService) já contém as permissões calculadas
      req.user = decoded;

      next();
    } catch (error) {
      console.error('Erro na autenticação:', error.message);
      // Evitar expor detalhes do erro JWT
      let errorMessage = 'Token inválido ou expirado. Faça login novamente.';
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Sessão expirada. Faça login novamente.';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Token inválido. Faça login novamente.';
      }
      return res.status(401).json({ message: errorMessage });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
  }
};

// Middleware de Autorização (RBAC) - Sem alterações na lógica interna
// Recebe os nomes das flags de permissão (ex: 'canAccessAdminPanel', 'canPerformApprovals')
const restrictTo = (...requiredPermissions) => {
  return (req, res, next) => {
    // 'requiredPermissions' é um array (ex: ['canAccessAdminPanel'])
    // 'req.user' foi definido no middleware 'protect' e contém as flags de permissão do usuário

    // Verifica se o usuário possui PELO MENOS UMA das permissões requeridas
    const hasPermission = requiredPermissions.some(permissionKey => req.user[permissionKey] === true);

    if (!hasPermission) {
      // Log de tentativa de acesso negado (opcional, mas útil)
      console.warn(`[AUTH_WARN] Acesso negado para usuário ${req.user?.username || 'desconhecido'} à rota ${req.originalUrl}. Permissões requeridas: ${requiredPermissions.join(', ')}`);
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }

    next(); // Permissão concedida
  };
};

module.exports = { protect, restrictTo };
