import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  GitPullRequest,
  Truck,
  Scale,
  Database,
  BarChart3,
  History,
  Users,
  RotateCcw,
  Layers,
  Wrench,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'inventory'
  | 'bins'
  | 'mechanic-requests'
  | 'pos'
  | 'returns'
  | 'replenishment'
  | 'drops'
  | 'adjustment'
  | 'master'
  | 'reports'
  | 'audit'
  | 'users';

export interface MenuItemConfig {
  id: TabId;
  label: string;
  icon: React.FC<{ className?: string }>;
  requiredPermissions: string[];
}

export const ALL_MENU_ITEMS: MenuItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPermissions: [] },
  { id: 'inventory', label: 'Monitoring Stok', icon: Boxes, requiredPermissions: ['inventory.view'] },
  { id: 'bins', label: 'Layout & Denah Bin Rak', icon: Layers, requiredPermissions: ['bins.view', 'inventory.view'] },
  {
    id: 'mechanic-requests',
    label: 'Permohonan Mekanik',
    icon: Wrench,
    requiredPermissions: [
      'mechanic_request.view',
      'mechanic_request.create',
      'mechanic_request.approve',
      'mechanic_request.fulfill',
    ],
  },
  { id: 'pos', label: 'POS Issue Spare Part', icon: ShoppingCart, requiredPermissions: ['issue.create', 'issue.approve', 'issue.view'] },
  { id: 'returns', label: 'Retur Part Bekas', icon: RotateCcw, requiredPermissions: ['returns.view', 'returns.receive', 'returns.transfer', 'returns.complete'] },
  { id: 'replenishment', label: 'Alur Permohonan Stok', icon: GitPullRequest, requiredPermissions: ['request.view', 'request.create', 'request.verify', 'request.approve', 'sto.receive'] },
  { id: 'drops', label: 'Drop Gudang Utama', icon: Truck, requiredPermissions: ['drops.view', 'sto.ship'] },
  { id: 'adjustment', label: 'Stock Opname / Koreksi', icon: Scale, requiredPermissions: ['adjustment.view', 'adjustment.create', 'adjustment.approve'] },
  { id: 'master', label: 'Master Data & Unit', icon: Database, requiredPermissions: ['master.view', 'master.manage'] },
  { id: 'reports', label: 'Laporan & Konsumsi', icon: BarChart3, requiredPermissions: ['reports.view'] },
  { id: 'audit', label: 'Jejak Audit Sistem', icon: History, requiredPermissions: ['audit.view'] },
  { id: 'users', label: 'Manajemen Pengguna & Akses', icon: Users, requiredPermissions: ['users.manage'] },
];

export const isTabAccessible = (tabId: TabId, permissions: string[] = [], roleId?: string): boolean => {
  const normRole = (roleId || '').toUpperCase();
  if (normRole === 'SUPER_ADMIN') return true;

  // 1. Mekanik Lapangan: Permohonan Mekanik, Monitoring Stok, dan Tanggungan Core Retur Part Bekas
  if (normRole === 'MECHANIC') {
    return tabId === 'mechanic-requests' || tabId === 'inventory' || tabId === 'returns';
  }

  // 2. Admin Kontainer: dilarang keras mengakses Permohonan Mekanik (#2), Drop Gudang Utama, dan Master Data & Unit
  if (normRole.includes('CONTAINER_ADMIN') || normRole.includes('ADMIN_CONT')) {
    if (tabId === 'mechanic-requests' || tabId === 'drops' || tabId === 'master') {
      return false;
    }
  }

  // 3. Admin Gudang Utama: dilarang mengakses POS Issue Loket, Permohonan Mekanik, Stock Opname, dan Master Data & Unit
  if (normRole.includes('MAIN_ADMIN') || normRole.includes('ADMIN_MAIN')) {
    if (tabId === 'pos' || tabId === 'mechanic-requests' || tabId === 'adjustment' || tabId === 'master') {
      return false;
    }
  }

  // 4. Supervisor: tidak memiliki akses manajemen pengguna teknis, Master Data & Unit, Layout & Denah Bin Rak, Permohonan Mekanik, dan POS Issue
  if (normRole.includes('SUPERVISOR')) {
    if (
      tabId === 'users' ||
      tabId === 'master' ||
      tabId === 'bins' ||
      tabId === 'mechanic-requests' ||
      tabId === 'pos'
    ) {
      return false;
    }
  }

  const menu = ALL_MENU_ITEMS.find((m) => m.id === tabId);
  if (!menu) return false;
  if (menu.requiredPermissions.length === 0) return true;
  return menu.requiredPermissions.some((perm) => permissions.includes(perm));
};

