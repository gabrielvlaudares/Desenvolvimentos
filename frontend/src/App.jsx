// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
// import AdminPanelPage from './pages/AdminPanelPage'; // <-- REMOVIDO, NÃO É MAIS USADO
import AprovacoesPage from './pages/AprovacoesPage';
import MaquinasPage from './pages/MaquinasPage';
import PortariaPage from './pages/PortariaPage';
import SelectPortariaPage from './pages/SelectPortariaPage';
import TransferenciasPage from './pages/TransferenciasPage';

// --- NOVAS IMPORTAÇÕES DAS PÁGINAS ADMIN ---
import UserManagement from './pages/UserManagement';
import GroupManagement from './pages/GroupManagement';
import ConfigManagement from './pages/ConfigManagement';
import AuditLogPage from './pages/AuditLogPage';
import SubstitutoManagement from './pages/SubstitutoManagement';
// --- FIM NOVAS IMPORTAÇÕES ---


// Componente ProtectedRoute (Inalterado)
function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("[ProtectedRoute] Usuário não autenticado. Redirecionando para /login.");
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0) {
    // Adiciona canAccessAdminPanel a CADA verificação,
    // pois um Admin deve poder acessar tudo, mesmo sem a flag específica.
    const effectiveRoles = [...roles, 'canAccessAdminPanel'];
    const hasPermission = effectiveRoles.some(roleKey => user[roleKey] === true);

    if (!hasPermission) {
      console.warn(`[ProtectedRoute] Acesso negado para ${user.username} à rota. Permissões requeridas: ${roles.join(', ')}.`);
      // Redireciona para o dashboard se não tiver permissão
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

// Componente que define a estrutura das rotas da aplicação
function AppRoutes() {
  return (
    <Routes>
      {/* Rota pública para login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rotas protegidas COM Layout (Sidebar) */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                {/* Rota de seleção de portaria (sem sidebar) */}
                <Route path="/select-portaria" element={<SelectPortariaPage />} />
                
                {/* Dashboard */}
                <Route path="/dashboard" element={<DashboardPage />} />
                
                {/* Módulo Máquinas */}
                <Route path="/maquinas" element={<MaquinasPage />} />
                
                {/* Módulo Transferências */}
                <Route path="/transferencias" element={<TransferenciasPage />} />

                {/* Aprovações - Exige permissão */}
                <Route
                  path="/aprovacoes"
                  element={
                    <ProtectedRoute roles={['canPerformApprovals']}>
                      <AprovacoesPage />
                    </ProtectedRoute>
                  }
                />

                {/* Portaria - Exige permissão */}
                <Route
                  path="/portaria"
                  element={
                    <ProtectedRoute roles={['canAccessPortariaControl']}>
                      <PortariaPage />
                    </ProtectedRoute>
                  }
                />

                {/* --- ROTAS ADMIN ATUALIZADAS --- */}
                
                {/* Rota /admin agora redireciona para a primeira sub-página */}
                <Route
                  path="/admin"
                  element={<Navigate to="/admin/users" replace />}
                />
                
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute roles={['canManageUsers']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/groups"
                  element={
                    <ProtectedRoute roles={['canManageGroups']}>
                      <GroupManagement />
                    </ProtectedRoute>
                  }
                />
                 <Route
                  path="/admin/substitutos"
                  element={
                    <ProtectedRoute roles={['canManageUsers']}>
                      <SubstitutoManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/config"
                  element={
                    <ProtectedRoute roles={['canManageConfig']}>
                      <ConfigManagement />
                    </ProtectedRoute>
                  }
                />
                {/* Rota de Auditoria movida para /admin/audit */}
                <Route
                  path="/admin/audit"
                  element={
                    <ProtectedRoute roles={['canViewAuditLog']}>
                      <AuditLogPage />
                    </ProtectedRoute>
                  }
                />

                {/* Rota /audit antiga (removemos, pois agora está em /admin/audit) */}
                {/* <Route path="/audit" ... />  <-- REMOVIDA */}

                {/* --- FIM ROTAS ADMIN --- */}

                {/* Rota padrão - redireciona para dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// Componente Raiz da Aplicação
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}