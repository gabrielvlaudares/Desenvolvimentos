// src/modules/transferencia/transferencia.service.js
const prisma = require('../../config/prisma');
const { getUserPermissions } = require('../../utils/permissions');
// --- IMPORTAR FUNÇÃO DE LOG E TIPOS DE ENTIDADE ---
const { logAuditEvent, EntityType } = require('../../utils/auditLog'); // <-- NOVO

// Helper para formatar ID para o log (se necessário)
// const formatIdForLog = (id) => String(id);

const transferenciaService = {

    // --- Listar Transferências (Não precisa de auditoria) ---
    listarTransferencias: async (userAuth) => {
        const permissions = await getUserPermissions(userAuth.id);
        let whereClause = {};

        // Aplica filtro SOMENTE se o usuário NÃO for Admin
        if (!permissions.canAccessAdminPanel) {
            // Se for Portaria (canAccessPortariaControl), filtra pelo status e portaria relevante
            if (permissions.canAccessPortariaControl) {
                 const selectedPortaria = userAuth.selectedPortaria; // Assume que está disponível no userAuth após seleção
                 if (selectedPortaria) {
                     whereClause = {
                         OR: [
                             // Pendente de SAÍDA nesta portaria
                             { statusProcesso: 'Em andamento', portariaSaida: selectedPortaria },
                             // Pendente de CHEGADA nesta portaria
                             { statusProcesso: 'Em trânsito', portariaDestino: selectedPortaria },
                             // Também mostra as que o próprio usuário criou (mesmo se não for da sua portaria atual)
                             { criadoPorUpn: userAuth.username }
                         ]
                     };
                     console.log(`[TransferService] Usuário ${userAuth.username} é portaria (${selectedPortaria}), buscando itens relevantes para ${selectedPortaria} ou criados por ele.`);
                 } else {
                     // Portaria sem portaria selecionada (não deveria acontecer aqui, mas por segurança)
                     // Mostra apenas os criados por ele
                      whereClause = { criadoPorUpn: userAuth.username };
                      console.warn(`[TransferService] Usuário ${userAuth.username} é portaria mas sem portaria selecionada na listagem.`);
                 }
            }
            // Usuário comum (sem permissão de portaria ou admin) só vê as que criou
            else {
                whereClause = { criadoPorUpn: userAuth.username };
            }
        }
        // Admin vê tudo (whereClause fica vazio {})

        console.log(`[TransferService] Listando transferências para ${userAuth.username} (Admin: ${permissions.canAccessAdminPanel}) com filtro:`, JSON.stringify(whereClause));

        return prisma.transferencia.findMany({
            where: whereClause,
            orderBy: { criadoEm: 'desc' }
        });
    },

    // --- Criar Nova Transferência ---
    criarTransferencia: async (dados, userAuth) => { // userAuth já era recebido
        const {
            dataSaidaSolicitada, portariaSaida, portariaDestino, numeroNf, pdfUrl,
            meioTransporte, tipoCarro, placaVeiculo, nomeTransportador,
            nomeRequisitante, setor, gestor
        } = dados;

        // Validações Essenciais
        if (!dataSaidaSolicitada || !portariaSaida || !portariaDestino || !numeroNf || !nomeRequisitante || !setor || !gestor || !meioTransporte) {
            throw new Error("Campos obrigatórios estão faltando (Data, Portarias, NF, Requisitante, Setor, Gestor, Meio Transporte).");
        }
        if (portariaSaida === portariaDestino) {
             throw new Error("Portaria de Saída e Destino não podem ser iguais.");
        }
        const needsVehicle = ['TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'CARRO PARTICULAR', 'MOTOBOY'].includes(meioTransporte?.toUpperCase());
        if (needsVehicle && (!tipoCarro || !placaVeiculo)) {
            throw new Error('Tipo e Placa do Veículo são obrigatórios para este meio de transporte.');
        }

        const novaTransferencia = await prisma.transferencia.create({
            data: {
                statusProcesso: 'Em andamento',
                criadoPorUpn: userAuth.username,
                nomeRequisitante: nomeRequisitante,
                setor: setor,
                gestor: gestor,
                dataSaidaSolicitada: new Date(dataSaidaSolicitada),
                numeroNf: numeroNf,
                pdfUrl: pdfUrl || null,
                meioTransporte: meioTransporte,
                tipoCarro: needsVehicle ? tipoCarro : null,
                placaVeiculo: needsVehicle ? placaVeiculo : null,
                nomeTransportador: nomeTransportador || null,
                portariaSaida: portariaSaida,
                portariaDestino: portariaDestino,
                // Campos de workflow inicializados como null
                vigilanteSaidaUpn: null, dataSaidaEfetiva: null, decisaoSaida: null, obsSaida: null,
                vigilanteChegadaUpn: null, dataChegadaEfetiva: null, decisaoChegada: null, obsChegada: null,
            }
        });

        // --- LOG DE AUDITORIA ---
        await logAuditEvent(
            EntityType.TRANSFERENCIA,
            novaTransferencia.processoId, // Usa o UUID
            'TRANSFERENCIA_CREATED',
            userAuth.username,
            `ID Seq: ${novaTransferencia.idSequencial}, Origem: ${portariaSaida}, Destino: ${portariaDestino}, NF: ${numeroNf}`
        );
        // --- FIM LOG ---

        return novaTransferencia;
    },

    // --- Registrar Saída na Origem ---
    registarSaida: async (id, dadosSaida, userAuth, req) => { // userAuth e req já eram recebidos
        const { dataSaidaEfetiva, decisaoSaida, obsSaida } = dadosSaida;
        if (!dataSaidaEfetiva || !decisaoSaida || !['Aprovado', 'NaoAutorizado'].includes(decisaoSaida)) {
             throw new Error("Data/Hora efetiva e Decisão ('Aprovado' ou 'NaoAutorizado') são obrigatórios e válidos.");
        }

        const transferencia = await prisma.transferencia.findUnique({ where: { id: id } });
        if (!transferencia) throw new Error("Transferência não encontrada.");
        if (transferencia.statusProcesso !== 'Em andamento') {
             throw new Error(`Ação inválida. A transferência não está 'Em andamento'. Status atual: ${transferencia.statusProcesso}`);
        }

        const permissions = await getUserPermissions(userAuth.id);
        if (!permissions.canAccessPortariaControl && !permissions.canAccessAdminPanel) {
            const err = new Error(`Acesso negado. Apenas usuários com permissão de portaria ou administradores podem registrar a saída.`);
            err.statusCode = 403;
            throw err;
        }

        // Validação da portaria selecionada vs portaria da transferência
        const selectedPortaria = req.headers['x-selected-portaria'];
        if (!permissions.canAccessAdminPanel && transferencia.portariaSaida && selectedPortaria && selectedPortaria !== transferencia.portariaSaida) {
             console.warn(`[TransferService] Tentativa negada: User ${userAuth.username} (Portaria ${selectedPortaria}) tentou registrar saída da portaria ${transferencia.portariaSaida} para transf ${id}.`);
             const err = new Error(`Ação não permitida. Esta saída pertence à portaria ${transferencia.portariaSaida}, mas você está operando na ${selectedPortaria}.`);
             err.statusCode = 403;
             throw err;
        }

        const proximoStatus = decisaoSaida === 'Aprovado' ? 'Em trânsito' : 'Cancelado';
        const acaoAuditoria = decisaoSaida === 'Aprovado' ? 'TRANSFERENCIA_SAIDA_CONFIRMED' : 'TRANSFERENCIA_SAIDA_REJECTED'; // Ação mais específica

        const transferenciaAtualizada = await prisma.transferencia.update({
             where: { id: id },
             data: {
                 statusProcesso: proximoStatus,
                 vigilanteSaidaUpn: userAuth.username, // Registra quem deu saída
                 dataSaidaEfetiva: new Date(dataSaidaEfetiva),
                 decisaoSaida: decisaoSaida,
                 obsSaida: obsSaida || null,
                 // Garante que campos de chegada sejam resetados se a saída for rejeitada
                 vigilanteChegadaUpn: decisaoSaida !== 'Aprovado' ? null : transferencia.vigilanteChegadaUpn,
                 dataChegadaEfetiva: decisaoSaida !== 'Aprovado' ? null : transferencia.dataChegadaEfetiva,
                 decisaoChegada: decisaoSaida !== 'Aprovado' ? null : transferencia.decisaoChegada,
                 obsChegada: decisaoSaida !== 'Aprovado' ? null : transferencia.obsChegada
             }
         });

         // --- LOG DE AUDITORIA ---
         await logAuditEvent(
            EntityType.TRANSFERENCIA,
            transferenciaAtualizada.processoId,
            acaoAuditoria, // Usa a ação definida acima
            userAuth.username,
            `ID Seq: ${transferenciaAtualizada.idSequencial}, Vigilante: ${userAuth.username}, Novo Status: ${proximoStatus}${obsSaida ? ', Obs: ' + obsSaida : ''}`
        );
        // --- FIM LOG ---

        return transferenciaAtualizada;
    },

    // --- Registrar Chegada no Destino ---
    registarChegada: async (id, dadosChegada, userAuth, req) => { // userAuth e req já eram recebidos
        const { dataChegadaEfetiva, decisaoChegada, obsChegada } = dadosChegada;
         if (!dataChegadaEfetiva || !decisaoChegada || !['Aprovado', 'Problema'].includes(decisaoChegada)) {
             throw new Error("Data/Hora efetiva e Decisão ('Aprovado' ou 'Problema') são obrigatórios e válidos.");
        }

        const transferencia = await prisma.transferencia.findUnique({ where: { id: id } });
        if (!transferencia) throw new Error("Transferência não encontrada.");
        if (transferencia.statusProcesso !== 'Em trânsito') {
             throw new Error(`Ação inválida. A transferência não está 'Em trânsito'. Status atual: ${transferencia.statusProcesso}`);
        }

        const permissions = await getUserPermissions(userAuth.id);
        if (!permissions.canAccessPortariaControl && !permissions.canAccessAdminPanel) {
             const err = new Error(`Acesso negado. Apenas usuários com permissão de portaria ou administradores podem registrar a chegada.`);
             err.statusCode = 403;
             throw err;
        }

        // Validação da portaria selecionada vs portaria da transferência
        const selectedPortaria = req.headers['x-selected-portaria'];
        if (!permissions.canAccessAdminPanel && transferencia.portariaDestino && selectedPortaria && selectedPortaria !== transferencia.portariaDestino) {
             console.warn(`[TransferService] Tentativa negada: User ${userAuth.username} (Portaria ${selectedPortaria}) tentou registrar chegada na portaria ${transferencia.portariaDestino} para transf ${id}.`);
             const err = new Error(`Ação não permitida. Esta chegada pertence à portaria ${transferencia.portariaDestino}, mas você está operando na ${selectedPortaria}.`);
             err.statusCode = 403;
             throw err;
        }

        // Validação da Regra de Negócio: Mesmo usuário Saída/Chegada
        if (!permissions.canAccessAdminPanel && transferencia.vigilanteSaidaUpn && transferencia.vigilanteSaidaUpn === userAuth.username) {
            console.warn(`[TransferService] Tentativa negada (Regra Negócio): User ${userAuth.username} tentou registrar chegada da transf ${id} que ele mesmo registrou a saída.`);
            const err = new Error(`Ação não permitida. O mesmo vigilante (${userAuth.username}) que registrou a saída não pode registrar a chegada desta transferência.`);
            err.statusCode = 403; // Forbidden
            throw err;
        }

        // Define próximo status e ação de auditoria
        const proximoStatus = 'Concluído'; // Chegada sempre conclui, mesmo com 'Problema'
        const acaoAuditoria = decisaoChegada === 'Aprovado' ? 'TRANSFERENCIA_CHEGADA_CONFIRMED' : 'TRANSFERENCIA_CHEGADA_PROBLEM';

        const transferenciaAtualizada = await prisma.transferencia.update({
            where: { id: id },
            data: {
                statusProcesso: proximoStatus,
                vigilanteChegadaUpn: userAuth.username, // Registra quem deu chegada
                dataChegadaEfetiva: new Date(dataChegadaEfetiva),
                decisaoChegada: decisaoChegada,
                obsChegada: obsChegada || null,
            }
        });

        // --- LOG DE AUDITORIA ---
         await logAuditEvent(
            EntityType.TRANSFERENCIA,
            transferenciaAtualizada.processoId,
            acaoAuditoria, // Usa a ação definida acima
            userAuth.username,
            `ID Seq: ${transferenciaAtualizada.idSequencial}, Vigilante: ${userAuth.username}, Novo Status: ${proximoStatus}${obsChegada ? ', Obs: ' + obsChegada : ''}`
        );
        // --- FIM LOG ---

        return transferenciaAtualizada;
    },

    // --- Atualizar Transferência ---
    updateTransferencia: async (id, dadosUpdate, userAuth) => { // userAuth já era recebido
        // Busca estado ANTES para log
        const transferenciaBefore = await prisma.transferencia.findUnique({ where: { id: id } });
        if (!transferenciaBefore) throw new Error('Transferência não encontrada.');

        // Validações de permissão e status
        if (transferenciaBefore.statusProcesso !== 'Em andamento') { throw new Error('Não é possível editar uma transferência que já saiu da portaria de origem.'); }
        const permissions = await getUserPermissions(userAuth.id);
        if (transferenciaBefore.criadoPorUpn !== userAuth.username && !permissions.canAccessAdminPanel) { throw new Error('Apenas o criador da solicitação ou um administrador podem editar.'); }

        // Validações de dados
        const portariaSaidaFinal = dadosUpdate.hasOwnProperty('portariaSaida') ? dadosUpdate.portariaSaida : transferenciaBefore.portariaSaida;
        const portariaDestinoFinal = dadosUpdate.hasOwnProperty('portariaDestino') ? dadosUpdate.portariaDestino : transferenciaBefore.portariaDestino;
        if (portariaSaidaFinal && portariaDestinoFinal && portariaSaidaFinal === portariaDestinoFinal) { throw new Error("Portaria de Saída e Destino não podem ser iguais."); }

        const meioTransporteFinal = dadosUpdate.hasOwnProperty('meioTransporte') ? dadosUpdate.meioTransporte : transferenciaBefore.meioTransporte;
        const needsVehicle = ['TRANSPORTADORA', 'CARRO FROTA', 'UBER', 'CARRO PARTICULAR', 'MOTOBOY'].includes(meioTransporteFinal?.toUpperCase());
        const tipoCarroFinal = dadosUpdate.hasOwnProperty('tipoCarro') ? dadosUpdate.tipoCarro : transferenciaBefore.tipoCarro;
        const placaVeiculoFinal = dadosUpdate.hasOwnProperty('placaVeiculo') ? dadosUpdate.placaVeiculo : transferenciaBefore.placaVeiculo;
        if (needsVehicle && (!tipoCarroFinal || !placaVeiculoFinal)) { throw new Error('Tipo e Placa do Veículo são obrigatórios para este meio de transporte.'); }

        // Prepara objeto apenas com campos permitidos e modificados
        const allowedKeys = ['portariaSaida', 'portariaDestino', 'numeroNf', 'meioTransporte', 'tipoCarro', 'placaVeiculo', 'nomeTransportador', 'setor', 'gestor', 'dataSaidaSolicitada', 'pdfUrl'];
        const updateData = {};
        allowedKeys.forEach(key => {
            if (dadosUpdate.hasOwnProperty(key)) {
                if (key === 'dataSaidaSolicitada') {
                    // Tenta converter para data, se falhar mantém null ou o valor inválido que será pego pelo Prisma
                    try {
                        updateData[key] = dadosUpdate[key] ? new Date(dadosUpdate[key]) : null;
                    } catch (e) {
                         console.warn(`[TransferService Update] Data inválida recebida para ${key}: ${dadosUpdate[key]}`);
                         updateData[key] = dadosUpdate[key]; // Deixa o Prisma validar
                    }
                } else {
                    updateData[key] = dadosUpdate[key] === '' ? null : dadosUpdate[key]; // Converte string vazia para null
                }
            }
        });
        // Se o meio de transporte final não precisa de veículo, limpa os campos
        if (!needsVehicle) {
            updateData.tipoCarro = null;
            updateData.placaVeiculo = null;
        }

        // Remove campos undefined do objeto de atualização
         Object.keys(updateData).forEach(key => {
             if (updateData[key] === undefined) {
                 delete updateData[key];
             }
         });

        // Se não houver alterações válidas, retorna o estado atual sem log
        if (Object.keys(updateData).length === 0) {
             console.log(`[TransferService] Nenhuma alteração detectada para ID ${id}.`);
             return transferenciaBefore;
        }

        const transferenciaAtualizada = await prisma.transferencia.update({ where: { id: id }, data: updateData });

        // --- LOG DE AUDITORIA ---
        const changes = [];
        allowedKeys.forEach(key => {
             // Compara valor ANTES e DEPOIS, tratando datas e nulls
             const beforeValue = key.includes('data') ? (transferenciaBefore[key] ? new Date(transferenciaBefore[key]).toISOString() : null) : transferenciaBefore[key];
             const afterValue = key.includes('data') ? (transferenciaAtualizada[key] ? new Date(transferenciaAtualizada[key]).toISOString() : null) : transferenciaAtualizada[key];
             const beforeNorm = beforeValue === null || beforeValue === undefined ? '' : String(beforeValue);
             const afterNorm = afterValue === null || afterValue === undefined ? '' : String(afterValue);

             if (beforeNorm !== afterNorm) {
                 const beforeLog = beforeNorm.length > 50 ? beforeNorm.substring(0, 47) + '...' : beforeNorm;
                 const afterLog = afterNorm.length > 50 ? afterNorm.substring(0, 47) + '...' : afterNorm;
                 changes.push(`${key}: '${beforeLog || '-'}' -> '${afterLog || '-'}'`);
             }
         });

        await logAuditEvent(
            EntityType.TRANSFERENCIA,
            transferenciaAtualizada.processoId,
            'TRANSFERENCIA_UPDATED',
            userAuth.username,
             changes.length > 0 ? `Alterações: ${changes.join('; ')}` : 'Nenhuma alteração nos dados.'
        );
        // --- FIM LOG ---

        return transferenciaAtualizada;
    },

    // --- Excluir Transferência ---
    deleteTransferencia: async (id, userAuth) => { // userAuth já era recebido
        // Busca ANTES para log e validação
        const transferencia = await prisma.transferencia.findUnique({ where: { id: id } });
        if (!transferencia) throw new Error('Transferência não encontrada.');

        // Validações de permissão e status
        if (transferencia.statusProcesso !== 'Em andamento') { throw new Error('Não é possível excluir uma transferência que já saiu da portaria de origem.'); }
        const permissions = await getUserPermissions(userAuth.id);
        if (transferencia.criadoPorUpn !== userAuth.username && !permissions.canAccessAdminPanel) { throw new Error('Apenas o criador da solicitação ou um administrador podem excluir.'); }

        // Deleta eventos associados primeiro
        await prisma.processoEvento.deleteMany({ where: { entityIdentifier: transferencia.processoId, entityType: EntityType.TRANSFERENCIA } });

        // Deleta a transferência
        const deletedTransfer = await prisma.transferencia.delete({ where: { id: id } });

        // --- LOG DE AUDITORIA ---
        await logAuditEvent(
            EntityType.TRANSFERENCIA,
            transferencia.processoId, // Usa o processoId da transferência deletada
            'TRANSFERENCIA_DELETED',
            userAuth.username,
            `ID Seq: ${transferencia.idSequencial}, Requisitante: ${transferencia.nomeRequisitante}, NF: ${transferencia.numeroNf}`
        );
        // --- FIM LOG ---

        return deletedTransfer; // Retorna o objeto deletado
    },
};

module.exports = transferenciaService;
