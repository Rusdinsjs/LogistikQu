import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'blue';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  status?: string;
  size?: 'sm' | 'md' | 'lg';
  withDot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const getStatusVariant = (status?: string): BadgeVariant => {
  if (!status) return 'neutral';
  const s = status.toUpperCase();
  if (['CRITICAL', 'REJECTED', 'FAILED', 'HIGH', 'RUSAK'].includes(s)) return 'danger';
  if (['WARNING', 'REQUESTED', 'PENDING', 'SLOW_MOVING', 'MEDIUM'].includes(s)) return 'warning';
  if (['NORMAL', 'SAFE', 'COMPLETED', 'APPROVED', 'FAST_MOVING', 'LOW', 'ACTIVE'].includes(s)) return 'success';
  if (['IN_TRANSIT', 'VERIFIED', 'MEDIUM_MOVING'].includes(s)) return 'info';
  if (['ABNORMAL_CONSUMPTION', 'PURPLE'].includes(s)) return 'purple';
  return 'neutral';
};

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  danger: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/25',
    dot: 'bg-rose-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  info: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/25',
    dot: 'bg-cyan-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/25',
    dot: 'bg-purple-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    dot: 'bg-blue-400',
  },
  neutral: {
    bg: 'bg-slate-800/60',
    text: 'text-slate-300',
    border: 'border-slate-700/60',
    dot: 'bg-slate-400',
  },
};

const sizeStyles = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  size = 'sm',
  withDot = false,
  pulse = false,
  className = '',
}) => {
  const chosenVariant = variant || getStatusVariant(status);
  const styles = variantStyles[chosenVariant];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${styles.bg} ${styles.text} ${styles.border} ${sizeStyles[size]} ${className}`}
    >
      {withDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      <span>{children || status}</span>
    </span>
  );
};
