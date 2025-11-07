// prisma/fix_admin_manual.js
const path = require('path');
// Carrega o .env da pasta 'backend' (um nível acima)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function fixAdminManual() {
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = '12345'; // A senha que será definida
  const ADMIN_GROUP_NAME = 'Administradores';

  console.log(`Iniciando script de correção MANUAL para: ${ADMIN_USERNAME}`);
  console.log(`Usando URL: ${process.env.DATABASE_URL.split('@')[1]}`);

  try {
    // 1. Gerar o hash
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    console.log('Novo hash de senha gerado.');

    // 2. Procurar pelo usuário 'admin' (Etapa 1 Manual)
    let adminUser = await prisma.localUser.findFirst({ // Usando findFirst (mais flexível que findUnique se a constraint estiver faltando)
      where: { username: ADMIN_USERNAME }
    });

    if (adminUser) {
      // Se existir, ATUALIZA (Etapa 2 Manual)
      console.log(`Usuário '${ADMIN_USERNAME}' encontrado. Atualizando senha e status...`);
      adminUser = await prisma.localUser.update({
        where: { id: adminUser.id },
        data: { 
          passwordHash: newPasswordHash, 
          ativo: true,
          nome: 'Administrador'
        }
      });
    } else {
      // Se NÃO existir, CRIA (Etapa 2 Manual)
      console.log(`Usuário '${ADMIN_USERNAME}' não encontrado. Criando...`);
      adminUser = await prisma.localUser.create({
        data: {
          username: ADMIN_USERNAME,
          nome: 'Administrador',
          passwordHash: newPasswordHash,
          ativo: true
        }
      });
    }
    console.log(`[1/3] Usuário '${adminUser.username}' (ID: ${adminUser.id}) pronto com a senha '${ADMIN_PASSWORD}'.`);

    // 3. Procurar (ou criar) o grupo 'Administradores' (Manual Upsert)
    let adminGroup = await prisma.permissionGroup.findFirst({ // Usando findFirst
        where: { nome: ADMIN_GROUP_NAME }
    });
    
    const permissionsData = {
        canAccessAdminPanel: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConfig: true,
        canPerformApprovals: true,
        canAccessPortariaControl: true,
        canCreateSaidaMaquina: true,
        canCreateTransferencia: true,
        canViewAuditLog: true
    };

    if (adminGroup) {
        console.log(`Grupo '${ADMIN_GROUP_NAME}' encontrado. Atualizando permissões...`);
        adminGroup = await prisma.permissionGroup.update({
            where: { id: adminGroup.id },
            data: permissionsData
        });
    } else {
        console.log(`Grupo '${ADMIN_GROUP_NAME}' não encontrado. Criando...`);
        adminGroup = await prisma.permissionGroup.create({
            data: {
                nome: ADMIN_GROUP_NAME,
                descricao: 'Acesso total ao sistema',
                ...permissionsData
            }
        });
    }
    console.log(`[2/3] Grupo '${adminGroup.nome}' (ID: ${adminGroup.id}) pronto com permissões totais.`);

    // 4. Ligar o usuário ao grupo (Manual Upsert)
    let link = await prisma.userGroupLink.findFirst({
        where: {
            usuarioId: adminUser.id,
            grupoId: adminGroup.id
        }
    });

    if (!link) {
        console.log(`Vinculando '${adminUser.username}' ao grupo '${adminGroup.nome}'...`);
        await prisma.userGroupLink.create({
            data: {
                usuarioId: adminUser.id,
                grupoId: adminGroup.id
            }
        });
    } else {
        console.log(`Usuário '${adminUser.username}' já estava vinculado ao grupo '${adminGroup.nome}'.`);
    }
    console.log(`[3/3] Vínculo garantido.`);

    console.log('\n--- SUCESSO! ---');
    console.log('Login de administrador corrigido e permissões garantidas (via método manual).');
    console.log(`Tente logar com:\nUsuário: ${ADMIN_USERNAME}\nSenha:   ${ADMIN_PASSWORD}`);
  
  } catch (error) {
    console.error('ERRO AO CORRIGIR O ADMIN (MANUAL):', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminManual();