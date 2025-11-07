// prisma/temp_reset_admin.js

// 1. Importa o módulo 'path' para resolver o caminho do .env
const path = require('path');

// 2. Carrega o .env CORRETAMENTE, subindo um nível (de 'prisma' para 'backend')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function resetAdminPassword() {
  console.log('Iniciando script de reset de senha...');

  // A NOVA SENHA SERÁ '12345'
  const newPassword = '12345';
  const saltRounds = 10;
  
  try {
    // Gerar o hash A PARTIR DA SENHA
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    console.log(`Novo hash gerado para a senha '${newPassword}'`);

    // Usamos 'upsert':
    // - Procura por 'admin'
    // - Se existir, atualiza (update)
    // - Se não existir, cria (create)
    const user = await prisma.localUser.upsert({
      where: {
        username: 'admin',
      },
      update: { // O que fazer se encontrar o 'admin'
        passwordHash: newPasswordHash,
        ativo: true,
        isAdmin: true,
      },
      create: { // O que fazer se NÃO encontrar o 'admin'
        username: 'admin',
        passwordHash: newPasswordHash,
        nome: 'Administrador (Criado por Script)',
        ativo: true,
        isAdmin: true,
        isPortaria: false,
        isManager: false,
      },
    });

    console.log('--------------------------------------------------');
    console.log('SUCESSO! Senha do usuário "admin" foi criada/redefinida.');
    console.log(`Usuário: ${user.username}`);
    console.log(`Ativo: ${user.ativo}`);
    console.log(`Admin: ${user.isAdmin}`);
    console.log('--------------------------------------------------');
    console.log('Por favor, tente logar com:');
    console.log('Usuário: admin');
    console.log('Senha:   12345');
    console.log('--------------------------------------------------');

  } catch (error) {
    console.error('ERRO AO EXECUTAR O SCRIPT:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();