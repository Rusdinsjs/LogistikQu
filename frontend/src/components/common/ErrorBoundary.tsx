import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="glass-panel rounded-2xl p-8 border border-rose-900/40 text-center max-w-lg mx-auto my-12 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Terjadi Kendala Tampilan</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Komponen mengalami gangguan saat merender data. Silakan coba muat ulang halaman atau periksa koneksi.
            </p>
            {this.state.error && (
              <pre className="mt-3 p-3 bg-slate-900/80 rounded text-[11px] font-mono text-rose-300 text-left overflow-x-auto border border-slate-800">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
