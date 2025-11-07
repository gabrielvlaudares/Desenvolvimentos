// src/components/Layout.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Menu,
  X,
  Home,
  CheckCircle,
  Package,
  Truck,
  DoorOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Bell,
  Search,
  ChevronDown, // <-- Ícone para sub-menu
  Users,       // <-- Ícone para sub-menu
  Shield,      // <-- Ícone para sub-menu
  UserCheck    // <-- Ícone para sub-menu
} from 'lucide-react';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // --- LÓGICA DO SUB-MENU ADMIN ---
  // Verifica se a rota atual está dentro de /admin/
  const isViewingAdminSection = location.pathname.startsWith('/admin');
  // Mantém o sub-menu aberto por padrão se já estivermos em uma página de admin
  const [isAdminOpen, setIsAdminOpen] = useState(isViewingAdminSection);

  // Sincroniza o estado de abertura do menu se a rota mudar
  useEffect(() => {
    setIsAdminOpen(location.pathname.startsWith('/admin'));
  }, [location.pathname]);
  
  // Define os itens do sub-menu de administração
  const adminSubMenuItems = [
    { id: 'admin-users', label: 'Gerenciar Usuários', icon: Users, path: '/admin/users', permission: 'canManageUsers' },
    { id: 'admin-groups', label: 'Gerenciar Grupos', icon: Shield, path: '/admin/groups', permission: 'canManageGroups' },
    { id: 'admin-substitutos', label: 'Programar Ausências', icon: UserCheck, path: '/admin/substitutos', permission: 'canManageUsers' },
    { id: 'admin-config', label: 'Configurações', icon: Settings, path: '/admin/config', permission: 'canManageConfig' },
    { id: 'admin-audit', label: 'Logs de Auditoria', icon: FileText, path: '/admin/audit', permission: 'canViewAuditLog' }
  ].filter(item => user && (user[item.permission] || user.canAccessAdminPanel)); // Filtra por permissão

  // --- FIM LÓGICA SUB-MENU ---


  // --- MENU PRINCIPAL ATUALIZADO ---
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      show: true
    },
    {
      id: 'aprovacoes',
      label: 'Aprovações',
      icon: CheckCircle,
      path: '/aprovacoes',
      show: user?.canPerformApprovals
    },
    {
      id: 'maquinas',
      label: 'Saída de Máquinas',
      icon: Package,
      path: '/maquinas',
      show: user?.canCreateSaidaMaquina
    },
    {
      id: 'transferencias',
      label: 'Transferências',
      icon: Truck,
      path: '/transferencias',
      show: user?.canCreateTransferencia
    },
    {
      id: 'portaria',
      label: 'Controle Portaria',
      icon: DoorOpen,
      path: '/portaria',
      show: user?.canAccessPortariaControl
    },
    // { id: 'audit', ... } // REMOVIDO - Agora está dentro de Admin
    {
      id: 'admin',
      label: 'Administração',
      icon: Settings,
      path: '/admin', // Opcional: link para a primeira sub-página
      show: user?.canAccessAdminPanel || adminSubMenuItems.length > 0, // Mostra se for admin ou tiver acesso a *alguma* sub-página
      dividerBefore: true,
      // --- NOVO: Define os filhos ---
      children: adminSubMenuItems
    }
  ].filter(item => item.show);
  // --- FIM MENU PRINCIPAL ---

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      logout();
      navigate('/login');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // ATUALIZADO: isActive agora checa /admin* para o menu principal
  const isActive = (path) => {
     if (path === '/admin') {
         return isViewingAdminSection; // Ativo se estiver em /admin/qualquer-coisa
     }
    return location.pathname === path;
  };
  
  // Função para renderizar um item de menu (e seus filhos, se houver)
  const renderMenuItem = (item, isMobile = false) => {
      const Icon = item.icon;
      const active = isActive(item.path);
      const isParentAdmin = item.id === 'admin';
      
      // Se for o item "Administração"
      if (isParentAdmin && item.children.length > 0) {
          return (
            <React.Fragment key={item.id}>
              {/* Divisor */}
              {item.dividerBefore && (
                <li className="my-3 px-2">
                  <div className="h-px bg-white/10"></div>
                </li>
              )}
              {/* Botão Pai (Administração) */}
              <li>
                <button
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className={`
                    flex items-center justify-between w-full px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${active 
                      ? 'bg-white text-[#001f3f] font-medium' 
                      : 'hover:bg-white/10 text-blue-100'
                    }
                    ${sidebarOpen ? '' : 'justify-center'}
                  `}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <div className="flex items-center space-x-3">
                    <Icon 
                      size={20} 
                      className={`flex-shrink-0 ${active ? 'text-[#001f3f]' : ''}`}
                    />
                    {sidebarOpen && <span className="flex-1">{item.label}</span>}
                  </div>
                  {/* Ícone de Seta (sanfona) */}
                  {sidebarOpen && (
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isAdminOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>
              </li>
              
              {/* --- Sub-Menu (Renderizado Condicionalmente) --- */}
              {/* Oculta se o sidebar ou o sub-menu não estiverem abertos */}
              <div className={`transition-all duration-300 ease-in-out ${isAdminOpen && sidebarOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <ul className="pl-8 pr-2 py-1 space-y-1">
                  {item.children.map(child => {
                    const ChildIcon = child.icon;
                    const isChildActive = location.pathname === child.path;
                    return (
                      <li key={child.id}>
                        <Link
                          to={child.path}
                          onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
                          className={`
                            flex items-center space-x-3 px-3 py-2 rounded-lg text-sm
                            transition-all duration-200
                            ${isChildActive
                              ? 'bg-white/20 text-white font-medium' // Estilo ativo para sub-item
                              : 'hover:bg-white/10 text-blue-200'
                            }
                          `}
                        >
                          <ChildIcon size={18} className="flex-shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </React.Fragment>
          );
      }
      
      // Renderiza item de menu normal (sem filhos)
      return (
        <React.Fragment key={item.id}>
          {item.dividerBefore && (
            <li className="my-3 px-2">
              <div className="h-px bg-white/10"></div>
            </li>
          )}
          <li>
            <Link
              to={item.path}
              onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}
              className={`
                flex items-center space-x-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${active 
                  ? 'bg-white text-[#001f3f] font-medium' 
                  : 'hover:bg-white/10 text-blue-100'
                }
                ${sidebarOpen ? '' : 'justify-center'}
                group
                relative
              `}
              title={!sidebarOpen ? item.label : ''}
            >
              <Icon 
                size={20} 
                className={`flex-shrink-0 ${active ? 'text-[#001f3f]' : ''}`}
              />
              
              {sidebarOpen && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              
              {!sidebarOpen && item.badge && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {item.badge}
                </div>
              )}
              
              {!sidebarOpen && (
                <div className="
                  absolute left-full ml-2 px-3 py-2
                  bg-gray-900 text-white text-sm rounded-lg
                  opacity-0 group-hover:opacity-100
                  transition-opacity duration-200
                  pointer-events-none
                  whitespace-nowrap
                  shadow-xl
                  z-50
                ">
                  {item.label}
                </div>
              )}
            </Link>
          </li>
        </React.Fragment>
      );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* --- SIDEBAR - Desktop (ATUALIZADA) --- */}
      <aside
        className={`
          hidden md:flex flex-col
          bg-[#001f3f]
          text-white
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-20'}
          shadow-lg
          relative
          z-30
        `}
      >
        {/* Logo e Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                <span className="text-[#001f3f] font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">SCSE</h1>
                <p className="text-xs text-blue-200">Sistema de Controle</p>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleSidebar}
            className={`
              p-2 rounded-lg hover:bg-white/10 transition-colors
              ${sidebarOpen ? '' : 'mx-auto'}
            `}
            title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          >
            {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Informações do Usuário */}
        <div className={`
          p-4 border-b border-white/10
          ${sidebarOpen ? '' : 'px-2'}
        `}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={20} />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.nome}</p>
                <p className="text-xs text-blue-200 truncate">{user?.username}</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu de Navegação - ATUALIZADO */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {menuItems.map(item => renderMenuItem(item, false))}
          </ul>
        </nav>
      </aside>

      {/* --- SIDEBAR - Mobile (ATUALIZADA) --- */}
      <div className={`
        md:hidden fixed inset-0 bg-black/50 z-40
        transition-opacity duration-300
        ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}>
        <aside className={`
          fixed left-0 top-0 bottom-0 w-64
          bg-[#001f3f]
          text-white shadow-2xl
          transition-transform duration-300
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}>
          {/* Header Mobile */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            {/* (Logo - inalterado) */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                <span className="text-[#001f3f] font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">SCSE</h1>
                <p className="text-xs text-blue-200">Sistema de Controle</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* User Info Mobile */}
          <div className="p-4 border-b border-white/10">
             {/* (Info User - inalterado) */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-medium">{user?.nome}</p>
                <p className="text-xs text-blue-200">{user?.username}</p>
              </div>
            </div>
          </div>

          {/* Menu Mobile */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-1">
              {/* Renderiza o menu usando a mesma lógica do desktop */}
              {menuItems.map(item => renderMenuItem(item, true))}
            </ul>
          </nav>
        </aside>
      </div>

      {/* --- ÁREA PRINCIPAL (Header + Conteúdo) --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-gray-200 z-20">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Breadcrumb (ATUALIZADO) */}
            <div className="flex items-center space-x-3 text-sm">
              <div className="flex items-center space-x-2 text-gray-500">
                <Home size={16} />
                <span>/</span>
              </div>
              {/* Lógica de Breadcrumb: Se for admin, mostra o pai, senão mostra o item normal */}
              {isViewingAdminSection ? (
                <>
                  <div className="text-gray-500">Administração</div>
                  <span>/</span>
                  <div className="px-3 py-1.5 bg-[#001f3f] text-white rounded-lg font-semibold shadow-sm">
                    {adminSubMenuItems.find(item => item.path === location.pathname)?.label || 'Admin'}
                  </div>
                </>
              ) : (
                <div className="px-3 py-1.5 bg-[#001f3f] text-white rounded-lg font-semibold shadow-sm">
                  {menuItems.find(item => isActive(item.path))?.label || 'Dashboard'}
                </div>
              )}
            </div>

            {/* Actions (Inalterado) */}
            <div className="flex items-center space-x-3">
              <button className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600">
                <Search size={18} />
                <span className="text-sm font-medium">Buscar</span>
                <kbd className="px-2 py-0.5 text-xs bg-white rounded border border-gray-300">⌘K</kbd>
              </button>
              <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="hidden md:block h-8 w-px bg-gray-200"></div>
              <div className="hidden md:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user?.nome?.split(' ')[0]}</p>
                  <p className="text-xs text-gray-500">Online</p>
                </div>
                <div className="w-9 h-9 bg-[#001f3f] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {user?.nome?.charAt(0)}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 transition-colors border border-gray-200 hover:border-red-200"
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}