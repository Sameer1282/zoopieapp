import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting' | 'warning';
  label?: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const dotColor = {
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    connecting: 'bg-amber-500 animate-pulse',
    warning: 'bg-amber-400',
  }[status];

  const pingColor = {
    online: 'bg-emerald-400',
    offline: 'bg-red-400',
    connecting: 'bg-amber-400',
    warning: 'bg-amber-300',
  }[status];

  return (
    <div className={cn('inline-flex items-center gap-2 text-xs font-medium', className)}>
      <span className="relative flex h-2.5 w-2.5">
        {status === 'online' && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              pingColor
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', dotColor)} />
      </span>
      {label && <span className="text-slate-300">{label}</span>}
    </div>
  );
}
