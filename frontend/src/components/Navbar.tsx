import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Warehouse, LogOut, ShieldCheck, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, activeWarehouse, setActiveWarehouse, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="glass-panel sticky top-0 z-30 flex h-16 w-full items-center justify-between px-6 border-b border-slate-800">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Logistic<span className="text-cyan-400">Qu</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                PT Vale Site
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

      <div className="flex items-center gap-4">
        {/* User Role Badge */}
        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/60 rounded-full px-3 py-1">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-slate-300">{user.role_name}</span>
        </div>

        {/* User Info */}
        <div className="hidden sm:flex items-center gap-2 text-right">
          <div className="text-xs">
            <p className="font-semibold text-slate-200">{user.full_name}</p>
            <p className="text-[10px] text-slate-400">@{user.username}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4" />
          </div>
        </div>

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
  );
};
