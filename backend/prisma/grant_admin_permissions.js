// prisma/grant_admin_permissions.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Carrega .env
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function grantAdminPermissions() {
  const adminGroupName = 'Administradores'; // Ajuste se o nome do grupo for diferente

  try {
    console.log(`Procurando pelo grupo: ${adminGroupName}`);
    const adminGroup = await prisma.permissionGroup.findUnique({
      where: { nome: adminGroupName },
    });

    if (!adminGroup) {
      console.error(`ERRO: Grupo "${adminGroupName}" não encontrado. Crie o grupo primeiro ou ajuste o nome no script.`);
      return;
    }

    console.log(`Grupo encontrado (ID: ${adminGroup.id}). Atualizando permissões...`);

    const updatedGroup = await prisma.permissionGroup.update({
      where: { id: adminGroup.id },
      data: {
        // Define TODAS as permissões como true
        canAccessAdminPanel: true,
        canManageUsers: true,
        canManageGroups: true,
        canManageConfig: true,
        canPerformApprovals: true,
        canAccessPortariaControl: true,
        canCreateSaidaMaquina: true,
        canCreateTransferencia: true,
        // Adicione outras permissões futuras aqui também
      },
    });

    console.log('--------------------------------------------------');
    console.log(`SUCESSO! Permissões atualizadas para o grupo "${updatedGroup.nome}":`);
    console.log(`  canAccessAdminPanel: ${updatedGroup.canAccessAdminPanel}`);
    console.log(`  canManageUsers: ${updatedGroup.canManageUsers}`);
    console.log(`  canManageGroups: ${updatedGroup.canManageGroups}`);
    console.log(`  canManageConfig: ${updatedGroup.canManageConfig}`);
    console.log(`  canPerformApprovals: ${updatedGroup.canPerformApprovals}`);
    console.log(`  canAccessPortariaControl: ${updatedGroup.canAccessPortariaControl}`);
    console.log(`  canCreateSaidaMaquina: ${updatedGroup.canCreateSaidaMaquina}`);
    console.log(`  canCreateTransferencia: ${updatedGroup.canCreateTransferencia}`);
    console.log('--------------------------------------------------');
    console.log('Faça logout e login novamente com o usuário admin no frontend.');

  } catch (error) {
    console.error('ERRO AO EXECUTAR O SCRIPT:', error);
  } finally {
    await prisma.$disconnect();
  }
}

grantAdminPermissions();
```

Para executar este script:

```bash
node prisma/grant_admin_permissions.js
