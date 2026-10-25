import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'brand' | 'teal' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'brand',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all select-none ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 ' +
      'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed ' +
      'active:scale-[0.98] motion-reduce:transform-none';

    const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
      brand:
        'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 shadow-md shadow-brand-500/20 hover:shadow-brand-500/30 border border-brand-400/20',
      teal: 'bg-gradient-to-r from-teal-600 to-teal-500 text-surface-950 font-semibold hover:from-teal-500 hover:to-teal-400 shadow-md shadow-teal-500/20 hover:shadow-teal-500/30 border border-teal-300/30',
      secondary:
        'bg-surface-850 text-surface-100 hover:bg-surface-800 border border-surface-700/70 shadow-sm hover:border-surface-600',
      outline:
        'border border-surface-700 bg-transparent text-surface-200 hover:bg-surface-850 hover:text-white hover:border-surface-600',
      ghost: 'text-surface-300 hover:bg-surface-850/80 hover:text-white',
      destructive:
        'bg-coral-600 text-white hover:bg-coral-500 shadow-md shadow-coral-500/20 border border-coral-400/30',
    };

    const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
      xl: 'h-14 px-8 text-lg font-semibold gap-3',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 shrink-0 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
