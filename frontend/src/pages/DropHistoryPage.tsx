import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dropApi } from '../api';
import type { MainDrop } from '../types';
import { getUserFleetCategory, isWarehouseInCategory } from '../utils/fleetCategory';
import {
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  Eye,
  Building2,
  PackageCheck,
  FileText,
} from 'lucide-react';

export const DropHistoryPage: React.FC = () => {
  const { currentWarehouse, user } = useAuth();
  const userDivision = getUserFleetCategory(user);
  const [drops, setDrops] = useState<MainDrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [dropDetail, setDropDetail] = useState<{ drop: MainDrop; items: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterWh, setFilterWh] = useState('');

  const loadDrops = async () => {
    try {
      setLoading(true);
      const whId = filterWh || (currentWarehouse?.warehouse_type === 'CONTAINER' ? currentWarehouse.id : '');
      const data = await dropApi.listDrops(whId || undefined);
      setDrops(data.filter((d) => isWarehouseInCategory(d.container_warehouse_id, undefined, userDivision)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrops();
  }, [currentWarehouse, filterWh]);

  const openDetail = async (id: string) => {
    try {
      setSelectedDropId(id);
      setDetailLoading(true);
      const data = await dropApi.getDropDetail(id);
      setDropDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const completedCount = drops.filter((d) => d.status === 'COMPLETED').length;
  const inTransitCount = drops.filter((d) => d.status === 'IN_TRANSIT').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Truck className="w-7 h-7 text-cyan-400" />
            Riwayat Drop & Suplai Gudang Utama
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Pencatatan akumulasi stok suku cadang yang telah di-drop / disuplai dari Gudang Utama ke Gudang Kontainer.
          </p>
        </div>

        <button
          onClick={loadDrops}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Segarkan Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-400">Total Pengiriman Drop</div>
            <div className="text-2xl font-bold text-white mt-1">{drops.length} Dokumen</div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-400">Dalam Perjalanan (In-Transit)</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">{inTransitCount} Dokumen</div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-semibold text-slate-400">Selesai Diterima di Kontainer</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{completedCount} Dokumen</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select
            value={filterWh}
            onChange={(e) => setFilterWh(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">
              {userDivision === 'DT'
                ? 'Gudang Kontainer Dump Truck (WH-CONT-DT)'
                : userDivision === 'HE'
                ? 'Gudang Kontainer Alat Berat (WH-CONT-HE)'
                : 'Semua Gudang Kontainer'}
            </option>
            {userDivision !== 'DT' && (
              <option value="WH-CONT-HE">WH-CONT-HE (Kontainer Heavy Equipment)</option>
            )}
            {userDivision !== 'HE' && (
              <option value="WH-CONT-DT">WH-CONT-DT (Kontainer Dump Truck)</option>
            )}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">No. Dokumen STO</th>
                <th className="px-5 py-3.5">Gudang Asal</th>
                <th className="px-5 py-3.5">Gudang Tujuan</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Waktu Pengiriman</th>
                <th className="px-5 py-3.5">Waktu Diterima</th>
                <th className="px-5 py-3.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Memuat riwayat drop suplai...
                  </td>
                </tr>
              ) : drops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Belum ada riwayat drop suplai untuk filter ini
                  </td>
                </tr>
              ) : (
                drops.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-mono font-semibold text-cyan-400">
                      {d.drop_number}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-300">{d.main_warehouse_id}</td>
                    <td className="px-5 py-4 font-medium text-slate-200">
                      {d.container_warehouse_id}
                    </td>
                    <td className="px-5 py-4">
                      {d.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Diterima
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          <Truck className="w-3 h-3" /> In-Transit
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {new Date(d.shipped_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {d.received_at ? new Date(d.received_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openDetail(d.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700 inline-flex items-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Lihat Isi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedDropId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-2xl w-full max-h-[85vh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {dropDetail?.drop.drop_number || 'Memuat...'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDropId(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-300">
              {detailLoading ? (
                <div className="py-10 text-center text-slate-400">Memuat rincian suplai...</div>
              ) : dropDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <span className="text-slate-500">Asal:</span>{' '}
                      <strong className="text-slate-200">{dropDetail.drop.main_warehouse_id}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Tujuan:</span>{' '}
                      <strong className="text-slate-200">{dropDetail.drop.container_warehouse_id}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Catatan:</span>{' '}
                      <span className="text-slate-300">{dropDetail.drop.notes || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Status:</span>{' '}
                      <span className="font-semibold text-cyan-400">{dropDetail.drop.status}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase font-semibold text-slate-400 mb-2 tracking-wider">
                      Item Suku Cadang yang Di-drop
                    </h4>
                    <div className="rounded-xl overflow-hidden border border-slate-800">
                      <table className="w-full text-left">
                        <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-2.5">Part Number & Nama</th>
                            <th className="px-4 py-2.5 text-right">Jumlah Di-drop</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                          {dropDetail.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-200">{item.part_name}</div>
                                <div className="font-mono text-cyan-400 text-[11px]">{item.spare_part_id}</div>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-cyan-400">
                                {item.qty} {item.unit_of_measure}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
              <button
                onClick={() => setSelectedDropId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
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
