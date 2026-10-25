import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BackendStatus } from '@/components/backend-status';
import { SocketStatus } from '@/components/socket-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowLeft, Activity, Server, ShieldCheck, Code2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'System Diagnostics & Health',
  description:
    'Live Phase 1 gateway diagnostics, health endpoints, and Socket.IO connection tests.',
};

export default function DevStatusPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Homepage</span>
      </Link>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="teal">Diagnostic Center</Badge>
          <Badge variant="outline">Phase 1 Foundation</Badge>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <Activity className="h-8 w-8 text-emerald-400" />
          <span>System Health & Gateways</span>
        </h1>
        <p className="text-surface-400 text-sm max-w-2xl leading-relaxed">
          Real-time verification of backend health, round-trip ping/pong latency, and shared Zod
          contract validation.
        </p>
      </div>

      {/* Live System Gateways Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BackendStatus />
        <SocketStatus />
      </div>

      {/* Monorepo Topology Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-surface-800 bg-surface-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                <Code2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/web</CardTitle>
            </div>
            <CardDescription>Next.js 15 App Router Frontend</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-surface-400 space-y-2">
            <p>
              Tailwind CSS, React 19, accessible component system, and client-side Socket.IO client.
              Runs completely independently with resilient error states.
            </p>
            <div className="pt-2 font-mono text-[11px] text-surface-300">Port: 3000</div>
          </CardContent>
        </Card>

        <Card className="border-surface-800 bg-surface-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Server className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/server</CardTitle>
            </div>
            <CardDescription>Express & Socket.IO Gateway</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-surface-400 space-y-2">
            <p>
              REST health check endpoint, environment validation, CORS policies, and real-time
              WebSocket gateway with ping/pong protocol.
            </p>
            <div className="pt-2 font-mono text-[11px] text-surface-300">Port: 4000</div>
          </CardContent>
        </Card>

        <Card className="border-surface-800 bg-surface-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/shared</CardTitle>
            </div>
            <CardDescription>Shared Types & Validation Contracts</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-surface-400 space-y-2">
            <p>
              Zod runtime validation schemas, typed event signatures, health contracts, and socket
              payloads shared seamlessly between web and server.
            </p>
            <div className="pt-2 font-mono text-[11px] text-surface-300">
              Namespace: @zoopie/shared
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
