// src/modules/admin/admin.service.js
const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');
const ldap = require('ldapjs');
const nodemailer = require('nodemailer'); 
const { logAuditEvent, EntityType } = require('../../utils/auditLog');

// Helper para converter ID para string para o log
const formatIdForLog = (id) => String(id);

// --- Config Service ---
const getAllConfig = async () => {
  const configs = await prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
  // Filtra senhas para não enviar ao frontend
  return configs.filter(c => !c.key.includes('PASSWORD') && !c.key.includes('PASS') && !c.key.includes('AD_BIND_PASSWORD'));
};

const updateConfig = async (configUpdates, userAuth) => {
  const updates = Array.isArray(configUpdates) ? configUpdates : [configUpdates];
  
  // Filtra chaves de senha que estão vazias (não devem ser atualizadas)
  const validUpdates = updates.filter(config => {
    const isPasswordKey = config.key.includes('PASSWORD') || config.key.includes('PASS') || config.key.includes('AD_BIND_PASSWORD');
    // Se for chave de senha E o valor for vazio/null, NÃO atualiza.
    if (isPasswordKey && (config.value === null || config.value === '')) {
        return false;
    }
    return true;
  });

  if (validUpdates.length === 0) {
    console.log("[AdminService] Nenhuma atualização de configuração válida para processar.");
    return [];
  }

  const keysToFetch = validUpdates.map(u => u.key);
  const configsBefore = await prisma.appConfig.findMany({ where: { key: { in: keysToFetch } } });
  const configsBeforeMap = new Map(configsBefore.map(c => [c.key, c.value]));

  const transactions = validUpdates.map(config =>
    prisma.appConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: { key: config.key, value: config.value, descricao: config.key },
    })
  );

  const results = await prisma.$transaction(transactions);

  // --- LOG DE AUDITORIA ---
  const changes = validUpdates.map(update => {
    const oldValue = configsBeforeMap.get(update.key);
    const isSensitive = update.key.includes('PASSWORD') || update.key.includes('PASS') || update.key.includes('AD_BIND_PASSWORD');
    const newValueLog = isSensitive ? '*****' : (update.value || '');
    const oldValueLog = isSensitive ? '*****' : (oldValue || '');
    if (oldValue !== update.value) {
      return `${update.key}: '${oldValueLog}' -> '${newValueLog}'`;
    }
    return null;
  }).filter(Boolean);

  if (changes.length > 0) {
    console.log(`[AdminService updateConfig] Preparando para logar ${changes.length} alterações.`); // Log de Verificação
    await logAuditEvent(
      EntityType.CONFIG,
      validUpdates.map(u => u.key).join(','),
      'CONFIG_UPDATED',
      userAuth.username,
      `Alterações: ${changes.join('; ')}`
    );
  } else {
    console.log("[AdminService updateConfig] Nenhuma alteração detetada para logar."); // Log de Verificação
  }
  // --- FIM LOG ---

  return results;
};


// --- User Service ---
const getAllLocalUsers = async () => {
  return prisma.localUser.findMany({
    select: { 
      id: true, 
      username: true, 
      nome: true, 
      email: true, 
      departamento: true,
      ativo: true, 
      passwordHash: true, // Envia o hash (ou null) para o frontend poder filtrar
      grupos: { 
        select: { 
          grupo: { 
            select: { 
              id: true, 
              nome: true, 
              canPerformApprovals: true
            } 
          } 
        } 
      },
      gestor: { select: { id: true, nome: true } }
    },
    orderBy: { nome: 'asc' },
  });
};

const createLocalUser = async (data, userAuth) => {
  const { password, groupIds = [], email, gestorId, departamento, managerName, ...userData } = data;
  const finalEmail = email && email.trim() !== '' ? email.trim() : null;
  let passwordHash = null;

  if (password && password.trim() !== '') {
    const saltRounds = 10;
    passwordHash = await bcrypt.hash(password, saltRounds);
  } else if (!userData.username.includes('@') && !userData.username.toLowerCase().includes('cn=') && !userData.username.toLowerCase().includes('ou=')) {
    console.warn(`[AdminService createLocalUser] Criando usuário local '${userData.username}' sem senha (provavelmente AD).`);
  }
  
  let intGestorId = gestorId ? parseInt(gestorId, 10) : null;

  if (!intGestorId && managerName) {
      console.log(`[AdminService createLocalUser] Importação AD: Tentando encontrar gestor pelo nome: '${managerName}' (case-insensitive)`);
      try {
          const gestor = await prisma.localUser.findFirst({
              where: {
                  nome: {
                      equals: managerName,
                      mode: 'insensitive' // Busca case-insensitive
                  },
                  ativo: true
              }
          });

          if (gestor) {
              console.log(`[AdminService createLocalUser] Gestor encontrado no banco local: ID ${gestor.id} (Nome: ${gestor.nome})`);
              intGestorId = gestor.id;
          } else {
              console.warn(`[AdminService createLocalUser] Gestor com nome '${managerName}' não encontrado ou inativo no banco local. Usuário será criado sem gestor.`);
          }
      } catch (e) {
          console.error(`[AdminService createLocalUser] Erro ao buscar gestor por nome: ${e.message}`);
      }
  }

  const newUser = await prisma.localUser.create({
    data: {
      ...userData,
      email: finalEmail,
      passwordHash: passwordHash, // Será null para usuários AD
      departamento: departamento || null, 
      gestorId: intGestorId,
      grupos: {
        create: groupIds.map(id => ({
          grupo: { connect: { id: id } }
        }))
      }
    },
    include: {
      grupos: { include: { grupo: { select: { nome: true } } } },
      gestor: { select: { nome: true } }
    }
  });

  // --- LOG DE AUDITORIA ---
  const groupNames = newUser.grupos.map(g => g.grupo.nome).join(', ') || 'Nenhum';
  console.log(`[AdminService createLocalUser] Preparando para logar criação do usuário ID ${newUser.id}.`);
  await logAuditEvent(
    EntityType.USER,
    formatIdForLog(newUser.id),
    'USER_CREATED',
    userAuth.username,
    `Usuário criado: ${newUser.username}, Nome: ${newUser.nome}, Depto: ${newUser.departamento || '-'}, Gestor: ${newUser.gestor?.nome || '-'}, Grupos: [${groupNames}]`
  );
  // --- FIM LOG ---

  const { passwordHash: _, ...userWithoutHash } = newUser;
  return userWithoutHash;
};

