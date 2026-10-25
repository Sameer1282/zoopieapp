'use client';

import React, { useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-surface-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        ref={dialogRef}
        className={cn(
          'relative w-full rounded-2xl border border-surface-700/80 bg-surface-900 p-6 text-surface-100 shadow-dialog transition-all',
          'animate-in zoom-in-95 fade-in duration-200 focus:outline-none',
          sizeStyles[size],
          className
        )}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-6">
          <h2 id={titleId} className="text-lg sm:text-xl font-bold tracking-tight text-white">
            {title}
          </h2>
          {description && (
            <p id={descId} className="text-sm text-surface-400">
              {description}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="py-4 text-sm text-surface-200 leading-relaxed">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-800/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
