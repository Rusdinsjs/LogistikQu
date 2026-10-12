import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { useTheme } from './ThemeContext';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
  prompt: (options: string | PromptOptions) => Promise<string | null>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Deteksi otomatis tipe notifikasi berdasarkan isi pesan Bahasa Indonesia
 */
export function inferToastVariant(message: string): { variant: ToastVariant; title: string } {
  const lower = message.toLowerCase();

  if (
    /gagal|error|kesalahan|ditolak|tidak valid|forbidden|unauthorized|expired|tidak ditemukan/.test(
      lower
    )
  ) {
    return { variant: 'error', title: 'Gagal Memproses' };
  }

  if (
    /wajib|mohon|pilih minimal|tambahkan minimal|melebihi|habis|diblokir|maksimal|kosong|sudah ada|belum dipilih|tidak ada|sop wajib|harap|perhatian/.test(
      lower
    )
  ) {
    return { variant: 'warning', title: 'Perhatian' };
  }

  if (
    /berhasil|disimpan|diperbarui|disetujui|dihapus|didaftarkan|diterbitkan|diterima|dikirim|dipindahkan|selesai|terverifikasi|diverifikasi/.test(
      lower
    )
  ) {
    return { variant: 'success', title: 'Berhasil' };
  }

  return { variant: 'info', title: 'Informasi Sistem' };
}

// Global imperative bridge so window.alert and utility files work seamlessly
let globalShowToast:
  | ((message: string, variant?: ToastVariant, title?: string, duration?: number) => void)
  | null = null;
let globalConfirm: ((options: string | ConfirmOptions) => Promise<boolean>) | null = null;
let globalPrompt: ((options: string | PromptOptions) => Promise<string | null>) | null = null;

export const toast = {
  show: (message: string, variant?: ToastVariant, title?: string, duration?: number) => {
    globalShowToast?.(message, variant, title, duration);
  },
  success: (message: string, title = 'Berhasil') => {
    globalShowToast?.(message, 'success', title);
  },
  error: (message: string, title = 'Gagal Memproses') => {
    globalShowToast?.(message, 'error', title);
  },
  warning: (message: string, title = 'Perhatian') => {
    globalShowToast?.(message, 'warning', title);
  },
  info: (message: string, title = 'Informasi Sistem') => {
    globalShowToast?.(message, 'info', title);
  },
};

export const confirmDialog = (options: string | ConfirmOptions): Promise<boolean> => {
  if (globalConfirm) {
    return globalConfirm(options);
  }
  const msg = typeof options === 'string' ? options : options.message;
  return Promise.resolve(window.confirm(msg));
};

