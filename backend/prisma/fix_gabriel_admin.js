// prisma/fix_gabriel_admin.js
const path = require('path');
// Carrega o .env da pasta 'backend' (um nível acima)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGabrielAdmin() {
  const ADMIN_USERNAME = 'gabriel.adm'; // <-- Seu usuário
  const ADMIN_GROUP_NAME = 'Administradores';

  console.log(`Iniciando script de correção de permissão para: ${ADMIN_USERNAME}`);
  console.log(`Verificando banco em: ${process.env.DATABASE_URL.split('@')[1]}`);

  try {
    // 1. Encontrar o seu usuário
    const adminUser = await prisma.localUser.findUnique({
      where: { username: ADMIN_USERNAME }
    });

    if (!adminUser) {
      console.error(`ERRO: Usuário '${ADMIN_USERNAME}' não foi encontrado no banco de dados da nova máquina. Verifique se o restore do banco foi concluído.`);
      return;
    }
    console.log(`[1/3] Usuário '${adminUser.username}' (ID: ${adminUser.id}) encontrado.`);

    // 2. Garantir que o grupo 'Administradores' exista e tenha TODAS as permissões
    const adminGroup = await prisma.permissionGroup.upsert({
      where: { nome: ADMIN_GROUP_NAME },
      update: { // Garante que todas as flags estão ativas
        canAccessAdminPanel: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConfig: true,
        canPerformApprovals: true,
        canAccessPortariaControl: true,
        canCreateSaidaMaquina: true,
        canCreateTransferencia: true,
        canViewAuditLog: true
      },
      create: { // Se não existir, cria com tudo ativo
        nome: ADMIN_GROUP_NAME,
        descricao: 'Acesso total ao sistema',
        canAccessAdminPanel: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConfig: true,
        canPerformApprovals: true,
        canAccessPortariaControl: true,
        canCreateSaidaMaquina: true,
        canCreateTransferencia: true,
        canViewAuditLog: true
      }
    });
    console.log(`[2/3] Grupo '${adminGroup.nome}' (ID: ${adminGroup.id}) com permissões totais garantidas.`);

    // 3. Ligar o usuário 'gabriel.adm' ao grupo 'Administradores'
    await prisma.userGroupLink.upsert({
      where: {
        usuarioId_grupoId: {
          usuarioId: adminUser.id,
          grupoId: adminGroup.id
        }
      },
      update: {}, // Não precisa fazer nada se já existir
      create: {
        usuarioId: adminUser.id,
        grupoId: adminGroup.id
      }
    });
    console.log(`[3/3] Usuário '${adminUser.username}' vinculado com sucesso ao grupo '${adminGroup.nome}'.`);

    console.log('\n--- SUCESSO! ---');
    console.log(`Permissões de administrador concedidas a ${ADMIN_USERNAME}.`);
    console.log('Faça logout e login novamente no frontend APÓS completar a Ação 2.');

  } catch (error) {
    console.error('ERRO AO EXECUTAR O SCRIPT DE CORREÇÃO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGabrielAdmin();