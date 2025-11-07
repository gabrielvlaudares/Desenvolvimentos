// src/server.js
require('dotenv').config(); // Carrega variáveis de ambiente
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Módulo Node para interagir com o sistema de ficheiros
const cron = require('node-cron'); // <-- NOVO: Para agendamento
const adminService = require('./modules/admin/admin.service'); // <-- NOVO: Para chamar a sync
const mainRouter = require('./routes'); // Importa o roteador principal (que contém /auth, /admin, /maquinas)
const uploadRoutes = require('./routes/upload'); // Importa as rotas de upload

const app = express();

// Middlewares Essenciais
app.use(cors()); // Permite requisições do frontend (configure origens específicas em produção)
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Habilita o parsing de dados de formulário URL-encoded

// --- CONFIGURAÇÃO DE UPLOAD ---
// Define o caminho absoluto para a pasta onde os PDFs das NFs serão guardados
const UPLOAD_SUBDIR = 'nfs'; // Subdiretório para NFs
const UPLOAD_BASE_DIR = path.join(__dirname, '../uploads'); // Pasta base 'uploads'
const UPLOAD_NFS_DIR = path.join(UPLOAD_BASE_DIR, UPLOAD_SUBDIR); // Caminho completo: ../uploads/nfs

// Cria a pasta de upload (e a base, se necessário) caso não existam
if (!fs.existsSync(UPLOAD_NFS_DIR)){
    // 'recursive: true' cria pastas pai se necessário (uploads/ e depois nfs/)
    fs.mkdirSync(UPLOAD_NFS_DIR, { recursive: true });
    console.log(`Pasta de uploads NFS criada em: ${UPLOAD_NFS_DIR}`);
}

// Configura o Express para servir ficheiros estáticos da pasta 'uploads'
// Qualquer pedido para /uploads/* será procurado na pasta backend/uploads/
// Ex: GET /uploads/nfs/nf-123.pdf buscará o ficheiro backend/uploads/nfs/nf-123.pdf
app.use('/uploads', express.static(UPLOAD_BASE_DIR));
// --- FIM CONFIGURAÇÃO UPLOAD ---


// --- ROTAS DA API ---
// Aplica o prefixo /api para todas as rotas definidas no mainRouter
app.use('/api', mainRouter);

// Aplica o prefixo /api/upload para as rotas definidas em uploadRoutes
app.use('/api/upload', uploadRoutes); //
// --- FIM ROTAS DA API ---

// Rota de "saúde" (opcional, bom para verificar se a API está no ar)
app.get('/', (req, res) => {
  res.send('API do Sistema de Controle de Saídas (SCSE) está no ar!');
});

// Inicialização do Servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  // --- ATUALIZADO: Agendamento da Sincronização Automática ---
  // Expressão Cron: '0 7-19 * * *'
  // Significa: "No minuto 0 (ex: 7:00, 8:00...), a cada hora, das 7h até as 19h, todos os dias"
  const schedule = '0 7-19 * * *';
  
  console.log(`[CronJob] Agendando sincronização do AD para: ${schedule} (A cada hora, das 7h às 19h, America/Sao_Paulo).`);
  
  cron.schedule(schedule, async () => {
    console.log('[CronJob] Iniciando sincronização agendada de usuários do AD...');
    try {
      // Chama o serviço de sincronização (passando 'system' como auditor)
      const results = await adminService.syncLdapUsers({ username: 'system (cron)' });
      console.log(`[CronJob] Sincronização agendada concluída. ${results.message}`);
    } catch (e) {
      console.error(`[CronJob] FALHA na sincronização agendada do AD: ${e.message}`);
    }
  }, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
  });
  // --- FIM AGENDAMENTO ---

});