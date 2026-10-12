import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Warehouse, LogOut, ShieldCheck, User, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import { ProfileModal } from './ProfileModal';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

export interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarCollapsed = false,
  isSidebarOpen = true,
}) => {
  const { user, activeWarehouse, setActiveWarehouse, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <header className="glass-panel sticky top-0 z-30 flex h-16 w-full items-center justify-between px-4 sm:px-6 border-b border-slate-800">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={
                !isSidebarOpen
                  ? 'Buka Sidebar (Ctrl+B)'
                  : isSidebarCollapsed
                  ? 'Perluas Sidebar (Ctrl+B)'
                  : 'Perkecil / Tutup Sidebar (Ctrl+B)'
              }
              aria-label="Toggle Sidebar"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 hover:border-cyan-500/40 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 cursor-pointer"
            >
              {/* Desktop view */}
              <span className="hidden md:flex">
                {!isSidebarOpen ? (
                  <PanelLeftOpen className="h-5 w-5 text-cyan-400" />
                ) : isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5 text-cyan-400" />
                ) : (
                  <PanelLeftClose className="h-5 w-5 text-slate-400 hover:text-cyan-300" />
                )}
              </span>
              {/* Mobile view */}
              <span className="flex md:hidden">
                <Menu className="h-5 w-5 text-cyan-400" />
              </span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Logistic<span className="text-cyan-400">Qu</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                  SJS-VIPO Site
                </span>
              </h1>
            </div>
          </div>

          {/* Warehouse Selector */}
          {user.warehouses.length > 0 && (
            <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-700/60">
              <label className="text-xs text-slate-400 mr-2 flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5 text-cyan-400" />
                Gudang Aktif:
              </label>
              <select
                value={activeWarehouse}
                onChange={(e) => setActiveWarehouse(e.target.value)}
                className="bg-slate-800/80 border border-slate-700 text-xs text-cyan-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {user.warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id} className="bg-slate-900 text-slate-200">
                    {wh.name} ({wh.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* In-App Notification Engine */}
          <NotificationBell />

          {/* Theme Toggle Button (Sebelah kanan notifikasi) */}
          <ThemeToggle />

          {/* User Role Badge */}
          <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/60 rounded-full px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-slate-300">{user.role_name}</span>
          </div>

          {/* User Info & Avatar - Click to Open Profile */}
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            title="Kelola Profil & Password Saya"
            className="flex items-center gap-2.5 p-1.5 px-2 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-all text-right group"
          >
            <div className="hidden sm:block text-xs">
              <p className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                {user.full_name}
              </p>
              <p className="text-[10px] text-slate-400">@{user.username}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-300 group-hover:border-cyan-400 transition-colors shrink-0 shadow-sm">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Keluar dari sistem"
            className="flex items-center justify-center h-8 w-8 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Profile Management Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};