const updateLocalUser = async (id, data, userAuth) => {
  const { password, groupIds = [], email, gestorId, departamento, ...userData } = data;
  const finalEmail = email && email.trim() !== '' ? email.trim() : null;
  const intGestorId = gestorId ? parseInt(gestorId, 10) : null;

  const userBefore = await prisma.localUser.findUnique({
    where: { id },
    include: { 
      grupos: { include: { grupo: { select: { id: true, nome: true } } } },
      gestor: { select: { id: true, nome: true } }
    }
  });
  if (!userBefore) throw new Error('Usuário não encontrado para atualização.');

  const updateData = { 
    ...userData, 
    email: finalEmail, 
    gestorId: intGestorId, 
    departamento: departamento || null
  };
  let passwordChanged = false;

  if (password && password.trim() !== '') {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    updateData.passwordHash = passwordHash;
    passwordChanged = true;
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.userGroupLink.deleteMany({ where: { usuarioId: id } });
    const newLinks = groupIds.map(gid => ({ usuarioId: id, grupoId: gid }));
    if (newLinks.length > 0) {
      await tx.userGroupLink.createMany({ data: newLinks, skipDuplicates: true });
    }
    const userAfter = await tx.localUser.update({
      where: { id: id },
      data: updateData,
      include: {
        grupos: { include: { grupo: { select: { id: true, nome: true } } } },
        gestor: { select: { id: true, nome: true } }
      }
    });
    return userAfter;
  });

  // --- LOG DE AUDITORIA ---
  const changes = [];
  if (userBefore.nome !== updatedUser.nome) changes.push(`Nome: '${userBefore.nome}' -> '${updatedUser.nome}'`);
  if ((userBefore.email || '') !== (updatedUser.email || '')) changes.push(`Email: '${userBefore.email || '-'}' -> '${updatedUser.email || '-'}'`);
  if ((userBefore.departamento || '') !== (updatedUser.departamento || '')) changes.push(`Depto: '${userBefore.departamento || '-'}' -> '${updatedUser.departamento || '-'}'`);
  if (userBefore.ativo !== updatedUser.ativo) changes.push(`Ativo: ${userBefore.ativo} -> ${updatedUser.ativo}`);
  if (passwordChanged) changes.push('Senha alterada');
  
  const oldGestorName = userBefore.gestor?.nome || 'Nenhum';
  const newGestorName = updatedUser.gestor?.nome || 'Nenhum';
  if (oldGestorName !== newGestorName) {
      changes.push(`Gestor: '${oldGestorName}' -> '${newGestorName}'`);
  }

  const oldGroupNames = userBefore.grupos.map(g => g.grupo.nome).sort().join(', ') || 'Nenhum';
  const newGroupNames = updatedUser.grupos.map(g => g.grupo.nome).sort().join(', ') || 'Nenhum';
  if (oldGroupNames !== newGroupNames) {
    changes.push(`Grupos: [${oldGroupNames}] -> [${newGroupNames}]`);
  }

  if (changes.length > 0) {
    console.log(`[AdminService updateLocalUser] Preparando para logar ${changes.length} alterações para usuário ID ${updatedUser.id}.`);
    await logAuditEvent(
      EntityType.USER,
      formatIdForLog(updatedUser.id),
      'USER_UPDATED',
      userAuth.username,
      `Usuário ${updatedUser.username} atualizado. Alterações: ${changes.join('; ')}`
    );
  } else {
    console.log(`[AdminService updateLocalUser] Nenhuma alteração detetada para logar para usuário ID ${updatedUser.id}.`);
  }
  // --- FIM LOG ---

  const { passwordHash: _, ...userWithoutHash } = updatedUser;
  return userWithoutHash;
};

