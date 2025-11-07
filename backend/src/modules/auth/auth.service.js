// src/modules/auth/auth.service.js
const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ldap = require('ldapjs');
const { getUserPermissions: fetchUserPermissionsFromDb } = require('../../utils/permissions'); // Renomeado para clareza

// Função auxiliar para gerar token JWT
const generateToken = (user, groups = []) => {

  // Calcula as permissões combinadas a partir dos grupos
  const combinedPermissions = {
    canAccessAdminPanel: groups.some(g => g.canAccessAdminPanel),
    canManageUsers: groups.some(g => g.canManageUsers),
    canManageGroups: groups.some(g => g.canManageGroups),
    canManageConfig: groups.some(g => g.canManageConfig),
    canPerformApprovals: groups.some(g => g.canPerformApprovals),
    canAccessPortariaControl: groups.some(g => g.canAccessPortariaControl),
    canCreateSaidaMaquina: groups.some(g => g.canCreateSaidaMaquina),
    canCreateTransferencia: groups.some(g => g.canCreateTransferencia),
    canViewAuditLog: groups.some(g => g.canViewAuditLog),
    // Adicione outras permissões aqui
  };

  // Monta o payload do token
  const payload = {
    id: user.id,
    username: user.username,
    nome: user.nome,
    email: user.email,
    departamento: user.departamento || null, // <-- ADICIONADO
    authMethod: user.authMethod || 'local',
    
    gestorNome: user.gestor?.nome || null,
    gestorEmail: user.gestor?.email || null,

    ...combinedPermissions, // Inclui todas as flags 'can...'
  };

  if (user.authMethod === 'ldap_unimported') {
    delete payload.id;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
};


// Função para buscar configurações específicas
const getConfig = async (key) => {
  try {
      const config = await prisma.appConfig.findUnique({ where: { key } });
      return config ? config.value : null;
  } catch (error) { console.error(`Erro ao buscar configuração '${key}':`, error); return null; }
}

// Tenta autenticação local
const attemptLocalLogin = async (username, password) => {
  console.log(`[AUTH_SERVICE V3] Iniciando login local para: ${username}`);
  const user = await prisma.localUser.findUnique({
    where: { username: username },
    include: {
        grupos: {
            include: {
                grupo: true 
            }
        },
        gestor: { // Inclui o gestor
            select: {
                nome: true,
                email: true
            }
        }
        // O campo 'departamento' é uma coluna direta, já vem incluído
    }
  });

  if (!user) { console.log(`[AUTH_SERVICE V3] Usuário local '${username}' não encontrado.`); return null; }
  console.log(`[AUTH_SERVICE V3] Usuário local '${username}' encontrado.`);
  if (user.ativo !== true) { console.log(`[AUTH_SERVICE V3] ERRO: Usuário '${username}' está INATIVO.`); throw new Error('Conta desativada.'); }

  if (!user.passwordHash) {
    console.log(`[AUTH_SERVICE V3] Usuário '${username}' existe localmente mas sem hash de senha. Tentará LDAP.`);
    return { useLdap: true, localUser: user };
  }

  console.log(`[AUTH_SERVICE V3] Usuário local com hash. Comparando senha...`);
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) { console.log(`[AUTH_SERVICE V3] ERRO: Senha local NÃO BATE para '${username}'.`); throw new Error('Credenciais inválidas.'); }

  console.log(`[AUTH_SERVICE V3] SUCESSO: Senha local correta para '${username}'. Gerando token...`);
  const permissionGroups = user.grupos.map(link => link.grupo);
  user.authMethod = 'local';
  return generateToken(user, permissionGroups); // 'user' já contém 'gestor' e 'departamento'
};

