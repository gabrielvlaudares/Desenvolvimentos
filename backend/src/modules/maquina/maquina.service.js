// src/modules/maquina/maquina.service.js
const prisma = require('../../config/prisma');
const { getUserPermissions } = require('../../utils/permissions');
const { logAuditEvent, EntityType } = require('../../utils/auditLog');
const { sendApprovalEmail } = require('../../utils/emailService');

// Helper para converter ID para string para o log
const formatIdForLog = (id) => String(id);

/**
 * --- NOVO HELPER ---
 * Busca o gestor substituto, se houver um programado para hoje.
 * @param {string} gestorEmailOriginal - O e-mail do gestor principal
 * @returns {object|null} O objeto { email, nome } do gestor substituto ou null
 */
const findActiveSubstitute = async (gestorEmailOriginal) => {
    if (!gestorEmailOriginal) return null;
    
    const hoje = new Date();
    
    try {
        const substituicao = await prisma.gestorSubstituto.findFirst({
            where: {
                // 1. O gestor original é o dono do e-mail
                gestorOriginal: {
                    email: { equals: gestorEmailOriginal, mode: 'insensitive' }
                },
                // 2. A data de hoje está dentro do período
                dataInicio: { lte: hoje },
                dataFim: { gte: hoje },
                // 3. O substituto está ativo
                gestorSubstituto: {
                    ativo: true
                }
            },
            include: {
                gestorSubstituto: { // Puxa os dados do substituto
                    select: { email: true, nome: true }
                }
            }
        });
        
        if (substituicao) {
            console.log(`[findActiveSubstitute] Substituição ativa encontrada para ${gestorEmailOriginal}. Substituto: ${substituicao.gestorSubstituto.email}`);
            return substituicao.gestorSubstituto; // Retorna { email, nome }
        }
        
        return null;
    } catch (error) {
        console.error(`[findActiveSubstitute] Erro ao buscar substituto para ${gestorEmailOriginal}:`, error.message);
        return null; // Continua o fluxo normal em caso de erro
    }
};


