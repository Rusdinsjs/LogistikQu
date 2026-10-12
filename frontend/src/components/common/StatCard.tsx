import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.FC<{ className?: string }>;
  subtext?: string;
  trend?: {
    value: string | number;
    label: string;
    isPositive?: boolean;
  };
  colorScheme?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
  onClick?: () => void;
  loading?: boolean;
}

const colorStyles: Record<
  string,
  {
    border: string;
    bg: string;
    iconBg: string;
    iconText: string;
    textVal: string;
  }
> = {
  cyan: {
    border: 'border-slate-800/80 hover:border-cyan-500/40',
    bg: 'bg-slate-900/40',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20',
    iconText: 'text-cyan-400',
    textVal: 'text-white',
  },
  emerald: {
    border: 'border-emerald-900/30 hover:border-emerald-500/40',
    bg: 'bg-emerald-950/10',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconText: 'text-emerald-400',
    textVal: 'text-emerald-400',
  },
  amber: {
    border: 'border-amber-900/30 hover:border-amber-500/40',
    bg: 'bg-amber-950/10',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconText: 'text-amber-400',
    textVal: 'text-amber-400',
  },
  rose: {
    border: 'border-rose-900/30 hover:border-rose-500/40',
    bg: 'bg-rose-950/10',
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconText: 'text-rose-400',
    textVal: 'text-rose-400',
  },
  purple: {
    border: 'border-purple-900/30 hover:border-purple-500/40',
    bg: 'bg-purple-950/10',
    iconBg: 'bg-purple-500/10 border-purple-500/20',
    iconText: 'text-purple-400',
    textVal: 'text-purple-300',
  },
  blue: {
    border: 'border-blue-900/30 hover:border-blue-500/40',
    bg: 'bg-blue-950/10',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconText: 'text-blue-400',
    textVal: 'text-blue-300',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  subtext,
  trend,
  colorScheme = 'cyan',
  onClick,
  loading = false,
}) => {
  const styles = colorStyles[colorScheme] || colorStyles.cyan;

  return (
    <div
      onClick={onClick}
      className={`glass-card rounded-xl p-4.5 border transition-all ${styles.border} ${styles.bg} ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <span className="text-xs font-medium text-slate-300">{title}</span>
        <div
          className={`w-7 h-7 rounded-lg border flex items-center justify-center ${styles.iconBg} ${styles.iconText}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <div className={`text-2xl font-bold tracking-tight ${styles.textVal}`}>
          {loading ? '...' : value}
        </div>
        {unit && !loading && <span className="text-xs text-slate-400">{unit}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        {subtext && <p className="text-slate-400/80 truncate">{subtext}</p>}

        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
              trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trend.value} {trend.label}
          </span>
        )}
      </div>
    </div>
  );
};
