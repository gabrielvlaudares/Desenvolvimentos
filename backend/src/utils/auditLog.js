// src/utils/auditLog.js
const prisma = require('../config/prisma');

// Mapeamento de Tipos de Entidade (para consistência)
const EntityType = {
  MAQUINA: 'MAQUINA',
  TRANSFERENCIA: 'TRANSFERENCIA',
  USER: 'USER',
  GROUP: 'GROUP',
  CONFIG: 'CONFIG',
  // Adicionar outros tipos conforme necessário
};

/**
 * Registra um evento de auditoria no banco de dados.
 *
 * @param {string} entityType - O tipo da entidade (ex: EntityType.MAQUINA, EntityType.USER).
 * @param {string | number} entityIdentifier - O identificador único da entidade (ID numérico convertido para string, UUID, ou chave de configuração).
 * @param {string} acao - A ação realizada (ex: 'USER_CREATED', 'MAQUINA_APPROVED').
 * @param {string} usuarioUpn - O username do usuário que realizou a ação.
 * @param {object | string | null} [detalhes=null] - Informações adicionais (pode ser um objeto que será stringificado ou uma string).
 */
const logAuditEvent = async (entityType, entityIdentifier, acao, usuarioUpn, detalhes = null) => {
  try {
    // Validações básicas
    if (!entityType || !entityIdentifier || !acao || !usuarioUpn) {
      console.error('[AuditLog] Parâmetros obrigatórios ausentes para log:', { entityType, entityIdentifier, acao, usuarioUpn });
      return;
    }

    // Garante que o identificador seja string
    const identifierString = String(entityIdentifier);

    // Converte detalhes para string se for objeto
    let detalhesString = null;
    if (detalhes) {
      detalhesString = typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes);
      // Truncar detalhes longos se necessário (ex: > 500 caracteres)
      if (detalhesString.length > 500) {
        detalhesString = detalhesString.substring(0, 497) + '...';
        console.warn(`[AuditLog] Detalhes truncados para ação ${acao} na entidade ${entityType}:${identifierString}`);
      }
    }

    await prisma.processoEvento.create({
      data: {
        entityType: entityType,
        entityIdentifier: identifierString, // Salva como string
        acao: acao,
        usuarioUpn: usuarioUpn,
        detalhes: detalhesString, // Salva detalhes como string
      },
    });
    console.log(`[AuditLog] Evento registrado: User: ${usuarioUpn}, Ação: ${acao}, Entidade: ${entityType}:${identifierString}`);

  } catch (auditError) {
    console.error(`[AuditLog] Falha ao registrar evento '${acao}' para ${entityType}:${entityIdentifier} por ${usuarioUpn}:`, auditError);
    // Considerar um mecanismo de fallback ou alerta em caso de falha crítica no log
  }
};

module.exports = {
  logAuditEvent,
  EntityType, // Exporta o enum para uso nos services
};
