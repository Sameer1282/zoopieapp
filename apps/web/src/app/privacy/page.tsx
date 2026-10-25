import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Lock, EyeOff, Server, Globe, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy (Draft)',
  description: 'Draft privacy architecture and data handling policies for the Zoopie platform.',
};

export default function PrivacyPage() {
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
        <Badge variant="teal">Data & Privacy Architecture</Badge>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="text-surface-400 text-sm sm:text-base leading-relaxed">
          Our commitment to minimal data collection, zero registration dossiers, and peer-to-peer
          transmission.
        </p>
      </div>

      {/* Mandatory Legal Review Banner */}
      <Alert variant="warning" title="Draft Policy — Requires Formal Compliance & Legal Review">
        This document represents an engineering draft reflecting our technical architecture. It does
        not constitute formal legal counsel or unsupported compliance certification (e.g. GDPR,
        CCPA/CPRA). Complete legal vetting will occur prior to commercial public launch.
      </Alert>

      <div className="space-y-6">
        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <EyeOff className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">1. Data We Do NOT Collect</h2>
              <span className="text-xs text-surface-400">Privacy by absence</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-surface-300 list-disc list-inside">
            <li>
              <strong>No User Accounts:</strong> No usernames, passwords, phone numbers, or email
              addresses are requested or stored.
            </li>
            <li>
              <strong>No Media Recording:</strong> Zoopie does not capture, save, or transcribe
              peer-to-peer audio or video conversations.
            </li>
            <li>
              <strong>No Tracking Cookies:</strong> We do not deploy third-party advertising
              tracking cookies or cross-site tracking pixels.
            </li>
          </ul>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 border border-brand-500/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                2. Ephemeral Signaling Data
              </h2>
              <span className="text-xs text-surface-400">Temporary coordination</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            To coordinate matching and establish WebRTC handshakes, our signaling gateway processes
            ephemeral session tokens and interest preferences via Socket.IO. When a session
            terminates or a user navigates away, signaling metadata is discarded from volatile
            memory.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                3. Peer-to-Peer Networking & IP Transparency
              </h2>
              <span className="text-xs text-surface-400">Technical reality of WebRTC</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            By nature of direct WebRTC peer connections, client IP addresses are exchanged during
            the ICE/STUN candidate negotiation to enable direct packet routing between browsers. If
            you require complete IP masking from conversation partners, we strongly advise using a
            reputable Virtual Private Network (VPN) while using peer-to-peer web applications.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-800 text-surface-200 border border-surface-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                4. Abuse Prevention & Security Logs
              </h2>
              <span className="text-xs text-surface-400">Automated defense</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            To prevent Denial of Service (DoS) attacks and malicious abuse, our servers maintain
            ephemeral access logs (IP address, timestamp, request headers) retained for limited
            rolling windows strictly for network health and threat mitigation.
          </p>
        </Card>
      </div>
    </div>
  );
}
