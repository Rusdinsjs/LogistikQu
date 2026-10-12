import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight, Shield, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Gagal login. Pastikan server backend sedang aktif.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = [
    { username: 'mekanik_he', role: 'Mekanik Alat Berat', category: 'Mekanik', desc: 'Permohonan stok WH-CONT-HE (EMP-101)', tagClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    { username: 'mekanik_dt', role: 'Mekanik Dump Truck', category: 'Mekanik', desc: 'Permohonan stok WH-CONT-DT (EMP-103)', tagClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    { username: 'admin_cont_he', role: 'Admin Kontainer HE', category: 'Kontainer', desc: 'POS issue, request stok, saldo kontainer HE', tagClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
    { username: 'admin_cont_dt', role: 'Admin Kontainer DT', category: 'Kontainer', desc: 'POS issue, request stok, saldo kontainer DT', tagClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
    { username: 'supervisor_he', role: 'Supervisor Alat Berat', category: 'Supervisor', desc: 'Khusus mengawasi & approval WH-MAIN-HE & WH-CONT-HE', tagClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { username: 'supervisor_dt', role: 'Supervisor Dump Truck', category: 'Supervisor', desc: 'Khusus mengawasi & approval WH-MAIN-DT & WH-CONT-DT', tagClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    { username: 'admin_main_he', role: 'Admin Utama HE', category: 'Gudang Utama', desc: 'Verifikasi request & supply drop kontainer HE', tagClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    { username: 'admin_main_dt', role: 'Admin Utama DT', category: 'Gudang Utama', desc: 'Verifikasi request & supply drop kontainer DT', tagClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    { username: 'manager', role: 'Manager Logistik', category: 'Manajemen', desc: 'Akses executive semua gudang & approval', tagClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    { username: 'superadmin', role: 'Super Admin', category: 'Sistem', desc: 'Akses teknis root seluruh modul & sistem', tagClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  ];

  const handleQuickLogin = (uname: string) => {
    setUsername(uname);
    setPassword('password123');
    setError(null);
    setSubmitting(true);
    login(uname, 'password123')
      .catch((err: any) => {
        console.error('Quick login error:', err);
        setError(
          err?.response?.data?.error ||
          err?.message ||
          'Gagal login demo. Pastikan server backend sedang aktif.'
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Left Card: Login Form */}
        <div className="glass-panel rounded-2xl p-8 flex flex-col justify-between border border-slate-800 shadow-2xl">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/logo.png"
                alt="SJS-VIPO Logo"
                className="h-12 w-12 rounded-xl object-contain border border-cyan-500/30 bg-slate-900 shadow-md p-1"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Logistic<span className="text-cyan-400">Qu</span>
                </h1>
                <p className="text-xs text-slate-400">Digital Warehouse & Stock Control</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-200">Masuk ke Sistem</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Silakan masukkan kredensial atau pilih akun demo di panel samping.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="Masukkan username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-400 focus:outline-none transition-colors"
                    tabIndex={-1}
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Masuk Sekarang'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Target: Mining Site SJS-VIPO</span>
            <span>v1.0.0 Enterprise</span>
          </div>
        </div>

        {/* Right Card: Quick Demo Roles */}
        <div className="glass-panel rounded-2xl p-8 flex flex-col justify-between border border-slate-800 shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Akun Demo Cepat (1-Klik)</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Klik salah satu peran di bawah untuk login langsung menguji alur kerja spesifik:
            </p>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickLogin(acc.username)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/60 transition-all group flex items-start justify-between disabled:opacity-50"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                        {acc.role}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${acc.tagClass}`}>
                        {acc.category}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">@{acc.username}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{acc.desc}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 shrink-0 mt-0.5 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300">
            💡 Semua akun demo menggunakan password default: <code className="font-mono bg-cyan-900/40 px-1 py-0.5 rounded">password123</code>
          </div>
        </div>
      </div>
    </div>
  );
};
