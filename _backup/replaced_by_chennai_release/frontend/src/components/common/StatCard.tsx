import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'orange' | 'emerald' | 'amber' | 'purple' | 'red';
  trend?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
  onClick,
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800/60',
      ring: 'group-hover:ring-blue-500/30',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-800/60',
      ring: 'group-hover:ring-orange-500/30',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      ring: 'group-hover:ring-emerald-500/30',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800/60',
      ring: 'group-hover:ring-amber-500/30',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800/60',
      ring: 'group-hover:ring-purple-500/30',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800/60',
      ring: 'group-hover:ring-red-500/30',
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-4 group transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:scale-[1.01] hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
          {trend && (
            <span className="inline-block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {trend}
            </span>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center border ${scheme.bg} ${scheme.text} ${scheme.border} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
