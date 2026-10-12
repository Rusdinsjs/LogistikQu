import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="glass-card rounded-xl p-4.5 border border-slate-800/80 bg-slate-900/40 space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-slate-800 rounded" />
            <div className="h-5 w-5 bg-slate-800 rounded-full" />
          </div>
          <div className="h-8 w-28 bg-slate-800 rounded" />
          <div className="h-2.5 w-36 bg-slate-800/60 rounded" />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 w-40 bg-slate-800 rounded" />
        <div className="h-4 w-20 bg-slate-800 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex gap-4 items-center py-2 border-b border-slate-800/50">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3 bg-slate-800 rounded flex-1"
                style={{ opacity: 1 - cIdx * 0.15 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-3 rounded-lg border border-slate-800/60 bg-slate-900/30 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-1/3 bg-slate-800 rounded" />
              <div className="h-2.5 w-2/3 bg-slate-800/60 rounded" />
            </div>
          </div>
          <div className="h-3 w-12 bg-slate-800 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
};
