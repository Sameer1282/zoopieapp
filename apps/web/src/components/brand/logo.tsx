import React from 'react';

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  showWordmark?: boolean;
}

export function ZoopieIcon({
  size = 32,
  className = '',
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient
          id="zoopie-grad-1"
          x1="4"
          y1="4"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient
          id="zoopie-grad-2"
          x1="12"
          y1="28"
          x2="28"
          y2="12"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Outer rounded container */}
      <rect width="40" height="40" rx="12" fill="#0f172a" />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="11.25"
        stroke="#1e293b"
        strokeWidth="1.5"
      />
      {/* Dynamic interlocking Z-wave chat connection */}
      <path
        d="M10 13.5C10 11.567 11.567 10 13.5 10H27C28.6569 10 30 11.3431 30 13C30 14.154 29.336 15.197 28.3 15.68L17.5 21L27 21C28.6569 21 30 22.3431 30 24C30 25.6569 28.6569 27 27 27H13C11.3431 27 10 25.6569 10 24C10 22.846 10.664 21.803 11.7 21.32L22.5 16L13.5 16C11.567 16 10 14.433 10 12.5V13.5Z"
        fill="url(#zoopie-grad-1)"
      />
      {/* Interaction pulse indicator */}
      <circle cx="28.5" cy="11.5" r="3" fill="#2dd4bf" />
      <circle cx="11.5" cy="28.5" r="3" fill="#818cf8" />
    </svg>
  );
}

export function ZoopieWordmark({
  size = 32,
  className = '',
  showBadge = false,
  badgeText = 'Beta',
}: {
  size?: number;
  className?: string;
  showBadge?: boolean;
  badgeText?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <ZoopieIcon size={size} />
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white font-sans">
          Zoop<span className="text-teal-400">ie</span>
        </span>
        {showBadge && (
          <span className="rounded-full bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-300">
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
