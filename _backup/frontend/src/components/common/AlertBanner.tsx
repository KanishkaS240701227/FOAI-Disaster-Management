import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface AlertBannerProps {
  type?: 'warning' | 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'warning',
  title,
  message,
  onDismiss,
}) => {
  const styles = {
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950/40',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      icon: AlertCircle,
      iconColor: 'text-red-500',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-800 dark:text-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-200',
      icon: Info,
      iconColor: 'text-blue-500',
    },
  };

  const scheme = styles[type];
  const Icon = scheme.icon;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border ${scheme.bg} ${scheme.border} ${scheme.text} transition-all`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${scheme.iconColor}`} />
      <div className="flex-1 text-xs">
        {title && <h5 className="font-bold mb-0.5">{title}</h5>}
        <p className="font-medium opacity-90 leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
