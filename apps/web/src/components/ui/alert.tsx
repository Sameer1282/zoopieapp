import React from 'react';
import { cn } from '@/lib/utils';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onDismiss?: () => void;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className,
  ...props
}: AlertProps) {
  const variantStyles = {
    info: 'border-brand-500/30 bg-brand-500/10 text-brand-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    error: 'border-coral-500/30 bg-coral-500/10 text-coral-200',
  };

  const iconMap = {
    info: <Info className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
    error: <AlertCircle className="h-5 w-5 text-coral-400 shrink-0 mt-0.5" />,
  };

  const isCritical = variant === 'error' || variant === 'warning';

  return (
    <div
      role={isCritical ? 'alert' : 'status'}
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed transition-all',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {iconMap[variant]}
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold text-white tracking-tight">{title}</h5>}
        <div className="text-xs sm:text-sm opacity-90">{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-surface-400 hover:text-white hover:bg-surface-800/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
