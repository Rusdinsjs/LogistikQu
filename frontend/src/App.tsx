import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Sidebar, isTabAccessible, type TabId } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { WarehouseBinsPage } from './pages/WarehouseBinsPage';
import { PosIssuePage } from './pages/PosIssuePage';
import { ReplenishmentPage } from './pages/ReplenishmentPage';
import { DropHistoryPage } from './pages/DropHistoryPage';
import { AdjustmentPage } from './pages/AdjustmentPage';
import { MasterPage } from './pages/MasterPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { UsedPartReturnsPage } from './pages/UsedPartReturnsPage';
import { MechanicRequestsPage } from './pages/MechanicRequestsPage';
import { ShieldAlert } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');

  // Sidebar toggle state (remembered via localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('logisticqu_sidebar_collapsed') === 'true';
  });

  const [isDesktopOpen, setIsDesktopOpen] = useState<boolean>(() => {
    return localStorage.getItem('logisticqu_sidebar_open') !== 'false';
  });

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Shortcut key: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setIsMobileOpen((prev) => !prev);
        } else {
          if (!isDesktopOpen) {
            setIsDesktopOpen(true);
            localStorage.setItem('logisticqu_sidebar_open', 'true');
          } else {
            setIsCollapsed((prev) => {
              const next = !prev;
              localStorage.setItem('logisticqu_sidebar_collapsed', String(next));
              return next;
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktopOpen]);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      if (!isDesktopOpen) {
        setIsDesktopOpen(true);
        localStorage.setItem('logisticqu_sidebar_open', 'true');
      } else {
        setIsCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('logisticqu_sidebar_collapsed', String(next));
          return next;
        });
      }
    }
  };

  useEffect(() => {
    if (user) {
      if (user.role_id === 'MECHANIC' && currentTab === 'dashboard') {
        setCurrentTab('mechanic-requests');
      } else if (!isTabAccessible(currentTab, user.permissions, user.role_id)) {
        setCurrentTab(user.role_id === 'MECHANIC' ? 'mechanic-requests' : 'dashboard');
      }
    }
  }, [currentTab, user]);

  useEffect(() => {
    const handleGlobalNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: TabId }>;
      if (customEvent.detail?.tab) {
        setCurrentTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('logisticqu:navigate', handleGlobalNav);
    return () => window.removeEventListener('logisticqu:navigate', handleGlobalNav);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
        <div className="font-semibold text-sm tracking-wide text-cyan-400">Memuat LogisticQu WMS...</div>
        <div className="text-xs text-slate-500 mt-1">Sistem Manajemen Pergudangan SJS-VIPO</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isCurrentTabAllowed = isTabAccessible(currentTab, user.permissions, user.role_id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 app-viewport-root">
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={handleToggleSidebar}
        isSidebarCollapsed={isCollapsed}
        isSidebarOpen={isDesktopOpen}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 md:hidden transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setIsMobileOpen(false);
          }}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            setIsCollapsed((prev) => {
              const next = !prev;
              localStorage.setItem('logisticqu_sidebar_collapsed', String(next));
              return next;
            });
          }}
          isDesktopOpen={isDesktopOpen}
          onCloseDesktop={() => {
            setIsDesktopOpen(false);
            localStorage.setItem('logisticqu_sidebar_open', 'false');
          }}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 main-viewport-content">
          <div className="max-w-7xl mx-auto">
            {!isCurrentTabAllowed ? (
              <div className="glass-panel rounded-2xl p-8 border border-red-500/30 text-center max-w-lg mx-auto mt-16 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 shadow-lg shadow-red-500/10">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Akses Menu Ditolak</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Akun Anda tidak memiliki izin untuk mengakses menu ini. Silakan hubungi Superadmin sistem untuk penyesuaian hak akses.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg border border-slate-700 transition-all"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            ) : (
              <>
                {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
                {currentTab === 'inventory' && <InventoryPage />}
                {currentTab === 'bins' && <WarehouseBinsPage />}
                {currentTab === 'mechanic-requests' && <MechanicRequestsPage />}
                {currentTab === 'pos' && <PosIssuePage />}
                {currentTab === 'returns' && <UsedPartReturnsPage />}
                {currentTab === 'replenishment' && <ReplenishmentPage />}
                {currentTab === 'drops' && <DropHistoryPage />}
                {currentTab === 'adjustment' && <AdjustmentPage />}
                {currentTab === 'master' && <MasterPage />}
                {currentTab === 'reports' && <ReportsPage />}
                {currentTab === 'audit' && <AuditPage />}
                {currentTab === 'users' && <UsersPage />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
