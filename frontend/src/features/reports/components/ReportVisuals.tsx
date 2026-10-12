import React, { useState } from 'react';
import {
  TrendingUp,
  Boxes,
  Truck,
  Sparkles,
  Award,
  X,
} from 'lucide-react';

export const formatRupiah = (val?: number): string => {
  if (val === undefined || val === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatNumber = (val?: number): string => {
  if (val === undefined || val === null) return '0';
  return new Intl.NumberFormat('id-ID').format(val);
};

// --- KPI Card ---
interface ReportKpiCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  colorScheme: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky';
  badge?: string;
}

export const ReportKpiCard: React.FC<ReportKpiCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  colorScheme,
  badge,
}) => {
  const colorMap = {
    cyan: {
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-950/15',
      text: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/20 text-cyan-300',
      glow: 'shadow-cyan-500/5',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/15',
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 text-emerald-300',
      glow: 'shadow-emerald-500/5',
    },
    violet: {
      border: 'border-violet-500/30',
      bg: 'bg-violet-950/15',
      text: 'text-violet-400',
      badgeBg: 'bg-violet-500/20 text-violet-300',
      glow: 'shadow-violet-500/5',
    },
    amber: {
      border: 'border-amber-500/30',
      bg: 'bg-amber-950/15',
      text: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 text-amber-300',
      glow: 'shadow-amber-500/5',
    },
    rose: {
      border: 'border-rose-500/30',
      bg: 'bg-rose-950/15',
      text: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 text-rose-300',
      glow: 'shadow-rose-500/5',
    },
    sky: {
      border: 'border-sky-500/30',
      bg: 'bg-sky-950/15',
      text: 'text-sky-400',
      badgeBg: 'bg-sky-500/20 text-sky-300',
      glow: 'shadow-sky-500/5',
    },
  }[colorScheme];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${colorMap.border} ${colorMap.bg} p-4.5 backdrop-blur-md shadow-lg ${colorMap.glow} transition-all hover:scale-[1.01]`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400">{title}</span>
        <div className={`p-2 rounded-xl bg-slate-900/60 border border-slate-800 ${colorMap.text}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorMap.badgeBg}`}>
            {badge}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
};

// --- Horizontal Bar Chart ---
export interface BarItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  formattedValue?: string;
  color?: string;
  tag?: string;
}

interface HorizontalBarChartProps {
  title: string;
  subtitle?: string;
  items: BarItem[];
  maxDisplay?: number;
  emptyMessage?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  title,
  subtitle,
  items,
  maxDisplay = 8,
  emptyMessage = 'Tidak ada data untuk grafik.',
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const displayItems = items.slice(0, maxDisplay);
  const maxValue = Math.max(...displayItems.map((i) => i.value), 1);

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>{title}</span>
        </h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {displayItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item, idx) => {
            const percentage = Math.min(Math.round((item.value / maxValue) * 100), 100);
            const isHovered = hoveredId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`p-2 rounded-xl transition-all ${
                  isHovered ? 'bg-slate-800/60 ring-1 ring-cyan-500/30' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-5 text-[11px] font-mono text-slate-500 font-bold">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                        • {item.sublabel}
                      </span>
                    )}
                    {item.tag && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-cyan-300">
                      {item.formattedValue ?? formatNumber(item.value)}
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden relative">
                  <div
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color || '#06b6d4',
                    }}
                    className="h-full rounded-full transition-all duration-500 ease-out"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Donut Chart with Legend ---
export interface DonutItem {
  id: string;
  label: string;
  value: number;
  color: string;
  sublabel?: string;
  formattedValue?: string;
}

interface DonutChartProps {
  title: string;
  subtitle?: string;
  items: DonutItem[];
  centerLabel?: string;
  centerValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  title,
  subtitle,
  items,
  centerLabel,
  centerValue,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const total = items.reduce((acc, curr) => acc + curr.value, 0);

