import React from 'react';
import { Badge } from './ui/badge';
import { Zap, Layers, Activity } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 text-white shadow-lg shadow-primary-500/20">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">Zoopie</span>
              <Badge variant="purple" className="text-[10px] uppercase font-bold tracking-wider">
                Phase 1
              </Badge>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Real-Time Interactive Architecture
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <Layers className="h-3.5 w-3.5 text-primary-400" />
            <span>pnpm Monorepo</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Health & Sockets</span>
          </div>
        </div>
      </div>
    </header>
  );
}
