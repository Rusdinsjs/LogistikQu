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
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'inventory'
  | 'pos'
  | 'replenishment'
  | 'drops'
  | 'adjustment'
  | 'master'
  | 'reports'
  | 'audit'
  | 'users';

interface SidebarProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();

  const canManageUsers =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.role_id === 'MANAGER' ||
    user?.permissions.includes('users.manage');

  const menuItems: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Monitoring Stok', icon: Boxes },
    { id: 'pos', label: 'POS Issue Spare Part', icon: ShoppingCart },
    { id: 'replenishment', label: 'Alur Permohonan Stok', icon: GitPullRequest },
    { id: 'drops', label: 'Drop Gudang Utama', icon: Truck },
    { id: 'adjustment', label: 'Stock Opname / Koreksi', icon: Scale },
    { id: 'master', label: 'Master Data & Unit', icon: Database },
    { id: 'reports', label: 'Laporan & Konsumsi', icon: BarChart3 },
    { id: 'audit', label: 'Jejak Audit Sistem', icon: History },
    ...(canManageUsers
      ? [{ id: 'users' as TabId, label: 'Manajemen Pengguna', icon: Users }]
      : []),
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Menu Operasional
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Environment info */}
      <div className="rounded-lg p-3 bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">LogisticQu WMS</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
            Online
          </span>
        </div>
        <p className="text-[10px] text-slate-500">IUP PT Vale Mining Operation</p>
      </div>
    </aside>
  );
};