  // SVG Donut metrics
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Boxes className="w-4 h-4 text-cyan-400" />
          <span>{title}</span>
        </h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">Tidak ada data untuk komposisi.</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* SVG Ring */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-slate-800 fill-none"
                strokeWidth="12"
              />
              {items.map((item) => {
                const percent = item.value / total;
                const strokeDasharray = `${circumference * percent} ${circumference}`;
                const strokeDashoffset = -circumference * accumulatedPercent;
                accumulatedPercent += percent;

                const isHovered = hoveredId === item.id;

                return (
                  <circle
                    key={item.id}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={isHovered ? 14 : 12}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[10px] text-slate-400 font-medium">{centerLabel || 'Total'}</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5">
                {centerValue || formatNumber(total)}
              </span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="flex-1 w-full space-y-2">
            {items.map((item) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
              const isHovered = hoveredId === item.id;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                    isHovered ? 'bg-slate-800/80 ring-1 ring-slate-700' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 truncate">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-[10px] text-slate-400 truncate">{item.sublabel}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-mono font-bold text-white">
                      {item.formattedValue ?? formatNumber(item.value)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{percent}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Area / Trend Curve SVG Chart ---
export interface TrendPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface AreaTrendChartProps {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  valueFormatter?: (v: number) => string;
  primaryLegend?: string;
  secondaryLegend?: string;
}

export const AreaTrendChart: React.FC<AreaTrendChartProps> = ({
  title,
  subtitle,
  data,
  valueFormatter = formatNumber,
  primaryLegend = 'Volume / Qty',
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <div className="py-8 text-center text-xs text-slate-500">Tidak ada data tren berkala.</div>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 10);
  const minVal = 0;
  const height = 150;
  const width = 500;
  const paddingX = 40;
  const paddingY = 20;

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((d.value - minVal) / (maxVal - minVal)) * (height - 2 * paddingY);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${
    height - paddingY
  } Z`;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>{primaryLegend}</span>
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#334155"
          />

          {/* Fill Area */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line Path */}
          <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

          {/* Dots and Labels */}
          {points.map((p, i) => {
            const isActive = activeIdx === i;
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 6 : 4}
                  fill="#06b6d4"
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                />
                <text
                  x={p.x}
                  y={height - 4}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400 font-mono"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activeIdx !== null && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-xl pointer-events-none flex items-center gap-3 text-xs"
          >
            <span className="font-semibold text-slate-300">{data[activeIdx].label}:</span>
            <span className="font-mono font-bold text-cyan-300">
              {valueFormatter(data[activeIdx].value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Leaderboard Ranking ---
export interface LeaderboardItem {
  id: string;
  rank: number;
  title: string;
  subtitle: string;
  metric: string;
  submetric?: string;
  progressPercent?: number;
  badge?: string;
}

interface LeaderboardCardProps {
  title: string;
  subtitle?: string;
  items: LeaderboardItem[];
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ title, subtitle, items }) => {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800">
      <div className="mb-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>{title}</span>
        </h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">Tidak ada entri peringkat.</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const medal =
              item.rank === 1
                ? '🥇'
                : item.rank === 2
                ? '🥈'
                : item.rank === 3
                ? '🥉'
                : `#${item.rank}`;

            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/40 border border-slate-800 transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold font-mono text-slate-300 w-6 text-center">
                    {medal}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-100 truncate">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-amber-300">{item.metric}</div>
                  {item.submetric && (
                    <div className="text-[10px] text-slate-500 font-mono">{item.submetric}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Recommendations Modal ---
interface ReportRecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportRecommendationsModal: React.FC<ReportRecommendationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const recommendations = [
    {
      category: '1. Manajemen Persediaan & Pengendalian Modal Kerja (Inventory)',
      icon: Boxes,
      color: 'text-cyan-400',
      items: [
        {
          title: 'Laporan Saldo Stok & Buffer Health Level',
          desc: 'Memantau kuota on-hand fisik di gudang kontainer vs ambang batas minimum dan safety stock untuk mencegah downtime unit akibat kekosongan part kritis.',
          charts: 'Gauge Meter Kesehatan Stok, Matriks Peringatan Stok Kritis (Critical Stockout)',
        },
        {
          title: 'Laporan Valuasi Modal Kerja & Analisis ABC/Pareto',
          desc: 'Mengelompokkan suku cadang ke dalam Kelas A (80% nilai modal), Kelas B (15%), dan Kelas C (5%) untuk memprioritaskan kontrol modal kerja logistik tambang.',
          charts: 'Grafik Batang Horisontal Valuasi Tertinggi, Donut Chart Komposisi Modal per Kategori',
        },
        {
          title: 'Laporan Usia Simpan Stok (Stock Aging & Dead Stock)',
          desc: 'Mengidentifikasi part yang mengendap >90 dan >180 hari agar tidak menjadi dead-stock atau kerugian modal kerja beku.',
          charts: 'Stacked Segmented Aging Bar (<30D, 31-90D, 91-180D, >180D Dead Stock)',
        },
      ],
    },
    {
      category: '2. Operasional Lapangan & Traceability Pemakaian (Operation)',
      icon: Truck,
      color: 'text-emerald-400',
      items: [
        {
          title: 'Histori POS Issue dengan 5-Point Traceability (BR-001 s/d BR-004)',
          desc: 'Kepatuhan mutlak audit: Setiap pengeluaran part tercatat dengan No Unit, HM/KM, Site Tambang, Penerima, dan Mekanik penanggung jawab.',
          charts: 'Timeline Aktivitas Transaksi Harian, Top 5 Unit Teraktif Mengambil Part',
        },
        {
          title: 'Laporan Konsumsi per Armada Unit & Biaya per Jam Kerja (Cost / HM)',
          desc: 'Menghitung rasio efisiensi biaya suku cadang per jam operasi alat berat (Excavator PC2000, Komatsu HD785, CAT 777) untuk mendeteksi unit abnormal atau boros.',
          charts: 'Grafik Batang Peringkat Unit Terboros (Cost/HM), Perbandingan Tipe Armada',
        },
        {
          title: 'Distribusi Konsumsi per Site Tambang & Aktivitas Mekanik',
          desc: 'Memetakan konsumsi suku cadang per pit area (Pit Sorowako, Pit Petea, Workshop Utama) dan akuntabilitas mekanik yang melakukan penggantian.',
          charts: 'Leaderboard Produktivitas Mekanik, Perbandingan Pemakaian per Lokasi Pit',
        },
      ],
    },
    {
      category: '3. Manajemen Rantai Pasok & Kinerja Pergudangan (Management)',
      icon: TrendingUp,
      color: 'text-violet-400',
      items: [
        {
          title: 'Laporan Kinerja Pergudangan (Turnover Ratio & Throughput)',
          desc: 'Evaluasi rasio perputaran persediaan (Inventory Turnover Ratio) dan volume drop STO dari Gudang Utama ke Gudang Kontainer.',
          charts: 'Scorecard Gudang Utama vs Gudang Kontainer, Perbandingan ITR & Throughput',
        },
        {
          title: 'Efisiensi Pengadaan & Lead Time Replenishment',
          desc: 'Mengukur SLA siklus pengadaan (Permohonan -> Verifikasi Admin -> Approval Supervisor -> Drop STO -> Diterima Kontainer) dan akurasi pemenuhan OTIF (On-Time In-Full).',
          charts: 'Gauge Rata-Rata Lead Time (Jam), Akurasi Pemenuhan (%)',
        },
        {
          title: 'Kepatuhan Pengembalian Komponen Bekas (Core / Used Part Recovery)',
          desc: 'Memastikan 100% suku cadang bernilai tinggi (Alternator, Turbo, Injector, Cylinder) yang diganti wajib dikembalikan ke gudang untuk proses rekondisi.',
          charts: 'Rasio Kepatuhan Retur Part Bekas, Status Alur Rebuild',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Panduan Best Practice Logistik Tambang</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              Rekomendasi Laporan Enterprise WMS LogistikQu
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Daftar arsitektur pelaporan standar pertambangan untuk optimalisasi suku cadang alat berat, dump truck, dan gudang kontainer site.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="mt-6 space-y-6">
          {recommendations.map((group, gIdx) => {
            const GroupIcon = group.icon;
            return (
              <div key={gIdx} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                <h3 className={`text-sm font-bold ${group.color} flex items-center gap-2 mb-3`}>
                  <GroupIcon className="w-4 h-4" />
                  <span>{group.category}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {group.items.map((item, iIdx) => (
                    <div
                      key={iIdx}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                        <span className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>Visual: {item.charts}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Semua laporan dapat disortir per gudang, diekspor ke Excel (.xlsx), atau dicetak sebagai PDF resmi.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
