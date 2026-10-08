import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, type TabId } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { PosIssuePage } from './pages/PosIssuePage';
import { ReplenishmentPage } from './pages/ReplenishmentPage';
import { DropHistoryPage } from './pages/DropHistoryPage';
import { AdjustmentPage } from './pages/AdjustmentPage';
import { MasterPage } from './pages/MasterPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
        <div className="font-semibold text-sm tracking-wide text-cyan-400">Memuat LogisticQu WMS...</div>
        <div className="text-xs text-slate-500 mt-1">Sistem Manajemen Pergudangan PT Vale</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
            {currentTab === 'inventory' && <InventoryPage />}
            {currentTab === 'pos' && <PosIssuePage />}
            {currentTab === 'replenishment' && <ReplenishmentPage />}
            {currentTab === 'drops' && <DropHistoryPage />}
            {currentTab === 'adjustment' && <AdjustmentPage />}
            {currentTab === 'master' && <MasterPage />}
            {currentTab === 'reports' && <ReportsPage />}
            {currentTab === 'audit' && <AuditPage />}
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
