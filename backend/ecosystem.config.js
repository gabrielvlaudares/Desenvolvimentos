// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'scse-app', // O nome do NOSSO projeto
      script: 'src/server.js', // O ponto de entrada do backend
      instances: 2, // Pode ajustar para 'max' ou 1 se preferir
      exec_mode: 'cluster',
      watch: false, // 'true' é ruim para produção, use 'false'
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};