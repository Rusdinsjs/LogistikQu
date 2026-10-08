import React, { useEffect, useState } from 'react';
import { auditApi } from '../api';
import type { AuditLog } from '../types';
import {
  ShieldAlert,
  RotateCcw,
  Search,
  Eye,
  FileCode2,
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await auditApi.listAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      (l.username && l.username.toLowerCase().includes(q)) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-cyan-400" />
            Audit Trail & Log Aktivitas Sistem
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rekam jejak tidak dapat diubah (immutable audit log) atas seluruh perubahan data dan transaksi suku cadang.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Segarkan
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 rounded-xl flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari aksi (LOGIN, ISSUE, REPLENISHMENT), user, atau entitas..."
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white">
            Hapus
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Waktu Transaksi</th>
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-5 py-3.5">Aksi (Action)</th>
                <th className="px-5 py-3.5">Entitas Terkait</th>
                <th className="px-5 py-3.5">ID Dokumen / Reff</th>
                <th className="px-5 py-3.5 text-right">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Memuat catatan audit log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Belum ada rekaman log
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-200">
                      {log.username || 'System'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 font-mono text-xs font-bold text-cyan-300 border border-slate-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-medium text-xs">{log.entity}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">
                      {log.entity_id || '-'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {(log.old_values || log.new_values) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700 inline-flex items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Lihat JSON
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-6 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-cyan-400" />
                Snapshot Data Audit ({selectedLog.action} pada {selectedLog.entity})
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 flex-1 overflow-y-auto text-xs">
              {selectedLog.old_values && (
                <div>
                  <h4 className="font-semibold text-rose-400 mb-1">Old Values (Sebelum Perubahan):</h4>
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto font-mono text-[11px]">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <h4 className="font-semibold text-emerald-400 mb-1">New Values (Setelah Perubahan):</h4>
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto font-mono text-[11px]">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
