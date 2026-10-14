import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
  subtext?: string;
}

export const LoadingSpinner: React.FC<Props> = ({
  message = 'Processing...',
  subtext,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-orange-200 dark:border-orange-950/60 border-t-orange-500 animate-spin" />
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{message}</p>
        {subtext && (
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{subtext}</p>
        )}
      </div>
    </div>
  );
};
