import React from 'react';
import { SeverityLevel, RoadStatus, RoadCondition, TruckStatus } from '../../types';

interface SeverityBadgeProps {
  severity: SeverityLevel;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const styles: Record<SeverityLevel, string> = {
    Critical: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border-red-300 dark:border-red-800 animate-pulse',
    High: 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border-orange-300 dark:border-orange-800',
    Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    Low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${styles[severity] || styles.Medium}`}
    >
      {severity}
    </span>
  );
};

interface RoadStatusBadgeProps {
  status: RoadStatus;
}

export const RoadStatusBadge: React.FC<RoadStatusBadgeProps> = ({ status }) => {
  const styles: Record<RoadStatus, string> = {
    Open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    Blocked: 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border-red-300 dark:border-red-800 font-bold',
    'Under Repair': 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${styles[status] || styles.Open}`}
    >
      {status}
    </span>
  );
};

interface TruckStatusBadgeProps {
  status: TruckStatus;
}

export const TruckStatusBadge: React.FC<TruckStatusBadgeProps> = ({ status }) => {
  const styles: Record<TruckStatus, string> = {
    Available: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    Busy: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    'In Maintenance': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${styles[status] || styles.Available}`}
    >
      {status}
    </span>
  );
};