const deleteLocalUser = async (id, userAuth) => {
  const userToDelete = await prisma.localUser.findUnique({ where: { id } });
  if (!userToDelete) throw new Error('Usuário não encontrado para exclusão.');
  if (userAuth.id === id) throw new Error('Não é possível excluir a si mesmo.');
  if (userToDelete.username === 'admin') throw new Error("Não é permitido excluir o usuário 'admin'.");

  const subordinatesCount = await prisma.localUser.count({ where: { gestorId: id } });
  if (subordinatesCount > 0) {
      throw new Error(`Não é possível excluir o usuário "${userToDelete.nome}" pois ele é gestor de ${subordinatesCount} usuário(s). Reatribua esses usuários primeiro.`);
  }

  const deletedUser = await prisma.localUser.delete({ where: { id: id } });

  // --- LOG DE AUDITORIA ---
  console.log(`[AdminService deleteLocalUser] Preparando para logar exclusão do usuário ID ${id}.`);
  await logAuditEvent(
    EntityType.USER,
    formatIdForLog(id),
    'USER_DELETED',
    userAuth.username,
    `Usuário deletado: ${userToDelete.username} (Nome: ${userToDelete.nome})`
  );
  // --- FIM LOG ---

  return deletedUser;
};


// --- Permission Group Service ---
const getAllPermissionGroups = async () => {
  return prisma.permissionGroup.findMany({ orderBy: { nome: 'asc' } });
};

const createPermissionGroup = async (data, userAuth) => {
  const cleanData = { ...data };
  Object.keys(cleanData).forEach(key => {
    if (key.startsWith('can') && typeof cleanData[key] !== 'boolean') {
      cleanData[key] = Boolean(cleanData[key]);
    }
  });
  const newGroup = await prisma.permissionGroup.create({ data: cleanData });
  // LOG...
  const permissions = Object.keys(newGroup).filter(key => key.startsWith('can') && newGroup[key] === true).join(', ');
  await logAuditEvent(
    EntityType.GROUP,
    formatIdForLog(newGroup.id),
    'GROUP_CREATED',
    userAuth.username,
    `Grupo criado: ${newGroup.nome}, Descrição: ${newGroup.descricao || '-'}, Permissões: [${permissions || 'Nenhuma'}]`
  );
  return newGroup;
};

const updatePermissionGroup = async (id, data, userAuth) => {
  const groupBefore = await prisma.permissionGroup.findUnique({ where: { id } });
  if (!groupBefore) throw new Error('Grupo não encontrado para atualização.');
  const cleanData = { ...data };
  Object.keys(cleanData).forEach(key => {
    if (key.startsWith('can') && typeof cleanData[key] !== 'boolean') {
      cleanData[key] = Boolean(cleanData[key]);
    }
  });
  const updatedGroup = await prisma.permissionGroup.update({ where: { id: id }, data: cleanData });
  // LOG...
  const changes = [];
  if (groupBefore.nome !== updatedGroup.nome) changes.push(`Nome: '${groupBefore.nome}' -> '${updatedGroup.nome}'`);
  if ((groupBefore.descricao || '') !== (updatedGroup.descricao || '')) changes.push(`Descrição: '${groupBefore.descricao || '-'}' -> '${updatedGroup.descricao || '-'}'`);
  const permKeys = Object.keys(updatedGroup).filter(key => key.startsWith('can'));
  const permChanges = permKeys.filter(key => groupBefore[key] !== updatedGroup[key])
    .map(key => `${key.replace('can','').replace(/([A-Z])/g, ' $1').trim()}: ${groupBefore[key] ? 'Sim' : 'Não'} -> ${updatedGroup[key] ? 'Sim' : 'Não'}`);
  if (permChanges.length > 0) changes.push(`Permissões alteradas: ${permChanges.join('; ')}`);
  if (changes.length > 0) {
    await logAuditEvent(
      EntityType.GROUP,
      formatIdForLog(updatedGroup.id),
      'GROUP_UPDATED',
      userAuth.username,
      `Grupo ${updatedGroup.nome} atualizado. Alterações: ${changes.join(' | ')}`
    );
  }
  return updatedGroup;
};

const deletePermissionGroup = async (id, userAuth) => {
  const groupToDelete = await prisma.permissionGroup.findUnique({
    where: { id },
    include: { usuarios: true }
  });
  if (!groupToDelete) throw new Error('Grupo não encontrado para exclusão.');
  if (groupToDelete.usuarios.length > 0) {
    throw new Error(`Não é possível excluir o grupo "${groupToDelete.nome}" pois ele está associado a ${groupToDelete.usuarios.length} usuário(s). Remova as associações primeiro.`);
  }
  if (groupToDelete.nome === 'Administradores') {
    throw new Error('Não é permitido excluir o grupo "Administradores".');
  }
  const deletedGroup = await prisma.permissionGroup.delete({ where: { id: id } });
  // LOG...
  await logAuditEvent(
    EntityType.GROUP,
    formatIdForLog(id),
    'GROUP_DELETED',
    userAuth.username,
    `Grupo deletado: ${groupToDelete.nome}`
  );
  return deletedGroup;
};


// ===================================
// LDAP Service Functions
// ===================================
const getLdapConfig = async () => {
    const keys = ['AD_URL', 'AD_BASE_DN', 'AD_BIND_DN', 'AD_BIND_PASSWORD'];
    const configs = await prisma.appConfig.findMany({ where: { key: { in: keys } } });
    return configs.reduce((acc, curr) => { acc[curr.key] = curr.value ?? ''; return acc; }, {});
};

