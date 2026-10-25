import React from 'react';
import Link from 'next/link';
import { ZoopieWordmark } from '@/components/brand/logo';
import { ShieldCheck, Lock, Activity, Scale } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-surface-800/80 bg-surface-950/90 text-surface-400 text-xs mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <ZoopieWordmark size={28} />
            <p className="text-surface-300 text-sm max-w-md leading-relaxed">
              Zoopie is an original, friendly, peer-to-peer real-time communication platform.
              Connect with real people around shared interests with privacy-first engineering and
              zero clutter.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-surface-400 pt-2">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Lock className="h-3.5 w-3.5" />
                <span>Peer-to-Peer Direct Media</span>
              </span>
              <span className="flex items-center gap-1.5 text-brand-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Zero Account Friction</span>
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-200">
              Platform & System
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  Features & Protocols
                </Link>
              </li>
              <li>
                <Link href="/chat?mode=video" className="hover:text-white transition-colors">
                  Video Chat Setup
                </Link>
              </li>
              <li>
                <Link href="/chat?mode=text" className="hover:text-white transition-colors">
                  Text Chat Setup
                </Link>
              </li>
              <li>
                <Link
                  href="/dev-status"
                  className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <Activity className="h-3 w-3" />
                  <span>Phase 1 System Health</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Trust & Legal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-200">
              Trust & Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/safety" className="hover:text-white transition-colors">
                  Safety & Community Guide
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy (Draft)
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service (Draft)
                </Link>
              </li>
              <li>
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90">
                  <Scale className="h-3 w-3" />
                  <span>Policies Staged for Legal Review</span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer & Status */}
        <div className="border-t border-surface-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-surface-500">
          <p>© {new Date().getFullYear()} Zoopie Platform. Built with privacy-first principles.</p>
          <div className="flex items-center gap-3">
            <span className="rounded bg-surface-900 border border-surface-800 px-2 py-0.5 text-surface-400">
              Phase 2 Active
            </span>
            <span className="text-surface-500">
              All policies are draft proposals requiring formal compliance review.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