export const promptDialog = (options: string | PromptOptions): Promise<string | null> => {
  if (globalPrompt) {
    return globalPrompt(options);
  }
  const msg = typeof options === 'string' ? options : options.message;
  return Promise.resolve(window.prompt(msg));
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Active Confirm Dialog state
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Active Prompt Dialog state
  const [promptState, setPromptState] = useState<{
    options: PromptOptions;
    value: string;
    resolve: (val: string | null) => void;
  } | null>(null);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant?: ToastVariant, customTitle?: string, duration = 4200) => {
      const cleanMessage = String(message ?? '').trim();
      if (!cleanMessage) return;

      const inferred = inferToastVariant(cleanMessage);
      const finalVariant = variant || inferred.variant;
      const finalTitle = customTitle || inferred.title;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newItem: ToastItem = {
        id,
        title: finalTitle,
        message: cleanMessage,
        variant: finalVariant,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [newItem, ...prev].slice(0, 5));

      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const confirm = useCallback((options: string | ConfirmOptions): Promise<boolean> => {
    const normalized: ConfirmOptions =
      typeof options === 'string' ? { message: options } : options;

    const lower = normalized.message.toLowerCase();
    const defaultVariant: ConfirmOptions['variant'] =
      normalized.variant ||
      (/hapus|nonaktifkan|cabut|tolak|kosongkan/.test(lower)
        ? 'danger'
        : /setujui|terima|aktifkan/.test(lower)
          ? 'success'
          : 'warning');

    const defaultTitle =
      normalized.title ||
      (defaultVariant === 'danger'
        ? 'Konfirmasi Tindakan'
        : defaultVariant === 'success'
          ? 'Konfirmasi Persetujuan'
          : 'Konfirmasi Sistem');

    return new Promise<boolean>((resolve) => {
      setConfirmState({
        options: {
          ...normalized,
          title: defaultTitle,
          variant: defaultVariant,
          confirmText:
            normalized.confirmText ||
            (defaultVariant === 'danger' ? 'Ya, Lanjutkan' : 'Ya, Konfirmasi'),
          cancelText: normalized.cancelText || 'Batal',
        },
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: string | PromptOptions): Promise<string | null> => {
    const normalized: PromptOptions =
      typeof options === 'string' ? { message: options } : options;

    return new Promise<string | null>((resolve) => {
      setPromptState({
        options: {
          ...normalized,
          title: normalized.title || 'Input Keterangan Wajib',
          placeholder: normalized.placeholder || 'Ketik alasan atau catatan di sini...',
          confirmText: normalized.confirmText || 'Kirim',
          cancelText: normalized.cancelText || 'Batal',
        },
        value: normalized.defaultValue || '',
        resolve,
      });
    });
  }, []);

  // Register global bridge and override native window.alert
  useEffect(() => {
    globalShowToast = showToast;
    globalConfirm = confirm;
    globalPrompt = prompt;

    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      showToast(String(message ?? ''));
    };

    return () => {
      window.alert = originalAlert;
      globalShowToast = null;
      globalConfirm = null;
      globalPrompt = null;
    };
  }, [showToast, confirm, prompt]);

  // Keyboard support for Confirm/Prompt modals
  useEffect(() => {
    if (!confirmState && !promptState) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmState) {
          confirmState.resolve(false);
          setConfirmState(null);
        }
        if (promptState) {
          promptState.resolve(null);
          setPromptState(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState, promptState]);

  /**
   * Konfigurasi warna eksplisit (menggunakan inline style untuk kontras teks & background)
   * agar tidak terpengaruh inversi variabel --color-slate-* pada index.css di Light Mode.
   */
  const getVariantConfig = (variant: ToastVariant) => {
    switch (variant) {
      case 'success':
        return {
          icon: CheckCircle2,
          accentBar: 'linear-gradient(to bottom, #10b981, #06b6d4)',
          progressBarColor: isLight ? '#059669' : '#34d399',
          cardInlineStyle: isLight
            ? {
                backgroundColor: '#ffffff',
                borderColor: '#6ee7b7',
                boxShadow:
                  '0 14px 30px -6px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(16, 185, 129, 0.15)',
              }
            : {
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
                boxShadow:
                  '0 20px 35px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(16, 185, 129, 0.25)',
              },
          iconBoxStyle: isLight
            ? {
                backgroundColor: '#ecfdf5',
                borderColor: '#a7f3d0',
                color: '#059669',
              }
            : {
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#34d399',
              },
          titleColor: isLight ? '#065f46' : '#6ee7b7',
          messageColor: isLight ? '#0f172a' : '#f1f5f9',
          badgeText: 'SUKSES',
          badgeStyle: isLight
            ? {
                backgroundColor: '#d1fae5',
                borderColor: '#6ee7b7',
                color: '#065f46',
              }
            : {
                backgroundColor: 'rgba(16, 185, 129, 0.18)',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7',
              },
        };
      case 'error':
        return {
          icon: XCircle,
          accentBar: 'linear-gradient(to bottom, #f43f5e, #dc2626)',
          progressBarColor: isLight ? '#e11d48' : '#fb7185',
          cardInlineStyle: isLight
            ? {
                backgroundColor: '#ffffff',
                borderColor: '#fda4af',
                boxShadow:
                  '0 14px 30px -6px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(244, 63, 94, 0.15)',
              }
            : {
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(244, 63, 94, 0.45)',
                boxShadow:
                  '0 20px 35px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(244, 63, 94, 0.25)',
              },
          iconBoxStyle: isLight
            ? {
                backgroundColor: '#fff1f2',
                borderColor: '#fecdd3',
                color: '#e11d48',
              }
            : {
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                borderColor: 'rgba(244, 63, 94, 0.35)',
                color: '#fb7185',
              },
          titleColor: isLight ? '#9f1239' : '#fda4af',
          messageColor: isLight ? '#0f172a' : '#f1f5f9',
          badgeText: 'ERROR',
          badgeStyle: isLight
            ? {
                backgroundColor: '#ffe4e6',
                borderColor: '#fda4af',
                color: '#9f1239',
              }
            : {
                backgroundColor: 'rgba(244, 63, 94, 0.18)',
                borderColor: 'rgba(244, 63, 94, 0.4)',
                color: '#fda4af',
              },
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          accentBar: 'linear-gradient(to bottom, #f59e0b, #ea580c)',
          progressBarColor: isLight ? '#d97706' : '#fbbf24',
          cardInlineStyle: isLight
            ? {
                backgroundColor: '#ffffff',
                borderColor: '#fcd34d',
                boxShadow:
                  '0 14px 30px -6px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(245, 158, 11, 0.15)',
              }
            : {
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(245, 158, 11, 0.45)',
                boxShadow:
                  '0 20px 35px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(245, 158, 11, 0.25)',
              },
          iconBoxStyle: isLight
            ? {
                backgroundColor: '#fffbeb',
                borderColor: '#fde68a',
                color: '#d97706',
              }
            : {
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
                color: '#fbbf24',
              },
          titleColor: isLight ? '#92400e' : '#fcd34d',
          messageColor: isLight ? '#0f172a' : '#f1f5f9',
          badgeText: 'PERHATIAN',
          badgeStyle: isLight
            ? {
                backgroundColor: '#fef3c7',
                borderColor: '#fcd34d',
                color: '#92400e',
              }
            : {
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                color: '#fcd34d',
              },
        };
      case 'info':
      default:
        return {
          icon: Info,
          accentBar: 'linear-gradient(to bottom, #06b6d4, #2563eb)',
          progressBarColor: isLight ? '#0891b2' : '#22d3ee',
          cardInlineStyle: isLight
            ? {
                backgroundColor: '#ffffff',
                borderColor: '#67e8f9',
                boxShadow:
                  '0 14px 30px -6px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(6, 182, 212, 0.15)',
              }
            : {
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(6, 182, 212, 0.45)',
                boxShadow:
                  '0 20px 35px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(6, 182, 212, 0.25)',
              },
          iconBoxStyle: isLight
            ? {
                backgroundColor: '#ecfeff',
                borderColor: '#a5f3fc',
                color: '#0891b2',
              }
            : {
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                borderColor: 'rgba(6, 182, 212, 0.35)',
                color: '#22d3ee',
              },
          titleColor: isLight ? '#155e75' : '#67e8f9',
          messageColor: isLight ? '#0f172a' : '#f1f5f9',
          badgeText: 'INFO',
          badgeStyle: isLight
            ? {
                backgroundColor: '#cffafe',
                borderColor: '#67e8f9',
                color: '#155e75',
              }
            : {
                backgroundColor: 'rgba(6, 182, 212, 0.18)',
                borderColor: 'rgba(6, 182, 212, 0.4)',
                color: '#67e8f9',
              },
        };
    }
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        success: (msg, title) => showToast(msg, 'success', title),
        error: (msg, title) => showToast(msg, 'error', title),
        warning: (msg, title) => showToast(msg, 'warning', title),
        info: (msg, title) => showToast(msg, 'info', title),
        confirm,
        prompt,
      }}
    >
      {children}

      {/* FLOATING TOAST NOTIFICATIONS (TOP-RIGHT) */}
      <div
        className="fixed top-20 right-4 md:right-6 z-[9999] flex flex-col gap-3 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none no-print"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const cfg = getVariantConfig(t.variant);
          const IconComponent = cfg.icon;

          return (
            <div
              key={t.id}
              style={cfg.cardInlineStyle}
              className="pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-toast-slide-in"
              role="alert"
            >
              {/* Left Gradient Accent Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ background: cfg.accentBar }}
              />

              <div className="p-4 pl-5 flex items-start gap-3.5">
                {/* Status Icon */}
                <div
                  style={cfg.iconBoxStyle}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5"
                >
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        style={{ color: cfg.titleColor }}
                        className="text-xs font-bold tracking-wide"
                      >
                        {t.title}
                      </span>
                      <span
                        style={cfg.badgeStyle}
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border tracking-wider"
                      >
                        {cfg.badgeText}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeToast(t.id)}
                      style={{ color: isLight ? '#475569' : '#94a3b8' }}
                      className="p-1 rounded-lg transition-colors hover:opacity-80"
                      title="Tutup notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p
                    style={{ color: cfg.messageColor }}
                    className="text-xs font-medium leading-relaxed break-words whitespace-pre-line"
                  >
                    {t.message}
                  </p>
                </div>
              </div>

              {/* Animated Countdown Progress Bar */}
              <div
                style={{ backgroundColor: isLight ? '#e2e8f0' : '#1e293b' }}
                className="h-1 w-full overflow-hidden"
              >
                <div
                  style={{
                    backgroundColor: cfg.progressBarColor,
                    animationDuration: `${t.duration}ms`,
                  }}
                  className="h-full animate-toast-progress"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* THEMED CONFIRMATION DIALOG MODAL */}
      {confirmState && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in no-print">
          <div
            style={
              isLight
                ? {
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                  }
                : {
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    borderColor: 'rgba(71, 85, 105, 0.7)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  }
            }
            className="w-full max-w-md rounded-2xl border overflow-hidden transition-all"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  style={
                    confirmState.options.variant === 'danger'
                      ? isLight
                        ? { backgroundColor: '#fff1f2', borderColor: '#fecdd3', color: '#e11d48' }
                        : {
                            backgroundColor: 'rgba(244, 63, 94, 0.15)',
                            borderColor: 'rgba(244, 63, 94, 0.35)',
                            color: '#fb7185',
                          }
                      : confirmState.options.variant === 'success'
                        ? isLight
                          ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' }
                          : {
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              borderColor: 'rgba(16, 185, 129, 0.35)',
                              color: '#34d399',
                            }
                        : isLight
                          ? { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#d97706' }
                          : {
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderColor: 'rgba(245, 158, 11, 0.35)',
                              color: '#fbbf24',
                            }
                  }
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0"
                >
                  {confirmState.options.variant === 'danger' ? (
                    <Trash2 className="w-6 h-6" />
                  ) : confirmState.options.variant === 'success' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <HelpCircle className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    style={{ color: isLight ? '#0f172a' : '#f8fafc' }}
                    className="text-base font-bold"
                  >
                    {confirmState.options.title}
                  </h3>
                  <p
                    style={{ color: isLight ? '#334155' : '#cbd5e1' }}
                    className="text-xs font-medium mt-1.5 leading-relaxed whitespace-pre-line"
                  >
                    {confirmState.options.message}
                  </p>
                </div>
              </div>

              <div
                style={{ borderColor: isLight ? '#e2e8f0' : 'rgba(51, 65, 85, 0.6)' }}
                className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t"
              >
                <button
                  type="button"
                  onClick={() => {
                    confirmState.resolve(false);
                    setConfirmState(null);
                  }}
                  style={
                    isLight
                      ? {
                          backgroundColor: '#f8fafc',
                          borderColor: '#cbd5e1',
                          color: '#334155',
                        }
                      : {
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          color: '#e2e8f0',
                        }
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-90"
                >
                  {confirmState.options.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmState.resolve(true);
                    setConfirmState(null);
                  }}
                  style={{
                    backgroundColor:
                      confirmState.options.variant === 'danger'
                        ? '#e11d48'
                        : confirmState.options.variant === 'success'
                          ? '#059669'
                          : '#0891b2',
                    color: '#ffffff',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg hover:opacity-95"
                >
                  {confirmState.options.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THEMED PROMPT DIALOG MODAL */}
      {promptState && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in no-print">
          <div
            style={
              isLight
                ? {
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
                  }
                : {
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    borderColor: 'rgba(71, 85, 105, 0.7)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  }
            }
            className="w-full max-w-md rounded-2xl border overflow-hidden transition-all"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                promptState.resolve(promptState.value);
                setPromptState(null);
              }}
              className="p-6"
            >
              <div className="flex items-start gap-3.5 mb-4">
                <div
                  style={
                    isLight
                      ? { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#d97706' }
                      : {
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          borderColor: 'rgba(245, 158, 11, 0.35)',
                          color: '#fbbf24',
                        }
                  }
                  className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3
                    style={{ color: isLight ? '#0f172a' : '#f8fafc' }}
                    className="text-sm font-bold"
                  >
                    {promptState.options.title}
                  </h3>
                  <p
                    style={{ color: isLight ? '#334155' : '#cbd5e1' }}
                    className="text-xs font-medium mt-1 leading-relaxed"
                  >
                    {promptState.options.message}
                  </p>
                </div>
              </div>

              <textarea
                rows={3}
                autoFocus
                value={promptState.value}
                onChange={(e) =>
                  setPromptState((prev) => (prev ? { ...prev, value: e.target.value } : null))
                }
                placeholder={promptState.options.placeholder}
                style={
                  isLight
                    ? {
                        backgroundColor: '#f8fafc',
                        borderColor: '#cbd5e1',
                        color: '#0f172a',
                      }
                    : {
                        backgroundColor: '#020617',
                        borderColor: '#334155',
                        color: '#f1f5f9',
                      }
                }
                className="w-full rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none focus:border-cyan-500"
              />

              <div
                style={{ borderColor: isLight ? '#e2e8f0' : 'rgba(51, 65, 85, 0.6)' }}
                className="flex items-center justify-end gap-2.5 mt-5 pt-4 border-t"
              >
                <button
                  type="button"
                  onClick={() => {
                    promptState.resolve(null);
                    setPromptState(null);
                  }}
                  style={
                    isLight
                      ? {
                          backgroundColor: '#f8fafc',
                          borderColor: '#cbd5e1',
                          color: '#334155',
                        }
                      : {
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          color: '#e2e8f0',
                        }
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:opacity-90"
                >
                  {promptState.options.cancelText}
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#e11d48', color: '#ffffff' }}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg hover:opacity-95"
                >
                  {promptState.options.confirmText}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
