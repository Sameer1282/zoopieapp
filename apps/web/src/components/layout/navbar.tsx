'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ZoopieWordmark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Menu, X, Shield, Activity, Video, MessageSquare } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#features', label: 'Features' },
    { href: '/safety', label: 'Safety & Trust', icon: Shield },
    { href: '/dev-status', label: 'System Health', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-800/80 bg-surface-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg p-1"
          aria-label="Zoopie Homepage"
        >
          <ZoopieWordmark size={32} showBadge badgeText="Phase 2" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
          {navLinks.map(link => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-white flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-md px-2 py-1 ${
                  isActive ? 'text-brand-300' : 'text-surface-300'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-brand-400" />}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Quick Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/chat?mode=text">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Text</span>
            </Button>
          </Link>
          <Link href="/chat?mode=video">
            <Button variant="brand" size="sm" className="gap-1.5 shadow-sm">
              <Video className="h-3.5 w-3.5" />
              <span>Start Video</span>
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border border-surface-700/80 bg-surface-900 p-2 text-surface-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-surface-800 bg-surface-950/95 px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-2">
            {navLinks.map(link => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-surface-200 hover:bg-surface-850 hover:text-white transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4 text-brand-400" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-800/80">
            <Link href="/chat?mode=text" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" size="md" className="w-full gap-2 text-xs">
                <MessageSquare className="h-4 w-4" />
                <span>Text Chat</span>
              </Button>
            </Link>
            <Link href="/chat?mode=video" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="brand" size="md" className="w-full gap-2 text-xs">
                <Video className="h-4 w-4" />
                <span>Video Chat</span>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