const maquinaService = {
    // --- Listar Saídas (Inalterado) ---
    listarSaidas: async (userAuth) => {
        // ... (código inalterado) ...
        const permissions = await getUserPermissions(userAuth.id);
        let whereClause = {};
        if (!permissions.canAccessAdminPanel) {
            if (permissions.canPerformApprovals && userAuth.email) {
                 whereClause = {
                    OR: [
                        { gestorEmail: { equals: userAuth.email, mode: 'insensitive' } },
                        { criadoPorUpn: userAuth.username }
                    ]
                };
            }
            else if (permissions.canAccessPortariaControl) {
                 whereClause = { statusProcesso: 'Aguardando Portaria' };
                 console.log(`[MaquinaService] Usuário ${userAuth.username} é portaria, buscando apenas 'Aguardando Portaria'.`);
            }
            else {
                whereClause = { criadoPorUpn: userAuth.username };
            }
        }
        console.log(`[MaquinaService] Listando saídas para ${userAuth.username} (Admin: ${permissions.canAccessAdminPanel}) com filtro:`, JSON.stringify(whereClause));
        return prisma.maquinaSaida.findMany({
            where: whereClause,
            orderBy: { criadoEm: 'desc' },
        });
    },

    // --- Criar Nova Saída (ATUALIZADO) ---
    criarSaida: async (dados, userAuth) => { 
        if (dados.tipoSaida === 'Manutenção' && !dados.prazoRetorno) {
            throw new Error('A Data Prevista de Retorno é obrigatória para Manutenção.');
        }
        const quantidadeInt = parseInt(dados.quantidade, 10);
        if (isNaN(quantidadeInt) || quantidadeInt < 1) {
             throw new Error('Quantidade inválida.');
        }
        if (!dados.gestorEmail) {
             throw new Error('E-mail do Gestor Aprovador é obrigatório.');
        }

        const novaSaida = await prisma.maquinaSaida.create({
            data: {
                tipoSaida: dados.tipoSaida,
                statusProcesso: 'Aguardando Aprovação',
                solicitante: dados.solicitante,
                areaResponsavel: dados.areaResponsavel,
                gestorEmail: dados.gestorEmail, // <-- Armazena o gestor ORIGINAL
                descricaoMaterial: dados.descricaoMaterial,
                quantidade: quantidadeInt,
                motivoSaida: dados.motivoSaida,
                dataEnvio: dados.dataEnvio ? new Date(dados.dataEnvio) : new Date(),
                prazoRetorno: dados.tipoSaida === 'Manutenção' && dados.prazoRetorno ? new Date(dados.prazoRetorno) : null,
                portariaSaida: dados.portariaSaida || null,
                nfSaida: dados.nfSaida || null,
                pdfUrlSaida: dados.pdfUrlSaida || null,
                criadoPorUpn: userAuth.username,
            }
        });

        // --- LOG DE AUDITORIA (inalterado) ---
        await logAuditEvent(
            EntityType.MAQUINA,
            novaSaida.processoId,
            'MAQUINA_SAIDA_CREATED',
            userAuth.username,
            `ID Seq: ${novaSaida.idSequencial}, Tipo: ${novaSaida.tipoSaida}, Qtd: ${novaSaida.quantidade}, Desc: ${novaSaida.descricaoMaterial.substring(0, 50)}...`
        );

        // --- ATUALIZADO: Envio de E-mail (com lógica de substituto) ---
        try {
            // 1. Verifica se há um substituto ativo
            const substituto = await findActiveSubstitute(novaSaida.gestorEmail);
            
            let destinatarioEmail = novaSaida.gestorEmail;
            if (substituto && substituto.email) {
                console.log(`[MaquinaService] Redirecionando e-mail de ID ${novaSaida.idSequencial} para o substituto: ${substituto.email}`);
                destinatarioEmail = substituto.email; // Troca o destinatário!
            }
            
            // 2. Envia o e-mail (para o original ou para o substituto)
            console.log(`[MaquinaService] Disparando e-mail de aprovação para ${destinatarioEmail}...`);
            await sendApprovalEmail(novaSaida, destinatarioEmail); // Passa o destinatário final
        } catch (emailError) {
            console.error(`[MaquinaService] Falha ao enviar e-mail (ID: ${novaSaida.idSequencial}), mas a solicitação foi criada. Erro: ${emailError.message}`);
        }
        // --- FIM ENVIO E-MAIL ---

        return novaSaida;
    },

    // --- Aprovar Saída (ATUALIZADO) ---
    aprovarSaida: async (id, userAuth) => { 
        const saida = await prisma.maquinaSaida.findUnique({ where: { id: id } });
        if (!saida) throw new Error('Solicitação não encontrada.');
        if (saida.statusProcesso !== 'Aguardando Aprovação') throw new Error(`Ação inválida. Status atual: ${saida.statusProcesso}`);

        const permissions = await getUserPermissions(userAuth.id);
        
        // 1. Verifica se o usuário é o gestor original
        const isGestorOriginal = saida.gestorEmail && userAuth.email && saida.gestorEmail.toLowerCase() === userAuth.email.toLowerCase();
        
        // 2. Verifica se o usuário é o substituto ativo
        let isGestorSubstituto = false;
        const substituto = await findActiveSubstitute(saida.gestorEmail);
        if (substituto && substituto.email && userAuth.email) {
            isGestorSubstituto = (substituto.email.toLowerCase() === userAuth.email.toLowerCase());
        }

        // 3. Permite aprovar se:
        // (é o gestor original) OU (é o substituto ativo) OU (é admin)
        // (removida a permissão genérica 'canPerformApprovals' para esta ação, tornando-a mais segura)
        if (!isGestorOriginal && !isGestorSubstituto && !permissions.canAccessAdminPanel) {
             throw new Error('Acesso negado. Apenas o gestor original, seu substituto ativo ou um administrador podem aprovar esta solicitação.');
        }

        const saidaAtualizada = await prisma.maquinaSaida.update({
            where: { id: id },
            data: {
                statusProcesso: 'Aguardando Portaria',
                gestorAprovadorUpn: userAuth.username, 
                dataAprovacao: new Date(),
                motivoRejeicao: null,
            }
        });

        // --- LOG DE AUDITORIA (inalterado) ---
        await logAuditEvent(
            EntityType.MAQUINA,
            saidaAtualizada.processoId,
            'MAQUINA_SAIDA_APPROVED',
            userAuth.username,
            `ID Seq: ${saidaAtualizada.idSequencial}, Aprovador: ${userAuth.username}`
        );

        return saidaAtualizada;
    },

    // --- Rejeitar Saída (ATUALIZADO) ---
    rejeitarSaida: async (id, motivoRejeicao, userAuth) => { 
        if (!motivoRejeicao || motivoRejeicao.trim() === '') throw new Error('O motivo da rejeição é obrigatório.');
        const saida = await prisma.maquinaSaida.findUnique({ where: { id: id } });
        if (!saida) throw new Error('Solicitação não encontrada.');
        if (saida.statusProcesso !== 'Aguardando Aprovação') throw new Error(`Ação inválida. Status atual: ${saida.statusProcesso}`);

        const permissions = await getUserPermissions(userAuth.id);
        
        // 1. Verifica se o usuário é o gestor original
        const isGestorOriginal = saida.gestorEmail && userAuth.email && saida.gestorEmail.toLowerCase() === userAuth.email.toLowerCase();
        
        // 2. Verifica se o usuário é o substituto ativo
        let isGestorSubstituto = false;
        const substituto = await findActiveSubstitute(saida.gestorEmail);
        if (substituto && substituto.email && userAuth.email) {
            isGestorSubstituto = (substituto.email.toLowerCase() === userAuth.email.toLowerCase());
        }

        // 3. Permite rejeitar se: (é o gestor original) OU (é o substituto ativo) OU (é admin)
        if (!isGestorOriginal && !isGestorSubstituto && !permissions.canAccessAdminPanel) {
             throw new Error('Acesso negado. Apenas o gestor original, seu substituto ativo ou um administrador podem rejeitar esta solicitação.');
         }

        const saidaAtualizada = await prisma.maquinaSaida.update({
            where: { id: id },
            data: {
                statusProcesso: 'Rejeitado',
                gestorAprovadorUpn: userAuth.username, 
                dataAprovacao: new Date(), 
                motivoRejeicao: motivoRejeicao.trim(),
            }
        });

        // --- LOG DE AUDITORIA (inalterado) ---
        await logAuditEvent(
            EntityType.MAQUINA,
            saidaAtualizada.processoId,
            'MAQUINA_SAIDA_REJECTED',
            userAuth.username,
            `ID Seq: ${saidaAtualizada.idSequencial}, Rejeitador: ${userAuth.username}, Motivo: ${motivoRejeicao.trim()}`
        );

        return saidaAtualizada;
    },

    // --- Registrar Saída na Portaria (Inalterado) ---
    registrarSaidaPortaria: async (id, dadosPortaria, userAuth) => { 
        // ... (código inalterado) ...
        const { dataSaidaEfetiva } = dadosPortaria;
        if (!dataSaidaEfetiva) throw new Error('Data/Hora de saída efetiva é obrigatória.');
        const saida = await prisma.maquinaSaida.findUnique({ where: { id: id } });
        if (!saida) throw new Error('Solicitação não encontrada.');
        if (saida.statusProcesso !== 'Aguardando Portaria') throw new Error(`Ação inválida. Status atual: ${saida.statusProcesso}`);
        const permissions = await getUserPermissions(userAuth.id);
        if (!permissions.canAccessPortariaControl && !permissions.canAccessAdminPanel) {
            throw new Error(`Acesso negado. Apenas usuários com permissão de portaria ou administradores podem registrar a saída.`);
        }
        const proximoStatus = saida.tipoSaida === 'Manutenção' ? 'Em Manutenção' : 'Concluído';
        const saidaAtualizada = await prisma.maquinaSaida.update({
            where: { id: id },
            data: {
                statusProcesso: proximoStatus,
                vigilanteSaidaUpn: userAuth.username,
                dataSaidaEfetiva: new Date(dataSaidaEfetiva),
            }
        });
        await logAuditEvent(
            EntityType.MAQUINA, saidaAtualizada.processoId, 'MAQUINA_SAIDA_PORTARIA', userAuth.username,
            `ID Seq: ${saidaAtualizada.idSequencial}, Vigilante: ${userAuth.username}, Novo Status: ${proximoStatus}`
        );
        return saidaAtualizada;
    },

     // --- Registrar Retorno (Inalterado) ---
     registrarRetornoManutencao: async (id, dadosRetorno, userAuth) => { 
         // ... (código inalterado) ...
         const { dataRetornoEfetivo, nfRetorno, pdfUrlRetorno, observacoesRetorno } = dadosRetorno;
         if (!dataRetornoEfetivo) throw new Error('Data de retorno efetiva é obrigatória.');
         const saida = await prisma.maquinaSaida.findUnique({ where: { id: id } });
         if (!saida) throw new Error('Solicitação não encontrada.');
         if (saida.tipoSaida !== 'Manutenção') throw new Error('Apenas saídas do tipo "Manutenção" podem ter retorno registrado.');
         if (saida.statusProcesso !== 'Em Manutenção') throw new Error(`Ação inválida. Status atual: ${saida.statusProcesso}. Só é possível registrar retorno de itens 'Em Manutenção'.`);
         const permissions = await getUserPermissions(userAuth.id);
         const isGestorDaSaida = saida.gestorEmail && userAuth.email && saida.gestorEmail.toLowerCase() === userAuth.email.toLowerCase();
         
         // NOTA: A lógica do substituto não foi adicionada aqui, apenas o solicitante, gestor original ou admin.
         // Isso pode ser um refinamento futuro, se necessário.
         if (saida.criadoPorUpn !== userAuth.username && !isGestorDaSaida && !permissions.canAccessAdminPanel) {
             throw new Error('Apenas o solicitante, o gestor da área ou um administrador podem registrar o retorno.');
         }
         const saidaAtualizada = await prisma.maquinaSaida.update({
             where: { id: id },
             data: {
                 statusProcesso: 'Concluído',
                 dataRetornoEfetivo: new Date(dataRetornoEfetivo),
                 nfRetorno: nfRetorno || null,
                 pdfUrlRetorno: pdfUrlRetorno || null,
                 observacoesRetorno: observacoesRetorno || null,
                 retornoConfirmadoPorUpn: userAuth.username
             }
         });
         await logAuditEvent(
            EntityType.MAQUINA, saidaAtualizada.processoId, 'MAQUINA_RETORNO_CONFIRMED', userAuth.username,
            `ID Seq: ${saidaAtualizada.idSequencial}, Confirmado por: ${userAuth.username}, NF Ret: ${nfRetorno || '-'}`
         );
        return saidaAtualizada;
    },

    // --- Atualizar Saída (Inalterado) ---
    updateSaida: async (id, dadosUpdate, userAuth) => { 
        // ... (código inalterado) ...
        const saidaBefore = await prisma.maquinaSaida.findUnique({ where: { id: id } });
        if (!saidaBefore) throw new Error('Solicitação não encontrada.');
        if (saidaBefore.statusProcesso !== 'Aguardando Aprovação') throw new Error('Não é possível editar uma solicitação que já foi aprovada ou processada.');
        const permissions = await getUserPermissions(userAuth.id);
        if (saidaBefore.criadoPorUpn !== userAuth.username && !permissions.canAccessAdminPanel) throw new Error('Apenas o criador da solicitação ou um administrador podem editar.');
        const tipoSaidaFinal = dadosUpdate.hasOwnProperty('tipoSaida') ? dadosUpdate.tipoSaida : saidaBefore.tipoSaida;
        const prazoRetornoFinal = dadosUpdate.hasOwnProperty('prazoRetorno') ? dadosUpdate.prazoRetorno : saidaBefore.prazoRetorno;
        if (tipoSaidaFinal === 'Manutenção' && !prazoRetornoFinal) throw new Error('A Data Prevista de Retorno é obrigatória para Manutenção.');
        let quantidadeFinal = saidaBefore.quantidade;
        if (dadosUpdate.hasOwnProperty('quantidade')) {
            const q = parseInt(dadosUpdate.quantidade, 10);
            if (isNaN(q) || q < 1) throw new Error('Quantidade inválida.');
            quantidadeFinal = q;
        }
        const allowedUpdates = {};
        const allowedKeys = ['tipoSaida', 'areaResponsavel', 'gestorEmail', 'descricaoMaterial', 'quantidade', 'motivoSaida', 'dataEnvio', 'prazoRetorno', 'portariaSaida', 'nfSaida', 'pdfUrlSaida'];
        allowedKeys.forEach(key => {
            if (dadosUpdate.hasOwnProperty(key)) {
                 if (key === 'dataEnvio' || key === 'prazoRetorno') {
                      allowedUpdates[key] = dadosUpdate[key] ? new Date(dadosUpdate[key]) : null;
                 } else if (key === 'quantidade') {
                     allowedUpdates[key] = quantidadeFinal;
                 } else {
                      allowedUpdates[key] = dadosUpdate[key] === '' ? null : dadosUpdate[key];
                 }
            }
        });
        if (tipoSaidaFinal !== 'Manutenção') {
            allowedUpdates.prazoRetorno = null;
        }
        Object.keys(allowedUpdates).forEach(key => {
             if (allowedUpdates[key] === undefined) {
                 delete allowedUpdates[key];
             }
        });
        if (Object.keys(allowedUpdates).length === 0) {
             console.log(`[MaquinaService] Nenhuma alteração detectada para ID ${id}.`);
             return saidaBefore;
        }
        const saidaAtualizada = await prisma.maquinaSaida.update({
            where: { id: id },
            data: allowedUpdates,
        });
        // LOG...
        const changes = [];
         allowedKeys.forEach(key => {
             const beforeValue = key.includes('data') || key.includes('prazo') ? (saidaBefore[key] ? new Date(saidaBefore[key]).toISOString().split('T')[0] : null) : saidaBefore[key];
             const afterValue = key.includes('data') || key.includes('prazo') ? (saidaAtualizada[key] ? new Date(saidaAtualizada[key]).toISOString().split('T')[0] : null) : saidaAtualizada[key];
             const beforeNorm = beforeValue === null || beforeValue === undefined ? '' : String(beforeValue);
             const afterNorm = afterValue === null || afterValue === undefined ? '' : String(afterValue);
             if (beforeNorm !== afterNorm) {
                 const beforeLog = beforeNorm.length > 50 ? beforeNorm.substring(0, 47) + '...' : beforeNorm;
                 const afterLog = afterNorm.length > 50 ? afterNorm.substring(0, 47) + '...' : afterLog;
                 changes.push(`${key}: '${beforeLog || '-'}' -> '${afterLog || '-'}'`);
             }
         });
        await logAuditEvent(
            EntityType.MAQUINA, saidaAtualizada.processoId, 'MAQUINA_SAIDA_UPDATED', userAuth.username,
            changes.length > 0 ? `Alterações: ${changes.join('; ')}` : 'Nenhuma alteração nos dados.'
        );
        return saidaAtualizada;
    },

    // --- Excluir Saída (Inalterado) ---
    deleteSaida: async (id, userAuth) => { 
        // ... (código inalterado) ...
        const saida = await prisma.maquinaSaida.findUnique({ where: { id: id } });
        if (!saida) throw new Error('Solicitação não encontrada.');
        if (!['Aguardando Aprovação', 'Rejeitado'].includes(saida.statusProcesso)) {
             throw new Error('Não é possível excluir uma solicitação que já foi aprovada ou processada pela portaria.');
        }
        const permissions = await getUserPermissions(userAuth.id);
        if (saida.criadoPorUpn !== userAuth.username && !permissions.canAccessAdminPanel) throw new Error('Apenas o criador da solicitação ou um administrador podem excluir.');
        await prisma.processoEvento.deleteMany({ where: { entityIdentifier: saida.processoId, entityType: EntityType.MAQUINA } });
        const deletedSaida = await prisma.maquinaSaida.delete({ where: { id: id } });
        await logAuditEvent(
            EntityType.MAQUINA, saida.processoId, 'MAQUINA_SAIDA_DELETED', userAuth.username,
            `ID Seq: ${saida.idSequencial}, Solicitante: ${saida.solicitante}, Desc: ${saida.descricaoMaterial.substring(0, 50)}...`
        );
        return deletedSaida; 
    },
};

module.exports = maquinaService;