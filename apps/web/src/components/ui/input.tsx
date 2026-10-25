import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      errorMessage,
      leadingIcon,
      trailingIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const isError = Boolean(errorMessage);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs sm:text-sm font-medium text-surface-200"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-surface-400">
              {leadingIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={isError}
            aria-describedby={isError ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full rounded-xl border bg-surface-950/80 px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950',
              leadingIcon ? 'pl-10' : 'pl-4',
              trailingIcon ? 'pr-10' : 'pr-4',
              isError
                ? 'border-coral-500/70 focus-visible:ring-coral-400'
                : 'border-surface-700/80 hover:border-surface-600 focus-visible:ring-brand-400 focus-visible:border-brand-500',
              disabled && 'opacity-50 cursor-not-allowed bg-surface-900',
              className
            )}
            {...props}
          />

          {trailingIcon && (
            <div className="absolute right-3.5 flex items-center text-surface-400">
              {trailingIcon}
            </div>
          )}
        </div>

        {isError && (
          <p id={errorId} className="text-xs text-coral-400 font-medium" role="alert">
            {errorMessage}
          </p>
        )}

        {!isError && helperText && (
          <p id={helperId} className="text-xs text-surface-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
