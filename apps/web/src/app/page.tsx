import React from 'react';
import { BackendStatus } from '@/components/backend-status';
import { SocketStatus } from '@/components/socket-status';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Server, Layers, ShieldCheck, CheckCircle2, Code2 } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/50 to-slate-950 p-8 sm:p-12 shadow-2xl">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple">Phase 1 Complete</Badge>
            <Badge variant="success">pnpm Monorepo</Badge>
            <Badge variant="default">Strict TypeScript</Badge>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Zoopie Real-Time Architecture & Foundation
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            High-performance monorepo architecture featuring Next.js App Router frontend, Express &
            Socket.IO backend, and shared TypeScript contracts with Zod runtime validation.
          </p>
        </div>
      </div>

      {/* Live System Gateways Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BackendStatus />
        <SocketStatus />
      </div>

      {/* Monorepo Topology Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-800/80 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Code2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/web</CardTitle>
            </div>
            <CardDescription>Next.js 15 App Router Frontend</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              Tailwind CSS, React 19, accessible component system, and client-side Socket.IO client.
              Runs completely independently with resilient error states.
            </p>
            <div className="pt-2 font-mono text-[11px] text-slate-300">Port: 3000</div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Server className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/server</CardTitle>
            </div>
            <CardDescription>Express & Socket.IO Gateway</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              REST health check endpoint, environment validation, CORS policies, and real-time
              WebSocket gateway with ping/pong protocol.
            </p>
            <div className="pt-2 font-mono text-[11px] text-slate-300">Port: 4000</div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">apps/shared</CardTitle>
            </div>
            <CardDescription>Shared Types & Validation Contracts</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 space-y-2">
            <p>
              Zod runtime validation schemas, typed event signatures, health contracts, and socket
              payloads shared seamlessly between web and server.
            </p>
            <div className="pt-2 font-mono text-[11px] text-slate-300">
              Namespace: @zoopie/shared
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Initial Component System Showcase */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-400" />
            <CardTitle>Initial Component System</CardTitle>
          </div>
          <CardDescription>
            Reusable Tailwind CSS component library prepared for the upcoming phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Buttons & States
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">
                Primary Small
              </Button>
              <Button variant="primary">Primary Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="success">Success</Button>
              <Button variant="primary" isLoading>
                Loading
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Badges & Tags
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="purple">Primary / Purple</Badge>
              <Badge variant="success">Success Status</Badge>
              <Badge variant="warning">Warning Alert</Badge>
              <Badge variant="destructive">Critical Error</Badge>
              <Badge variant="outline">Border Outline</Badge>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Live Status Indicators
            </h4>
            <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg border border-slate-800 bg-slate-950/60">
              <StatusIndicator status="online" label="System Online (Pulsing)" />
              <StatusIndicator status="connecting" label="Negotiating Handshake" />
              <StatusIndicator status="warning" label="High Latency Warning" />
              <StatusIndicator status="offline" label="Service Offline" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase 1 Acceptance Checklist */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <CardTitle>Phase 1 Acceptance Verification</CardTitle>
          </div>
          <CardDescription>Core criteria completed in this foundational phase.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              'pnpm monorepo initialized with strict TypeScript configuration',
              'Next.js 15 App Router app created in apps/web with Tailwind CSS',
              'Express & Socket.IO server created in apps/server',
              'Shared types and Zod validation contracts in apps/shared',
              'Backend GET /health endpoint with uptime and schema validation',
              'Socket.IO test client connection with Ping/Pong contract',
              'Vitest configured with server health & socket connection suites',
              'Playwright configured for end-to-end testing readiness',
              'Strict environment variable validation and development CORS',
              'Complete independent frontend and backend operation',
              'Safe .env.example with no committed secrets',
              'Comprehensive README and docs/ARCHITECTURE.md specification',
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-950/40 border border-slate-800/50"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
