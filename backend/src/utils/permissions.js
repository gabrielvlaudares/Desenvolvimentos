// src/utils/permissions.js
const prisma = require('../config/prisma');

const getUserPermissions = async (userId) => {
    // Fallback inicial com todas as permissões como false
    const defaultPermissions = {
        canAccessAdminPanel: false, canManageUsers: false, canManageGroups: false,
        canManageConfig: false, canPerformApprovals: false, canAccessPortariaControl: false,
        canCreateSaidaMaquina: false, canCreateTransferencia: false,
        canViewAuditLog: false, // <-- NOVA PERMISSÃO (DEFAULT FALSE)
        // Adicione outras permissões futuras aqui com default false
        username: null, email: null, id: userId // Adiciona ID para referência
    };

    if (!userId) {
        console.warn(`[Permissions] Tentativa de buscar permissões sem userId.`);
        return defaultPermissions;
    }

    try {
        const user = await prisma.localUser.findUnique({
            where: { id: userId },
            include: {
                grupos: {
                    include: {
                        grupo: true // Inclui o objeto grupo completo com as flags can...
                    }
                }
            }
        });
        // Retorna default se usuário não encontrado ou inativo
        if (!user || !user.ativo) {
            console.warn(`[Permissions] Usuário ID ${userId} não encontrado ou inativo.`);
            return defaultPermissions;
        }


        const groups = user.grupos.map(link => link.grupo);

        // Combina as permissões de todos os grupos do usuário
        // Se *qualquer* grupo conceder a permissão, o usuário a terá
        const combinedPermissions = {
            canAccessAdminPanel: groups.some(g => g.canAccessAdminPanel),
            canManageUsers: groups.some(g => g.canManageUsers),
            canManageGroups: groups.some(g => g.canManageGroups),
            canManageConfig: groups.some(g => g.canManageConfig),
            canPerformApprovals: groups.some(g => g.canPerformApprovals),
            canAccessPortariaControl: groups.some(g => g.canAccessPortariaControl),
            canCreateSaidaMaquina: groups.some(g => g.canCreateSaidaMaquina),
            canCreateTransferencia: groups.some(g => g.canCreateTransferencia),
            canViewAuditLog: groups.some(g => g.canViewAuditLog), // <-- VERIFICA A NOVA FLAG
            // Adicione a verificação para outras permissões futuras aqui
            username: user.username,
            email: user.email,
            id: user.id // Inclui o ID do usuário nas permissões retornadas
        };

        // console.log(`[Permissions] Permissões combinadas para ${user.username} (ID ${userId}):`, combinedPermissions);
        return combinedPermissions;

    } catch (error) {
        console.error(`Erro ao buscar permissões do usuário ID ${userId}:`, error);
        return defaultPermissions; // Retorna permissões mínimas em caso de erro
    }
};

module.exports = { getUserPermissions };

