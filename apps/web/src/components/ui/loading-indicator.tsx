import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'brand' | 'teal' | 'white';
}

export function Spinner({ size = 'md', variant = 'brand', className, ...props }: SpinnerProps) {
  const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const colorMap = {
    brand: 'text-brand-500',
    teal: 'text-teal-400',
    white: 'text-white',
  };

  return (
    <svg
      className={cn('animate-spin', sizeMap[size], colorMap[variant], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
      role="status"
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-surface-800/80 motion-reduce:animate-none',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export function LoadingCard({
  message = 'Loading...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-2xl border border-surface-800 bg-surface-900/60 text-center space-y-3',
        className
      )}
    >
      <Spinner size="lg" variant="brand" />
      <p className="text-sm text-surface-400 font-medium">{message}</p>
    </div>
  );
}
