// src/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware'); // Protege a rota

const router = express.Router();

const UPLOAD_DIR_NFS = path.join(__dirname, '../../uploads/nfs'); // Caminho absoluto correto

// Garante que a pasta existe
if (!fs.existsSync(UPLOAD_DIR_NFS)){
    fs.mkdirSync(UPLOAD_DIR_NFS, { recursive: true });
}

// Configuração do armazenamento do Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR_NFS); // Salva na pasta correta
  },
  filename: function (req, file, cb) {
    // Gera um nome de ficheiro único para evitar conflitos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Preserva a extensão original do ficheiro
    const extension = path.extname(file.originalname);
    // Usa um prefixo 'nf-' como no seu exemplo original
    cb(null, 'nf-' + uniqueSuffix + extension);
  }
});

// Filtro para aceitar apenas PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true); // Aceita o ficheiro
  } else {
    cb(new Error('Tipo de ficheiro inválido. Apenas PDFs são permitidos.'), false); // Rejeita o ficheiro
  }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite de 10MB (ajuste se necessário)
    }
});

/**
 * @route   POST /api/upload
 * @desc    Faz o upload de um único ficheiro PDF (campo 'pdfFile')
 * @access  Private (requer login)
 */
router.post(
    '/',
    protect, // Garante que o usuário está logado
    upload.single('pdfFile'), // Nome do campo esperado do FormData
    (req, res) => {
        // Se o multer encontrou um erro (tipo, tamanho), ele será tratado aqui
        if (!req.file) {
            // Se não for erro do multer mas o ficheiro não chegou
            return res.status(400).json({ message: 'Nenhum ficheiro PDF válido enviado.' });
        }

        // Sucesso! Retorna o caminho RELATIVO para o ficheiro, acessível via web
        // Ex: /uploads/nfs/nf-12345.pdf
        const filePath = `/uploads/nfs/${req.file.filename}`;
        res.status(200).json({
            message: 'Ficheiro enviado com sucesso.',
            filePath: filePath
        });
    },
    // Middleware de tratamento de erros do Multer (opcional, mas bom ter)
    (error, req, res, next) => {
        if (error instanceof multer.MulterError) {
            // Erro conhecido do Multer (ex: limite de tamanho)
             return res.status(400).json({ message: `Erro no upload: ${error.message}` });
        } else if (error) {
            // Outro erro (ex: filtro de tipo de ficheiro)
            return res.status(400).json({ message: error.message });
        }
        // Se não houver erro, continua
        next();
    }
);

module.exports = router;