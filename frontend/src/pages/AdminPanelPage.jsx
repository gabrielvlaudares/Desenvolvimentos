// src/pages/AdminPanelPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserManagement from './UserManagement';
import GroupManagement from './GroupManagement';
import ConfigManagement from './ConfigManagement';
import AuditLogPage from './AuditLogPage';
import SubstitutoManagement from './SubstitutoManagement'; // <-- 1. IMPORTAR O NOVO COMPONENTE
import { Navigate } from 'react-router-dom';
import { Users, Shield, Settings, FileText, UserCheck } from 'lucide-react'; // <-- 2. ADICIONAR ÍCONE

export default function AdminPanelPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // --- 3. ADICIONAR NOVA ABA À LISTA ---
  const tabs = [
    { id: 'users', label: 'Gerenciar Usuários', icon: Users, permission: 'canManageUsers' },
    { id: 'groups', label: 'Gerenciar Grupos', icon: Shield, permission: 'canManageGroups' },
    // --- NOVO ---
    { id: 'substitutos', label: 'Programar Ausências', icon: UserCheck, permission: 'canManageUsers' },
    // --- FIM NOVO ---
    { id: 'config', label: 'Configurações', icon: Settings, permission: 'canManageConfig' },
    { id: 'audit', label: 'Logs de Auditoria', icon: FileText, permission: 'canViewAuditLog' },
  ];
  
  // Filtra as abas baseando-se nas permissões do usuário
  const accessibleTabs = tabs.filter(tab => user && (user[tab.permission] || user.canAccessAdminPanel));

  // Redireciona se o usuário não tiver acesso a nenhuma aba (pouco provável se ele chegou aqui)
  if (accessibleTabs.length === 0 && user) {
     return <Navigate to="/" replace />;
  }
  
  // Ajusta a aba ativa se a aba atual não for acessível
  let currentActiveTab = activeTab;
  if (!accessibleTabs.find(t => t.id === activeTab)) {
      currentActiveTab = accessibleTabs[0]?.id || '';
  }

  const renderContent = () => {
    switch (currentActiveTab) {
      case 'users':
        return <UserManagement />;
      case 'groups':
        return <GroupManagement />;
      // --- 4. ADICIONAR O CASE PARA RENDERIZAR ---
      case 'substitutos':
        return <SubstitutoManagement />;
      // --- FIM NOVO ---
      case 'config':
        return <ConfigManagement />;
      case 'audit':
        return <AuditLogPage />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Painel de Administração</h1>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Navegação em Abas (Vertical) */}
        <nav className="flex-shrink-0 w-full md:w-64">
          <ul className="space-y-2">
            {accessibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = currentActiveTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center w-full text-left px-4 py-3 rounded-lg
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-blue-700 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon size={20} className="mr-3" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Conteúdo da Aba */}
        <main className="flex-grow min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}