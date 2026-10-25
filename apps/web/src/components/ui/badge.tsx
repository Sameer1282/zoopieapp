import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'brand' | 'teal' | 'default' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'default', size = 'md', ...props }: BadgeProps) {
  const variantStyles = {
    brand: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
    teal: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    default: 'bg-surface-800 text-surface-200 border-surface-700',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    destructive: 'bg-coral-500/15 text-coral-400 border-coral-500/30',
    outline: 'border-surface-700 text-surface-300 bg-transparent',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide transition-colors select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
}
