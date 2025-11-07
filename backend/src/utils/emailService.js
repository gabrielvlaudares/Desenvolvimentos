// src/utils/emailService.js
const nodemailer = require('nodemailer');
const prisma = require('../config/prisma');

/**
 * Busca as configurações de SMTP e Templates do banco de dados
 */
async function getEmailConfig() {
  const keys = [
    // SMTP Config
    'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM',
    // Templates
    'EMAIL_APROVACAO_SUBJECT', 'EMAIL_APROVACAO_BODY',
    // URL do Frontend (para links)
    'FRONTEND_URL'
  ];
  
  const configs = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
  
  const configMap = configs.reduce((acc, curr) => {
    acc[curr.key] = curr.value || '';
    return acc;
  }, {});

  // Validação
  if (!configMap.EMAIL_HOST || !configMap.EMAIL_USER || !configMap.EMAIL_PASS) {
    throw new Error('Configurações de SMTP (HOST, USER, PASS) não encontradas. Verifique o Painel Admin.');
  }
  if (!configMap.EMAIL_APROVACAO_SUBJECT || !configMap.EMAIL_APROVACAO_BODY) {
     throw new Error('Templates de e-mail (SUBJECT, BODY) não encontrados. Verifique o Painel Admin.');
  }
   if (!configMap.FRONTEND_URL) {
     console.warn('[EmailService] FRONTEND_URL não definido. Links de e-mail podem não funcionar.');
     configMap.FRONTEND_URL = 'http://localhost:5173'; 
   }

  return configMap;
}

/**
 * Cria e retorna um "transporter" do Nodemailer
 */
function createTransporter(smtpConfig) {
  const port = parseInt(smtpConfig.port, 10);
  if (isNaN(port)) {
    throw new Error('Porta (EMAIL_PORT) inválida.');
  }
  
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: port,
    secure: port === 465, 
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Substitui tags no template de e-mail
 */
function replaceTags(template, data) {
    return template.replace(/{{([A-Z_]+)}}/g, (match, tag) => {
        return data.hasOwnProperty(tag) ? data[tag] : match;
    });
}

/**
 * Envia um e-mail de solicitação de aprovação para o gestor.
 * @param {object} maquinaSaida - O objeto completo da MaquinaSaida que foi criada.
 * @param {string} destinatarioEmail - O e-mail final (original ou substituto) para quem enviar.
 */
async function sendApprovalEmail(maquinaSaida, destinatarioEmail) { // <-- ATUALIZADO
  console.log(`[EmailService] Iniciando envio de e-mail de aprovação para ID #${maquinaSaida.idSequencial} -> Destinatário: ${destinatarioEmail}`);
  
  try {
    // 1. Carrega todas as configurações necessárias
    const config = await getEmailConfig();

    const smtpConfig = {
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    };
    
    // 2. Cria o transporter
    const transporter = createTransporter(smtpConfig);

    // 3. Busca o nome do gestor (destinatário)
    let gestorNome = destinatarioEmail; // Fallback para o e-mail
    if (destinatarioEmail) {
        try {
            const gestorUser = await prisma.localUser.findUnique({
                where: { email: destinatarioEmail },
                select: { nome: true }
            });
            if (gestorUser && gestorUser.nome) {
                gestorNome = gestorUser.nome;
            }
        } catch (dbError) {
            console.error(`[EmailService] Erro ao buscar nome do gestor (email: ${destinatarioEmail}). Usando e-mail como fallback.`, dbError);
        }
    }

    // 4. Prepara o objeto de dados para as tags
    const baseUrl = config.FRONTEND_URL.endsWith('/') ? config.FRONTEND_URL.slice(0, -1) : config.FRONTEND_URL;
    const tagData = {
        'GESTOR_NOME': gestorNome,
        'SOLICITANTE': maquinaSaida.solicitante || 'N/D',
        'AREA_RESPONSAVEL': maquinaSaida.areaResponsavel || 'N/D',
        'ID_SOLICITACAO': maquinaSaida.idSequencial || 'N/D',
        'DESCRICAO_MATERIAL': maquinaSaida.descricaoMaterial || 'N/D',
        'MOTIVO_SAIDA': maquinaSaida.motivoSaida || 'N/D',
        'DATA_ENVIO': new Date(maquinaSaida.dataEnvio).toLocaleDateString('pt-BR'),
        'PRAZO_RETORNO': maquinaSaida.prazoRetorno ? new Date(maquinaSaida.prazoRetorno).toLocaleDateString('pt-BR') : 'N/A',
        'LINK_APROVACAO': `${baseUrl}/aprovacoes`,
    };

    // 5. Prepara o e-mail (Assunto e Corpo)
    const subject = replaceTags(config.EMAIL_APROVACAO_SUBJECT, tagData);
    const htmlBody = replaceTags(config.EMAIL_APROVACAO_BODY, tagData).replace(/\n/g, '<br>');

    // 6. Define as opções do e-mail
    const mailOptions = {
      from: config.EMAIL_FROM,
      to: destinatarioEmail, // <-- USA O DESTINATÁRIO FINAL
      subject: subject,
      html: htmlBody,
    };

    // 7. Envia o e-mail
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] E-mail de aprovação enviado para ${destinatarioEmail}. Message ID: ${info.messageId}`);
    
  } catch (error) {
    console.error(`[EmailService] FALHA CRÍTICA ao enviar e-mail de aprovação para ID #${maquinaSaida.idSequencial} (Destinatário: ${destinatarioEmail}):`, error.message);
  }
}

module.exports = {
  sendApprovalEmail,
};