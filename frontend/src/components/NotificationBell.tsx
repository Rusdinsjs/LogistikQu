import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Zap,
  XCircle,
  Inbox,
  Mail,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { notificationApi } from '../api';
import type { NotificationItem } from '../types';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'LOW_STOCK' | 'APPROVAL'>('ALL');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied';
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Synthesize dual-tone audio chime via Web Audio API (100% reliable, no assets needed)
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.28); // D6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start(ctx.currentTime + 0.12);
      osc1.stop(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay restrictions before user gesture
    }
  };

  const requestDesktopPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.warn('Gagal meminta izin notifikasi desktop', err);
      }
    }
  };

  const showDesktopNotification = (title: string, body: string, onClick?: () => void) => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const n = new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
        n.onclick = () => {
          window.focus();
          onClick?.();
          n.close();
        };
      } catch (err) {
        console.warn('Gagal menampilkan desktop notification', err);
      }
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      handleMarkAsRead(item.id);
    }
    setIsOpen(false);

    // Deep linking dispatching
    if (
      item.trigger_type === 'APPROVAL_REQUEST' ||
      item.trigger_type === 'APPROVAL_COMPLETED' ||
      item.trigger_type === 'REJECTED_TRANSACTION' ||
      item.reference_id?.startsWith('REQ-') ||
      item.reference_id?.startsWith('DROP-')
    ) {
      window.dispatchEvent(
        new CustomEvent('logisticqu:navigate', { detail: { tab: 'replenishment' } })
      );
      if (item.reference_id) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('logisticqu:open-replenishment', {
              detail: { requestId: item.reference_id },
            })
          );
        }, 150);
      }
    } else if (item.trigger_type === 'LOW_STOCK') {
      window.dispatchEvent(
        new CustomEvent('logisticqu:navigate', { detail: { tab: 'replenishment' } })
      );
    } else if (item.trigger_type === 'ABNORMAL_CONSUMPTION') {
      window.dispatchEvent(
        new CustomEvent('logisticqu:navigate', { detail: { tab: 'pos' } })
      );
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const data = await notificationApi.getUnreadCount();
      const prev = prevCountRef.current;
      setUnreadCount(data.unread_count);
      prevCountRef.current = data.unread_count;

      if (!isInitialLoadRef.current && data.unread_count > prev) {
        // Sound chime for real-time notification
        playChime();

        // Trigger desktop browser alert
        try {
          const latest = await notificationApi.getNotifications({ limit: 1 });
          if (latest.length > 0 && !latest[0].is_read) {
            showDesktopNotification(latest[0].title, latest[0].message, () => {
              handleNotificationClick(latest[0]);
            });
          }
        } catch {
          // ignore
        }
      }

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.warn('Gagal memuat jumlah notifikasi', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const list = await notificationApi.getNotifications({ limit: 40 });
      setNotifications(list);
    } catch (err) {
      console.warn('Gagal memuat daftar notifikasi', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    // Poll unread count every 15s for responsive operational coordination
    const interval = setInterval(fetchUnreadCount, 15000);
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    } catch (err) {
      console.error('Gagal menandai notifikasi dibaca', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      prevCountRef.current = 0;
    } catch (err) {
      console.error('Gagal menandai semua dibaca', err);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'UNREAD') return !item.is_read;
    if (filter === 'LOW_STOCK') return item.trigger_type === 'LOW_STOCK';
    if (filter === 'APPROVAL') {
      return (
        item.trigger_type === 'APPROVAL_REQUEST' ||
        item.trigger_type === 'APPROVAL_COMPLETED' ||
        item.trigger_type === 'REJECTED_TRANSACTION'
      );
    }
    return true;
  });

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'APPROVAL_REQUEST':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'APPROVAL_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'ABNORMAL_CONSUMPTION':
        return <Zap className="w-4 h-4 text-purple-400" />;
      case 'REJECTED_TRANSACTION':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL':
        return (
          <span title="Email">
            <Mail className="w-3 h-3 text-sky-400" />
          </span>
        );
      case 'WHATSAPP':
        return (
          <span title="WhatsApp API">
            <Smartphone className="w-3 h-3 text-emerald-400" />
          </span>
        );
      default:
        return (
          <span title="In-App">
            <Bell className="w-3 h-3 text-slate-400" />
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (notificationPermission === 'default') {
            requestDesktopPermission();
          }
        }}
        aria-label="Notifikasi Sistem"
        className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-all shadow-sm"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md shadow-rose-500/30 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/60 z-50 overflow-hidden flex flex-col max-h-[540px] animate-in fade-in duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-white">Notifikasi Operasional</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={playChime}
                title="Tes Bunyi Notifikasi"
                className="text-slate-400 hover:text-cyan-400 transition"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Baca Semua</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Permission Banner if not enabled */}
          {notificationPermission === 'default' && (
            <div className="px-3.5 py-2 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-cyan-200">Aktifkan pop-up desktop browser:</span>
              <button
                onClick={requestDesktopPermission}
                className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-[10px]"
              >
                Izinkan
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-3 py-2 bg-slate-950/50 border-b border-slate-800/80 overflow-x-auto text-[11px]">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'UNREAD'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Belum Dibaca
            </button>
            <button
              onClick={() => setFilter('LOW_STOCK')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'LOW_STOCK'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stok Kritis
            </button>
            <button
              onClick={() => setFilter('APPROVAL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filter === 'APPROVAL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Approval
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                Memuat notifikasi...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Tidak ada notifikasi pada kategori ini.</p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-800/50 flex items-start gap-3 ${
                    !item.is_read ? 'bg-cyan-950/20 border-l-2 border-cyan-400' : 'opacity-80'
                  }`}
                >
                  {/* Trigger Icon */}
                  <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                    {getTriggerIcon(item.trigger_type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300/90 leading-relaxed mb-2 line-clamp-3">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        {getChannelIcon(item.channel)}
                        <span className="uppercase text-[9px] font-mono">{item.channel}</span>
                        {item.reference_id && (
                          <span className="font-mono text-cyan-400/80">#{item.reference_id}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-cyan-400 font-medium hover:underline">
                          Buka Detail &rarr;
                        </span>
                        {!item.is_read && (
                          <button
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            title="Tandai sudah dibaca"
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 text-center text-[10px] text-slate-400 flex items-center justify-between px-3">
            <span>Sinkronisasi Otomatis Desktop & Mobile</span>
            <span className="text-slate-500">Interval 15s</span>
          </div>
        </div>
      )}
    </div>
  );
};