export interface SidebarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isDesktopOpen?: boolean;
  onCloseDesktop?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  isDesktopOpen = true,
  onCloseDesktop,
}) => {
  const { user } = useAuth();
  const userPerms = user?.permissions || [];
  const userRole = user?.role_id;

  const accessibleMenuItems = ALL_MENU_ITEMS.filter((item) =>
    isTabAccessible(item.id, userPerms, userRole)
  );

  // In mobile drawer mode, always show expanded view so labels are clearly readable
  const isMini = isCollapsed && !isMobileOpen;

  return (
    <aside
      className={`
        glass-panel border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out z-30 select-none
        ${isMobileOpen 
          ? 'fixed inset-y-0 left-0 z-50 w-72 p-4 shadow-2xl flex bg-slate-950/95 backdrop-blur-xl' 
          : 'hidden md:flex'
        }
        ${!isDesktopOpen 
          ? 'md:hidden' 
          : isMini 
            ? 'md:w-[72px] md:p-2' 
            : 'md:w-64 md:p-4'
        }
      `}
    >
      <div className="space-y-2">
        {/* Header row with Title and Toggle/Close Buttons */}
        <div
          className={`flex items-center ${
            isMini ? 'justify-center' : 'justify-between'
          } px-2 py-1.5 border-b border-slate-800/60 pb-2.5`}
        >
          {!isMini ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase truncate">
                  Menu Operasional
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Collapse button on Desktop */}
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    title="Perkecil Sidebar (Ctrl+B)"
                    className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {/* Close completely button on Desktop */}
                {onCloseDesktop && (
                  <button
                    type="button"
                    onClick={onCloseDesktop}
                    title="Tutup Sidebar Sepenuhnya"
                    className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {/* Close drawer button on Mobile */}
                {onCloseMobile && (
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    title="Tutup Menu"
                    className="flex md:hidden p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Mini Header Toggle */
            onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Perluas Sidebar (Ctrl+B)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all mx-auto cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Menu Items List */}
        <div className="space-y-1">
          {accessibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const displayLabel =
              user?.role_id === 'MECHANIC' && item.id === 'returns'
                ? 'Tanggungan Core Retur'
                : item.label;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={displayLabel}
                className={`w-full flex items-center rounded-lg text-xs font-medium transition-all group relative cursor-pointer ${
                  isMini
                    ? 'justify-center py-2.5 px-0'
                    : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon
                  className={`shrink-0 transition-colors ${
                    isMini ? 'w-5 h-5' : 'w-4 h-4'
                  } ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`}
                />
                
                {!isMini && (
                  <span className="truncate">{displayLabel}</span>
                )}

                {/* Floating Tooltip in Mini Mode */}
                {isMini && (
                  <div className="pointer-events-none absolute left-full ml-2 hidden group-hover:flex items-center z-50">
                    <div className="bg-slate-900 border border-slate-700/80 text-slate-100 text-xs font-medium px-2.5 py-1.5 rounded-md shadow-xl whitespace-nowrap flex items-center gap-2">
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Area */}
      <div className="pt-2 border-t border-slate-800/60 space-y-2">
        {!isMini ? (
          <>
            {/* Quick Toggle Button on Desktop */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Perkecil Sidebar (Ctrl+B)"
                className="hidden md:flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-all border border-slate-800/80 hover:border-cyan-500/30 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <PanelLeftClose className="w-4 h-4 text-slate-400" />
                  <span>Perkecil Menu</span>
                </span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                  Ctrl+B
                </kbd>
              </button>
            )}

            {/* Environment info */}
            <div className="rounded-lg p-3 bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">LogisticQu WMS</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-[10px] text-slate-500">SJS-VIPO Mining Operation</p>
            </div>
          </>
        ) : (
          <>
            {/* Collapsed Expand Button */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Perluas Sidebar (Ctrl+B)"
                className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-all border border-transparent hover:border-cyan-500/30 cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Compact Environment status */}
            <div
              className="rounded-lg p-2 bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center gap-1"
              title="LogisticQu WMS - Online (SJS-VIPO Mining Operation)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono text-emerald-400 font-semibold">ON</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