// Tenta autenticação via LDAP
const attemptLdapLogin = async (username, password) => {
  const config = await prisma.appConfig.findMany({ where: { key: { in: ['AD_URL', 'AD_BASE_DN'] } } })
    .then(configs => configs.reduce((acc, curr) => { acc[curr.key] = curr.value ?? ''; return acc; }, {}));

  if (!config.AD_URL || !config.AD_BASE_DN) { console.warn('[LDAP Login V3] Pulado: AD_URL/AD_BASE_DN não configurados.'); return null; }

  const domainPart = config.AD_BASE_DN.replace(/DC=/gi, '').replace(/,/g, '.');
  const isPrincipalName = username.includes('@') || username.toLowerCase().includes('cn=') || username.toLowerCase().includes('ou=');
  const userBindIdentifier = isPrincipalName ? username : `${username}@${domainPart}`;

  const client = ldap.createClient({ url: [config.AD_URL], connectTimeout: 5000 });
  console.log(`[LDAP Login V3] Tentando bind com: ${userBindIdentifier}`);

  return new Promise((resolve, reject) => {
    client.bind(userBindIdentifier, password, (bindErr) => {
      if (bindErr) {
        try { client.unbind(); } catch(e){}
        console.error(`[LDAP Login V3] Falha BIND ${userBindIdentifier}:`, bindErr.code, bindErr.message);
        if (bindErr.code === ldap.LDAP_INVALID_CREDENTIALS) {
            return reject(new Error('Credenciais inválidas (LDAP).'));
        }
        return reject(new Error(`Erro na autenticação LDAP: ${bindErr.ldapMessage || bindErr.message}`));
      }

      console.log(`[LDAP Login V3] BIND OK para ${userBindIdentifier}. Buscando perfil...`);
      const searchFilter = `(&(objectClass=user)(userPrincipalName=${userBindIdentifier}))`;
      
      // --- ATUALIZADO: Adiciona 'department' ---
      const attributesToFetch = ['displayName', 'mail', 'sAMAccountName', 'memberOf', 'cn', 'givenName', 'sn', 'department'];
      
      const opts = { filter: searchFilter, scope: 'sub', attributes: attributesToFetch, sizeLimit: 1 };

      let userProfile = null;
      let searchError = null;

      try {
        client.search(config.AD_BASE_DN, opts, (searchErr, res) => {
          if (searchErr) { searchError = new Error(`Erro ao iniciar busca de perfil: ${searchErr.message}`); try{ client.unbind(); } catch(e){} return; }

          res.on('searchEntry', (entry) => {
              if (!userProfile && entry.attributes) {
                  userProfile = {};
                  entry.attributes.forEach(attr => {
                      if (attr.values && attr.values.length > 0) {
                          if (attr.type.toLowerCase() === 'memberof') {
                              userProfile[attr.type] = attr.values;
                          } else {
                              userProfile[attr.type] = attr.values[0];
                          }
                      }
                  });
                  userProfile.sAMAccountName = userProfile.sAMAccountName || username.split('@')[0];
                  userProfile.displayName = userProfile.displayName || userProfile.cn || (userProfile.givenName && userProfile.sn ? `${userProfile.givenName} ${userProfile.sn}` : userProfile.sAMAccountName);
                  
                  // --- ATUALIZADO: Mapeia 'department' ---
                  userProfile.department = userProfile.department || null;
                  
                  console.log(`[LDAP Login V3] Perfil encontrado via ${searchFilter}: ${userProfile.sAMAccountName}`);
              } else if (!entry.attributes) { console.warn(`[LDAP Login V3] SearchEntry recebido sem atributos para ${entry.objectName}`); }
          });

          res.on('error', (streamErr) => {
            console.error('[LDAP Login V3] Erro no stream de resultados da busca:', streamErr);
            searchError = new Error(`Erro durante a busca de perfil no LDAP: ${streamErr.message}`);
          });

          res.on('end', async (result) => {
            try { client.unbind(); } catch(e){}
            if (searchError) return reject(searchError);
            if (result && result.status !== 0 && result.status !== ldap.LDAP_SUCCESS) {
                console.error(`[LDAP Login V3] Busca de perfil finalizada com status ${result.status}.`);
                return reject(new Error(`Falha na busca de perfil LDAP (status: ${result.status}).`));
            }

            if (!userProfile || !userProfile.sAMAccountName) {
              console.error(`[LDAP Login V3] ERRO INESPERADO: Bind OK para ${userBindIdentifier}, mas busca ${searchFilter} não retornou perfil válido.`);
              return reject(new Error('Autenticação LDAP bem-sucedida, mas falha ao recuperar o perfil do usuário no AD.'));
            }

            // --- CÁLCULO DE PERMISSÕES BASEADO EM GRUPOS AD ---
            console.log(`[LDAP Login V3] Perfil ${userProfile.sAMAccountName} recuperado. Verificando mapeamento de grupos AD...`);
            const groupConfig = await prisma.appConfig.findMany({
                where: { key: { in: [
                    'AD_ADMIN_GROUP', 'AD_PORTARIA_GROUP', 'AD_MANAGER_GROUP',
                ] } }
             })
             .then(cfgs => cfgs.reduce((acc, c) => { acc[c.key] = c.value?.toLowerCase() || ''; return acc; }, {}));

            const userGroupsAD = (Array.isArray(userProfile.memberOf) ? userProfile.memberOf : [userProfile.memberOf || ''])
              .map(g => (g.match(/CN=([^,]+)/i) || [])[1]?.toLowerCase()).filter(Boolean);

            const simulatedGroupPermissions = [{
                canAccessAdminPanel: groupConfig.AD_ADMIN_GROUP ? userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP) : false,
                canManageUsers: groupConfig.AD_ADMIN_GROUP ? userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP) : false,
                canManageGroups: groupConfig.AD_ADMIN_GROUP ? userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP) : false,
                canManageConfig: groupConfig.AD_ADMIN_GROUP ? userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP) : false,
                canPerformApprovals: groupConfig.AD_MANAGER_GROUP ? userGroupsAD.includes(groupConfig.AD_MANAGER_GROUP) : false,
                canAccessPortariaControl: groupConfig.AD_PORTARIA_GROUP ? userGroupsAD.includes(groupConfig.AD_PORTARIA_GROUP) : false,
                canCreateSaidaMaquina: !(groupConfig.AD_PORTARIA_GROUP && userGroupsAD.includes(groupConfig.AD_PORTARIA_GROUP) && !userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP)),
                canCreateTransferencia: !(groupConfig.AD_PORTARIA_GROUP && userGroupsAD.includes(groupConfig.AD_PORTARIA_GROUP) && !userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP)),
                canViewAuditLog: groupConfig.AD_ADMIN_GROUP ? userGroupsAD.includes(groupConfig.AD_ADMIN_GROUP) : false,
            }];
            // --- FIM CÁLCULO PERMISSÕES AD ---

            // Resolve a Promise
            resolve({
              username: userProfile.sAMAccountName,
              nome: userProfile.displayName,
              email: userProfile.mail || null,
              departamento: userProfile.department || null, // <-- ADICIONADO
              authMethod: 'ldap_unimported',
              
              // Retorna as permissões calculadas
              canAccessAdminPanel: simulatedGroupPermissions[0].canAccessAdminPanel,
              canManageUsers: simulatedGroupPermissions[0].canManageUsers,
              canManageGroups: simulatedGroupPermissions[0].canManageGroups,
              canManageConfig: simulatedGroupPermissions[0].canManageConfig,
              canPerformApprovals: simulatedGroupPermissions[0].canPerformApprovals,
              canAccessPortariaControl: simulatedGroupPermissions[0].canAccessPortariaControl,
              canCreateSaidaMaquina: simulatedGroupPermissions[0].canCreateSaidaMaquina,
              canCreateTransferencia: simulatedGroupPermissions[0].canCreateTransferencia,
              canViewAuditLog: simulatedGroupPermissions[0].canViewAuditLog,
            });
          }); // Fim res.on('end')
        }); // Fim client.search
      } catch (e) { console.error('[LDAP Login V3] Erro síncrono ao chamar client.search:', e); try { client.unbind(); } catch(unbindErr) {} reject(new Error(`Erro inesperado ao iniciar busca de perfil LDAP: ${e.message}`)); }
    }); // Fim client.bind

    client.on('error', (connErr) => { console.error('[LDAP Login V3] Erro geral do cliente LDAP:', connErr); reject(new Error(`Erro de conexão com o servidor LDAP: ${connErr.message}.`)); });
    client.on('connectTimeout', (timeoutErr) => { console.error('[LDAP Login V3] Timeout na conexão:', timeoutErr); try { client.destroy(); } catch (e) {} reject(new Error('Timeout ao tentar conectar ao servidor LDAP.')); });
  }); // Fim da Promise
};


