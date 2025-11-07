// src/modules/auth/auth.controller.js
const authService = require('./auth.service');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    const token = await authService.login(username, password);
    res.status(200).json({ token });
  } catch (error) {
    // Erros de "Credenciais inválidas" do service
    res.status(401).json({ message: error.message });
  }
};

module.exports = { login };