import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { ShieldCheck, UserX, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Safety & Community Guidelines',
  description: 'Zoopie community standards, age restrictions, and user self-protection principles.',
};

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Homepage</span>
      </Link>

      <div className="space-y-3">
        <Badge variant="brand">Trust & Community</Badge>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Safety & Guidelines
        </h1>
        <p className="text-surface-400 text-sm sm:text-base leading-relaxed">
          How we design for participant respect, self-defense tools, and community integrity.
        </p>
      </div>

      {/* Mandatory Staging Disclaimer Banner */}
      <Alert variant="warning" title="Draft Policy — Staged for Safety Team & Legal Review">
        This document is an architectural safety specification prepared for Phase 2 development. It
        outlines intended platform guardrails and does not constitute a final legal contract or an
        unsupported guarantee of complete safety.
      </Alert>

      {/* Main Guidelines Cards */}
      <div className="space-y-6">
        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-500/15 text-coral-400 border border-coral-500/30">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                1. Age Requirement: 18+ Only
              </h2>
              <span className="text-xs text-surface-400">Strict community threshold</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            Zoopie is designed solely for adults aged 18 and older. Minors are strictly prohibited
            from using this service. If we detect or receive evidence indicating a participant is
            under 18, access is immediately terminated and device fingerprints are barred.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">2. Prohibited Conduct</h2>
              <span className="text-xs text-surface-400">Zero tolerance violations</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-surface-300 list-disc list-inside">
            <li>Any form of sexual violence, non-consensual sexual content, or illicit acts.</li>
            <li>
              Harassment, bullying, threats of physical harm, or hate speech targeting race,
              ethnicity, or sexual orientation.
            </li>
            <li>
              Doxxing, sharing personal identifying info (PII), or unauthorized recordings of peers.
            </li>
            <li>Spamming, automated bot traffic, or commercial advertising broadcast.</li>
          </ul>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                3. Self-Defense & User Controls
              </h2>
              <span className="text-xs text-surface-400">You are always in control</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-surface-800 bg-surface-950/60 p-4 space-y-1">
              <span className="font-semibold text-white text-sm block">Instant Skip (Next)</span>
              <p className="text-xs text-surface-400">
                You never owe anyone your time. Press Next or tap Escape to instantly sever the
                connection.
              </p>
            </div>
            <div className="rounded-xl border border-surface-800 bg-surface-950/60 p-4 space-y-1">
              <span className="font-semibold text-white text-sm block">Block & Report</span>
              <p className="text-xs text-surface-400">
                Flagging a user isolates their session and prevents re-matching across the network.
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 border border-brand-500/30">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                4. Technical Privacy Protections
              </h2>
              <span className="text-xs text-surface-400">Cryptographic isolation</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            Zoopie utilizes peer-to-peer WebRTC connections. Your audio and video stream directly to
            your conversation partner without passing through intermediate cloud recording proxies.
            We advise never sharing sensitive personal credentials, home addresses, or financial
            data with strangers.
          </p>
        </Card>
      </div>
    </div>
  );
}