const testLdapConnection = async (config) => {
  // (Função testLdapConnection permanece a mesma)
  const { AD_URL, AD_BIND_DN, AD_BIND_PASSWORD } = config;
  if (!AD_URL) { throw new Error('A URL do AD (AD_URL) é obrigatória para o teste.'); }
  const client = ldap.createClient({ url: [AD_URL], connectTimeout: 5000 });
  return new Promise((resolve, reject) => {
    const bindDN = AD_BIND_DN || ''; const bindPassword = AD_BIND_PASSWORD || '';
    console.log(`[LDAP Test] Tentando bind com DN: ${bindDN || 'Anônimo'}`);
    client.bind(bindDN, bindPassword, (err) => { client.unbind(); if (err) { console.error('[LDAP Test] Falha no bind:', err); if (err.code === ldap.LDAP_INVALID_CREDENTIALS) { return reject(new Error('Falha na conexão: Credenciais de Bind inválidas.')); } else if (err.code === ldap.LDAP_SERVER_DOWN || err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT') { return reject(new Error('Falha na conexão: Não foi possível conectar ao servidor LDAP. Verifique a URL e a rede.')); } return reject(new Error(`Falha na conexão LDAP: ${err.ldapMessage || err.message || err.code || 'Erro desconhecido'}`)); } console.log('[LDAP Test] Bind bem-sucedido.'); resolve({ message: 'Conexão com o servidor AD realizada com sucesso!' }); });
    client.on('error', (connErr) => { console.error('[LDAP Test] Erro de conexão inicial:', connErr); try { client.destroy(); } catch (e) {} reject(new Error(`Erro de conexão inicial com o servidor LDAP: ${connErr.message}. Verifique a URL.`)); });
    client.on('connectTimeout', (timeoutErr) => { console.error('[LDAP Test] Timeout na conexão:', timeoutErr); try { client.destroy(); } catch (e) {} reject(new Error('Timeout ao tentar conectar ao servidor LDAP. Verifique a rede.')); });
  });
};

const searchLdapUsers = async (searchTerm, adminUsername, adminPassword) => {
  // (Função searchLdapUsers permanece a mesma)
  const config = await getLdapConfig();
  if (!config.AD_URL || !config.AD_BASE_DN) { throw new Error('Configuração AD_URL ou AD_BASE_DN não encontrada no Painel Admin.'); }
  if (!adminUsername || !adminPassword) { throw new Error('Credenciais do administrador do AD são necessárias para a busca.'); }
  const client = ldap.createClient({ url: [config.AD_URL] });
  return new Promise((resolve, reject) => {
    const domainPart = config.AD_BASE_DN.replace(/DC=/g, '').replace(/,/g, '.');
    const isAdminPrincipalName = adminUsername.includes('@') || adminUsername.toLowerCase().includes('cn=') || adminUsername.toLowerCase().includes('ou=');
    const adminBindIdentifier = isAdminPrincipalName ? adminUsername : `${adminUsername}@${domainPart}`;
    console.log(`[LDAP Search] Tentando bind com admin: ${adminBindIdentifier}`);
    client.bind(adminBindIdentifier, adminPassword, (err) => {
      if (err) { client.unbind(); if (err.code === ldap.LDAP_INVALID_CREDENTIALS) { return reject(new Error('Falha na autenticação do admin no AD: Credenciais inválidas.')); } return reject(new Error(`Falha ao autenticar admin no AD: ${err.ldapMessage || err.message || err.code || 'Erro desconhecido'}.`)); }
      console.log('[LDAP Search] Bind do admin OK. Buscando usuários...');
      const ldapFilter = `(&(|(displayName=*${searchTerm}*)(sAMAccountName=*${searchTerm}*)(cn=*${searchTerm}*))(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
      const opts = { filter: ldapFilter, scope: 'sub', attributes: ['sAMAccountName', 'displayName', 'mail', 'cn', 'givenName', 'sn', 'department', 'manager'], sizeLimit: 50 };
      const results = []; let searchError = null;
      try {
        client.search(config.AD_BASE_DN, opts, (searchErr, res) => {
          if (searchErr) { searchError = new Error(`Erro ao iniciar a busca LDAP: ${searchErr.message}`); try { client.unbind(); } catch (e) {} return; }
          res.on('searchEntry', (entry) => {
              const getAttributeValue = (attrs, attrName) => { const attr = attrs.find(a => a.type.toLowerCase() === attrName.toLowerCase()); return attr?.vals?.[0]; };
              if (!entry.attributes) return;
              const username = getAttributeValue(entry.attributes, 'sAMAccountName');
              const displayName = getAttributeValue(entry.attributes, 'displayName');
              const cn = getAttributeValue(entry.attributes, 'cn');
              const givenName = getAttributeValue(entry.attributes, 'givenName');
              const sn = getAttributeValue(entry.attributes, 'sn');
              const email = getAttributeValue(entry.attributes, 'mail');
              const department = getAttributeValue(entry.attributes, 'department');
              const managerDN = getAttributeValue(entry.attributes, 'manager');
              const nome = displayName || cn || (givenName && sn ? `${givenName} ${sn}` : username);
              let managerName = null;
              if (managerDN) {
                  const cnMatch = managerDN.match(/CN=([^,]+)/i);
                  if (cnMatch && cnMatch[1]) {
                      managerName = cnMatch[1];
                  }
              }
              if (username && nome) { 
                results.push({ username, nome, email: email || null, departamento: department || null, managerName: managerName }); 
              }
           });
          res.on('searchReference', (ref) => console.log('[LDAP Search] Referência recebida:', ref.uris.join()));
          res.on('error', (streamErr) => { searchError = new Error(`Erro no stream de busca LDAP: ${streamErr.message}`); });
          res.on('end', (result) => {
            try { client.unbind(); } catch (unbindErr) { console.error("Erro ao fazer unbind no 'end'", unbindErr); }
            if (searchError) { return reject(searchError); }
            if (result && result.status !== 0) { return reject(new Error(`Busca LDAP finalizada com status não-zero: ${result.status}.`)); }
            console.log(`[LDAP Search] Busca concluída. ${results.length} usuários encontrados.`);
            resolve(results);
          });
        });
      } catch (e) { console.error('[LDAP Search] Erro síncrono ao chamar client.search:', e); try { client.unbind(); } catch (unbindErr) {} reject(new Error(`Erro inesperado ao iniciar busca LDAP: ${e.message}`)); }
    });
    client.on('error', (connErr) => { console.error('[LDAP Search] Erro geral do cliente LDAP:', connErr); reject(new Error(`Erro de conexão com o servidor LDAP: ${connErr.message}.`)); });
    client.on('connectTimeout', (timeoutErr) => { console.error('[LDAP Search] Timeout na conexão:', timeoutErr); try { client.destroy(); } catch (e) {} reject(new Error('Timeout ao tentar conectar ao servidor LDAP.')); });
  });
};

// --- Função para buscar TODOS os usuários (usada pela Sincronização) ---
const searchAllLdapUsers = async (adminUsername, adminPassword, sizeLimit = 1000) => {
  const config = await getLdapConfig();
  if (!config.AD_URL || !config.AD_BASE_DN) { throw new Error('Configuração AD_URL ou AD_BASE_DN não encontrada no Painel Admin.'); }
  const bindUser = adminUsername || config.AD_BIND_DN;
  const bindPass = adminPassword || config.AD_BIND_PASSWORD;
  if (!bindUser || !bindPass) {
    throw new Error('Credenciais de administrador (interativas ou de serviço BIND) são obrigatórias para a busca.');
  }
  const client = ldap.createClient({ url: [config.AD_URL] });
  return new Promise((resolve, reject) => {
    const domainPart = config.AD_BASE_DN.replace(/DC=/g, '').replace(/,/g, '.');
    const isAdminPrincipalName = bindUser.includes('@') || bindUser.toLowerCase().includes('cn=') || bindUser.toLowerCase().includes('ou=');
    const adminBindIdentifier = isAdminPrincipalName ? bindUser : `${bindUser}@${domainPart}`;
    console.log(`[LDAP SearchAll] Tentando bind com admin: ${adminBindIdentifier}`);
    client.bind(adminBindIdentifier, bindPass, (err) => {
      if (err) { client.unbind(); if (err.code === ldap.LDAP_INVALID_CREDENTIALS) { return reject(new Error('Falha na autenticação do admin no AD: Credenciais inválidas.')); } return reject(new Error(`Falha ao autenticar admin no AD: ${err.ldapMessage || err.message || err.code || 'Erro desconhecido'}.`)); }
      console.log('[LDAP SearchAll] Bind do admin OK. Buscando TODOS os usuários...');
      const ldapFilter = '(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';
      const opts = { filter: ldapFilter, scope: 'sub', attributes: ['sAMAccountName', 'displayName', 'mail', 'cn', 'givenName', 'sn', 'department', 'manager'], sizeLimit: sizeLimit };
      const results = []; let searchError = null;
      try {
        client.search(config.AD_BASE_DN, opts, (searchErr, res) => {
          if (searchErr) { searchError = new Error(`Erro ao iniciar a busca LDAP: ${searchErr.message}`); try { client.unbind(); } catch (e) {} return; }
          res.on('searchEntry', (entry) => {
              const getAttributeValue = (attrs, attrName) => { const attr = attrs.find(a => a.type.toLowerCase() === attrName.toLowerCase()); return attr?.vals?.[0]; };
              if (!entry.attributes) return;
              const username = getAttributeValue(entry.attributes, 'sAMAccountName');
              const displayName = getAttributeValue(entry.attributes, 'displayName');
              const cn = getAttributeValue(entry.attributes, 'cn');
              const givenName = getAttributeValue(entry.attributes, 'givenName');
              const sn = getAttributeValue(entry.attributes, 'sn');
              const email = getAttributeValue(entry.attributes, 'mail');
              const department = getAttributeValue(entry.attributes, 'department');
              const managerDN = getAttributeValue(entry.attributes, 'manager');
              const nome = displayName || cn || (givenName && sn ? `${givenName} ${sn}` : username);
              let managerName = null;
              if (managerDN) {
                  const cnMatch = managerDN.match(/CN=([^,]+)/i);
                  if (cnMatch && cnMatch[1]) {
                      managerName = cnMatch[1];
                  }
              }
              if (username && nome) { 
                results.push({ username, nome, email: email || null, departamento: department || null, managerName: managerName }); 
              }
           });
          res.on('searchReference', (ref) => console.log('[LDAP SearchAll] Referência recebida:', ref.uris.join()));
          res.on('error', (streamErr) => { searchError = new Error(`Erro no stream de busca LDAP: ${streamErr.message}`); });
          res.on('end', (result) => {
            try { client.unbind(); } catch (unbindErr) { console.error("Erro ao fazer unbind no 'end'", unbindErr); }
            if (searchError) { return reject(searchError); }
            if (result && result.status !== 0) { return reject(new Error(`Busca LDAP finalizada com status não-zero: ${result.status}.`)); }
            console.log(`[LDAP SearchAll] Busca concluída. ${results.length} usuários encontrados (limite: ${sizeLimit}).`);
            resolve(results);
          });
        });
      } catch (e) { console.error('[LDAP SearchAll] Erro síncrono ao chamar client.search:', e); try { client.unbind(); } catch (unbindErr) {} reject(new Error(`Erro inesperado ao iniciar busca LDAP: ${e.message}`)); }
    });
    client.on('error', (connErr) => { console.error('[LDAP SearchAll] Erro geral do cliente LDAP:', connErr); reject(new Error(`Erro de conexão com o servidor LDAP: ${connErr.message}.`)); });
    client.on('connectTimeout', (timeoutErr) => { console.error('[LDAP SearchAll] Timeout na conexão:', timeoutErr); try { client.destroy(); } catch (e) {} reject(new Error('Timeout ao tentar conectar ao servidor LDAP.')); });
  });
};


// ===================================
// Teste E-mail Service (completo)
// ===================================
const testEmailSettings = async (testEmail, userAuth) => {
  console.log(`[Email Test] Iniciado por ${userAuth.username} para ${testEmail}`);
  const emailKeys = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'];
  const configs = await prisma.appConfig.findMany({ where: { key: { in: emailKeys } } });
  const configMap = configs.reduce((acc, curr) => { acc[curr.key] = curr.value ?? ''; return acc; }, {});
  for (const key of emailKeys) {
    if (!configMap[key]) {
      throw new Error(`Configuração obrigatória ${key} não definida. Salve as configurações primeiro.`);
    }
  }
  const host = configMap.EMAIL_HOST;
  const port = parseInt(configMap.EMAIL_PORT, 10);
  const user = configMap.EMAIL_USER;
  const pass = configMap.EMAIL_PASS;
  const from = configMap.EMAIL_FROM;
  if (isNaN(port)) {
    throw new Error('Porta (EMAIL_PORT) inválida. Deve ser um número.');
  }
  try {
    const transporter = nodemailer.createTransport({
      host: host, port: port, secure: port === 465, 
      auth: { user: user, pass: pass },
      tls: { rejectUnauthorized: false }
    });
    await transporter.verify();
    await transporter.sendMail({
      from: from, to: testEmail, subject: 'SCSE - Teste de Configuração de E-mail',
      text: `Olá,\n\nEste é um e-mail de teste enviado pelo Sistema de Controle de Saída de Equipamentos (SCSE).\n\nSe você recebeu esta mensagem, as configurações de SMTP estão funcionando corretamente.\n\nEnviado por: ${userAuth.username}`,
      html: `<p>Olá,</p><p>Este é um e-mail de teste enviado pelo <b>Sistema de Controle de Saída de Equipamentos (SCSE)</b>.</p><p>Se você recebeu esta mensagem, as configurações de SMTP estão funcionando corretamente.</p><hr><p><small>Enviado por: ${userAuth.username}</small></p>`,
    });
    await logAuditEvent(
      EntityType.CONFIG, 'EMAIL_SETTINGS', 'EMAIL_TEST_SENT', userAuth.username,
      `Teste de e-mail enviado com sucesso para: ${testEmail}`
    );
    return { message: `E-mail de teste enviado com sucesso para ${testEmail}!` };
  } catch (error) {
    console.error(`[Email Test] Falha ao enviar e-mail:`, error);
    await logAuditEvent(
      EntityType.CONFIG, 'EMAIL_SETTINGS', 'EMAIL_TEST_FAILED', userAuth.username,
      `Falha ao testar e-mail para ${testEmail}. Erro: ${error.message}`
    );
    throw new Error(`Falha no teste: ${error.message}`);
  }
};

// --- Função de Sincronização de Usuários ---
const syncLdapUsers = async (auditorUser) => {
  const auditorUsername = auditorUser?.username || 'system';
  console.log(`[LDAP Sync] Sincronização iniciada por: ${auditorUsername}`);
  const config = await getLdapConfig();
  if (!config.AD_URL || !config.AD_BASE_DN) {
      throw new Error('Configuração AD_URL ou AD_BASE_DN não encontrada.');
  }
  const bindDN = config.AD_BIND_DN;
  const bindPassword = config.AD_BIND_PASSWORD;
  if (!bindDN || !bindPassword) {
       throw new Error('AD_BIND_DN e AD_BIND_PASSWORD devem estar configurados no Painel Admin para sincronização.');
  }
  const localUsers = await prisma.localUser.findMany({
      where: { username: { not: 'admin' }, passwordHash: null },
      include: { gestor: true } 
  });
  if (localUsers.length === 0) {
      const msg = 'Nenhum usuário local (importado do AD) para sincronizar.';
      console.log(`[LDAP Sync] ${msg}`);
      return { message: msg, updated: 0, failed: 0 };
  }
  const localUserMapByName = new Map();
  (await prisma.localUser.findMany({ where: { ativo: true }, select: { id: true, nome: true } }))
      .forEach(u => localUserMapByName.set(u.nome.toLowerCase(), u.id));
  
  const adUserList = await searchAllLdapUsers(null, null); // Usa credenciais de BIND
  const adUserMap = new Map(adUserList.map(u => [u.username.toLowerCase(), u]));
  console.log(`[LDAP Sync] ${localUsers.length} usuários locais para verificar. ${adUserMap.size} usuários encontrados no AD.`);

  let updatedCount = 0;
  let failedCount = 0;
  const changesLog = [];
  for (const localUser of localUsers) {
      const adUser = adUserMap.get(localUser.username.toLowerCase());
      if (!adUser) { // Não encontrado no AD (desativado ou excluído)
          if (localUser.ativo) {
              try {
                  await prisma.localUser.update({ where: { id: localUser.id }, data: { ativo: false } });
                  const details = `Usuário '${localUser.username}' desativado (não encontrado no AD).`;
                  console.log(`[LDAP Sync] ${details}`);
                  changesLog.push(details);
                  await logAuditEvent(EntityType.USER, formatIdForLog(localUser.id), 'USER_SYNC_DEACTIVATED', auditorUsername, details);
                  updatedCount++;
              } catch (e) { failedCount++; }
          }
          continue; 
      }
      
      // --- INÍCIO DA ALTERAÇÃO ---
      // Se o usuário foi encontrado no AD, mas está INATIVO no painel (desativado manualmente),
      // devemos ignorá-lo e não reativá-lo.
      if (!localUser.ativo) {
          console.log(`[LDAP Sync] Usuário '${localUser.username}' está inativo no painel. Sincronização ignorada para este usuário.`);
          continue; // Pula para o próximo usuário
      }
      // --- FIM DA ALTERAÇÃO ---
      
      // Usuário encontrado no AD E ativo localmente. Comparar campos.
      const updatePayload = {};
      const userChanges = [];
      const adName = adUser.nome;
      if (localUser.nome !== adName) {
          updatePayload.nome = adName;
          userChanges.push(`Nome: '${localUser.nome}' -> '${adName}'`);
      }
      const adEmail = adUser.email || null;
      if (localUser.email !== adEmail) {
          updatePayload.email = adEmail;
          userChanges.push(`Email: '${localUser.email || '-'}' -> '${adEmail || '-'}'`);
      }
      const adDept = adUser.departamento || null;
      if (localUser.departamento !== adDept) {
          updatePayload.departamento = adDept;
          userChanges.push(`Depto: '${localUser.departamento || '-'}' -> '${adDept || '-'}'`);
      }
      let newGestorId = null;
      let newGestorName = 'Nenhum';
      if (adUser.managerName) {
          const managerName = adUser.managerName;
          newGestorId = localUserMapByName.get(managerName.toLowerCase()) || null;
          if(newGestorId) { newGestorName = managerName; }
      }
      if (localUser.gestorId !== newGestorId) {
          updatePayload.gestorId = newGestorId;
          const oldGestorName = localUser.gestor?.nome || 'Nenhum';
          userChanges.push(`Gestor: '${oldGestorName}' -> '${newGestorName}'`);
      }
      
      // O bloco que reativava o usuário foi removido (estava aqui)
      
      if (Object.keys(updatePayload).length > 0) {
          try {
              await prisma.localUser.update({ where: { id: localUser.id }, data: updatePayload });
              const details = `Usuário '${localUser.username}' sincronizado. Mudanças: ${userChanges.join('; ')}`;
              console.log(`[LDAP Sync] ${details}`);
              changesLog.push(details);
              await logAuditEvent(EntityType.USER, formatIdForLog(localUser.id), 'USER_SYNC_UPDATED', auditorUsername, details);
              updatedCount++;
          } catch (e) {
              console.error(`[LDAP Sync] Falha ao atualizar usuário '${localUser.username}': ${e.message}`);
              failedCount++;
          }
      }
  } // Fim do loop
  const summary = `Sincronização concluída. ${updatedCount} usuários atualizados/desativados. ${failedCount} falhas.`;
  console.log(`[LDAP Sync] ${summary}`);
  await logAuditEvent(EntityType.CONFIG, 'LDAP_SYNC', 'LDAP_SYNC_COMPLETED', auditorUsername, summary);
  return { message: summary, updated: updatedCount, failed: failedCount, changes: changesLog };
};

// --- Função de Ação em Massa ---
const bulkUpdateUserStatus = async ({ userIds, ativo, auditorUser }) => {
    const auditorUsername = auditorUser?.username || 'system-bulk';
    const actionText = ativo ? 'ativados' : 'desativados';

    // 1. Filtra a lista de IDs para segurança
    const safeUserIds = userIds.filter(id => {
        // Não pode alterar a si mesmo
        if (id === auditorUser.id) {
            console.warn(`[AdminService Bulk] ${auditorUsername} tentou alterar o próprio status em massa. ID ${id} ignorado.`);
            return false;
        }
        return true;
    });
    
    if (safeUserIds.length === 0) {
        console.warn("[AdminService Bulk] Nenhum ID seguro para atualizar.");
        return { message: "Nenhum usuário foi atualizado (você não pode alterar a si mesmo).", count: 0 };
    }

    // 2. Executa a atualização em massa no banco
    const result = await prisma.localUser.updateMany({
        where: {
            id: {
                in: safeUserIds,
                not: auditorUser.id, // Redundante, mas seguro
            },
            username: {
                not: 'admin', // Segurança extra
            },
        },
        data: {
            ativo: ativo,
        },
    });

    const count = result.count;
    const summary = `${count} usuários ${actionText} com sucesso.`;
    console.log(`[AdminService Bulk] ${summary} por ${auditorUsername}.`);

    // 3. Log de Auditoria
    await logAuditEvent(
        EntityType.USER,
        'BULK_ACTION', // Identificador da entidade
        ativo ? 'USER_BULK_ACTIVATED' : 'USER_BULK_DEACTIVATED',
        auditorUsername,
        `Ação em massa: ${count} usuários ${actionText}. IDs: [${safeUserIds.join(', ')}]`
    );

    return { message: summary, count: count };
};

// --- NOVAS FUNÇÕES DE SUBSTITUIÇÃO ---

/**
 * Busca todos os usuários que têm permissão de aprovação
 */
const getGestoresList = async () => {
    return prisma.localUser.findMany({
        where: {
            ativo: true,
            grupos: {
                some: {
                    grupo: {
                        canPerformApprovals: true,
                    }
                }
            }
        },
        select: {
            id: true,
            nome: true,
            email: true,
        },
        orderBy: {
            nome: 'asc'
        }
    });
};

/**
 * Busca todas as substituições programadas
 */
const getAllSubstitutos = async () => {
    return prisma.gestorSubstituto.findMany({
        include: {
            gestorOriginal: { select: { id: true, nome: true, email: true } }, // Inclui email
            gestorSubstituto: { select: { id: true, nome: true, email: true } } // Inclui email
        },
        orderBy: {
            dataInicio: 'desc'
        }
    });
};

/**
 * Cria uma nova substituição
 */
const createSubstituto = async (data, auditorUser) => {
    const { gestorOriginalId, gestorSubstitutoId, dataInicio, dataFim } = data;

    // Validações
    if (!gestorOriginalId || !gestorSubstitutoId || !dataInicio || !dataFim) {
        throw new Error('Todos os campos são obrigatórios.');
    }
    if (gestorOriginalId === gestorSubstitutoId) {
        throw new Error('O gestor original não pode ser o substituto.');
    }
    const dtInicio = new Date(`${dataInicio}T00:00:00.000Z`); // Garante início do dia em UTC
    const dtFim = new Date(`${dataFim}T23:59:59.999Z`); // Garante fim do dia em UTC
    
    if (dtFim < dtInicio) {
        throw new Error('A data final não pode ser anterior à data inicial.');
    }

    // Verifica sobreposição (se o gestor original já está ausente nesse período)
    const existing = await prisma.gestorSubstituto.findFirst({
        where: {
            gestorOriginalId: gestorOriginalId,
            // Conflito existe se: (A <= Y) e (B >= X)
            dataInicio: { lte: dtFim },
            dataFim: { gte: dtInicio }
        }
    });

    if (existing) {
        throw new Error('Conflito: Este gestor já possui uma substituição programada para este período.');
    }

    // Cria a entrada
    const newSubstituto = await prisma.gestorSubstituto.create({
        data: {
            gestorOriginalId: gestorOriginalId,
            gestorSubstitutoId: gestorSubstitutoId,
            dataInicio: dtInicio,
            dataFim: dtFim,
            criadoPorUpn: auditorUser.username
        },
        include: {
             gestorOriginal: { select: { nome: true } },
             gestorSubstituto: { select: { nome: true } }
        }
    });

    // Log de Auditoria
    await logAuditEvent(
        EntityType.CONFIG, // Pode ser 'CONFIG' ou 'USER'
        `SUBSTITUTO:${newSubstituto.id}`,
        'SUBSTITUTE_CREATED',
        auditorUser.username,
        `Substituição criada: ${newSubstituto.gestorOriginal.nome} -> ${newSubstituto.gestorSubstituto.nome} (De ${formatDateForDisplay(dataInicio)} a ${formatDateForDisplay(dataFim)})`
    );

    return newSubstituto;
};

// Helper simples de formatação de data para o log
const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    // Adiciona 1 dia (se necessário) por causa do T00:00:00Z
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};


/**
 * Deleta uma substituição
 */
const deleteSubstituto = async (id, auditorUser) => {
    const substituto = await prisma.gestorSubstituto.findUnique({
         where: { id },
         include: {
             gestorOriginal: { select: { nome: true } },
             gestorSubstituto: { select: { nome: true } }
         }
    });
    if (!substituto) {
        throw new Error('Substituição não encontrada.');
    }

    await prisma.gestorSubstituto.delete({
        where: { id }
    });

    // Log de Auditoria
    await logAuditEvent(
        EntityType.CONFIG,
        `SUBSTITUTO:${id}`,
        'SUBSTITUTE_DELETED',
        auditorUser.username,
        `Substituição deletada: ${substituto.gestorOriginal.nome} -> ${substituto.gestorSubstituto.nome} (ID: ${id})`
    );

    return { message: 'Substituição deletada.' };
};


// --- Exports ---
module.exports = {
  getAllConfig, updateConfig,
  getAllLocalUsers, createLocalUser, updateLocalUser, deleteLocalUser,
  getAllPermissionGroups, createPermissionGroup, updatePermissionGroup, deletePermissionGroup,
  searchLdapUsers,
  // searchAllLdapUsers NÃO é exportado
  testLdapConnection,
  testEmailSettings,
  syncLdapUsers,
  bulkUpdateUserStatus,
  
  // --- NOVOS Exports ---
  getGestoresList,
  getAllSubstitutos,
  createSubstituto,
  deleteSubstituto,
};