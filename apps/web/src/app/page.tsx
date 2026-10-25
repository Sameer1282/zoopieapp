import React from 'react';
import Link from 'next/link';
import { HeroChatLauncher } from '@/components/landing/hero-launcher';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeaturesSafety } from '@/components/landing/features-safety';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="relative w-full pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle decorative background gradient glows */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/15 via-teal-500/10 to-transparent blur-3xl rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl space-y-10 text-center">
          {/* Main Hero Header */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-semibold text-brand-300">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              <span>Zoopie Phase 2 &bull; Design System & Landing Page</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Spontaneous connections.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-teal-300 to-teal-400">
                Zero friction.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-surface-300 max-w-2xl mx-auto leading-relaxed">
              Meet real people around shared interests via camera or text. Private, peer-to-peer
              WebRTC streams, no account tracking, and instant skip controls.
            </p>
          </div>

          {/* Interactive Chat Launcher Card */}
          <HeroChatLauncher />

          {/* Value Props Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4 text-left">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-900/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Shield className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">No Sign-Up Needed</span>
                <span className="text-surface-400">Zero phone or email requested</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-900/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                <Zap className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">Sub-Second Signaling</span>
                <span className="text-surface-400">High-speed Socket.IO gateway</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-surface-800 bg-surface-900/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-white block">Shared Topic Match</span>
                <span className="text-surface-400">Talk about what you love</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-24 pb-20">
        <HowItWorks />
        <FeaturesSafety />

        {/* Phase 1 Integration / Architecture Health Banner */}
        <Card className="border-surface-800 bg-surface-900/70 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <Badge variant="success" size="sm">
                  System Health & Diagnostics
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white">Live Gateway & Foundation Status</h3>
              <p className="text-xs sm:text-sm text-surface-400">
                Phase 1 backend Express health checks, WebSocket ping/pong latency, and shared
                contract validation remain fully active.
              </p>
            </div>
            <Link href="/dev-status">
              <Button variant="outline" size="md" className="gap-2 shrink-0">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Open Diagnostic Center</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