// Função principal de login (orquestra local e LDAP)
const login = async (username, password) => {
  let localAuthResult;
  try {
    // 1. Tenta Login Local
    localAuthResult = await attemptLocalLogin(username, password);
    if (typeof localAuthResult === 'string') {
        console.log(`[AUTH_SERVICE V3] Login SUCESSO local para '${username}'.`);
        return localAuthResult; // Retorna o token
    }
  }
  catch (error) {
    if (!error.message || !error.message.toLowerCase().includes('credenciais inválidas')) {
        console.log(`[AUTH_SERVICE V3] Falha login local para '${username}' (erro não relacionado a senha): ${error.message}`);
        throw error;
    }
    console.log(`[AUTH_SERVICE V3] Falha na senha local para '${username}'. Tentando LDAP se configurado...`);
  }

  // 2. Tenta Login LDAP
  let ldapProfile;
  try {
    ldapProfile = await attemptLdapLogin(username, password);

    if (!ldapProfile && !localAuthResult?.useLdap) {
        console.log(`[AUTH_SERVICE V3] Login falhou: '${username}' não encontrado localmente e LDAP falhou ou não configurado.`);
        throw new Error('Credenciais inválidas.'); // Erro genérico
    }
    else if (!ldapProfile && localAuthResult?.useLdap) {
         console.log(`[AUTH_SERVICE V3] Login falhou: '${username}' existe localmente sem senha, mas autenticação LDAP falhou.`);
         throw new Error('Credenciais inválidas (LDAP).'); // Erro específico LDAP
    }

    if (ldapProfile) {
        // Caso 1: Usuário EXISTE localmente (importado)
        if (localAuthResult?.useLdap && localAuthResult.localUser) {
            console.log(`[AUTH_SERVICE V3] Login SUCESSO via LDAP para usuário IMPORTADO '${username}'. Usando permissões LOCAIS.`);
            const localUser = localAuthResult.localUser;
            
            // --- ATUALIZADO: Sincroniza dados do AD (incluindo departamento) ---
            await prisma.localUser.update({ 
                where: { id: localUser.id }, 
                data: { 
                    nome: ldapProfile.nome || localUser.nome, 
                    email: ldapProfile.email || localUser.email,
                    departamento: ldapProfile.departamento || localUser.departamento // <-- ADICIONADO
                } 
            }).catch(err => console.error("Erro ao sincronizar dados do AD no login:", err));
            
            // Re-atribui os valores atualizados (exceto gestor, que é local)
            localUser.nome = ldapProfile.nome || localUser.nome;
            localUser.email = ldapProfile.email || localUser.email;
            localUser.departamento = ldapProfile.departamento || localUser.departamento;

            localUser.authMethod = 'ldap_imported';
            const localGroups = localUser.grupos.map(link => link.grupo);
            return generateToken(localUser, localGroups); // 'localUser' já tem gestor e depto
        }
        // Caso 2: Usuário NÃO existe localmente (AD-Hoc)
        else if (!localAuthResult && ldapProfile) {
            console.log(`[AUTH_SERVICE V3] Login SUCESSO via LDAP para usuário NÃO IMPORTADO '${username}'. Usando permissões calculadas do AD.`);
            const adPermissionsAsGroups = [{
                canAccessAdminPanel: ldapProfile.canAccessAdminPanel,
                canManageUsers: ldapProfile.canManageUsers,
                canManageGroups: ldapProfile.canManageGroups,
                canManageConfig: ldapProfile.canManageConfig,
                canPerformApprovals: ldapProfile.canPerformApprovals,
                canAccessPortariaControl: ldapProfile.canAccessPortariaControl,
                canCreateSaidaMaquina: ldapProfile.canCreateSaidaMaquina,
                canCreateTransferencia: ldapProfile.canCreateTransferencia,
                canViewAuditLog: ldapProfile.canViewAuditLog,
            }];
            // ldapProfile já contém 'departamento' vindo do AD
            return generateToken(ldapProfile, adPermissionsAsGroups);
        }
    }

  } catch (error) {
    console.log(`[AUTH_SERVICE V3] Falha na tentativa LDAP para '${username}': ${error.message}`);
    throw error;
  }

  console.error(`[AUTH_SERVICE V3] Estado inesperado no final do processo de login para '${username}'.`);
  throw new Error('Falha inesperada no processo de login.');
};


module.exports = { login };