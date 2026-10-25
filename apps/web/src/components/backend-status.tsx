'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { StatusIndicator } from './ui/status-indicator';
import { HealthCheckResponseSchema, type HealthCheckResponse } from '@zoopie/shared';
import { config } from '@/lib/config';
import { RefreshCw, Server, AlertTriangle, ShieldCheck } from 'lucide-react';

export function BackendStatus() {
  const [data, setData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [contractValid, setContractValid] = useState<boolean | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const response = await fetch(`${config.apiUrl}/health`, {
        cache: 'no-store',
      });

      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // Validate contract using shared schema
      const validation = HealthCheckResponseSchema.safeParse(json);
      if (!validation.success) {
        setContractValid(false);
        setError('Response failed @zoopie/shared schema validation');
        setData(json);
      } else {
        setContractValid(true);
        setData(validation.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend';
      setError(msg);
      setData(null);
      setContractValid(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Express Backend Status</CardTitle>
              <CardDescription>
                Endpoint: <code className="text-slate-300">{config.apiUrl}/health</code>
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={checkHealth}
            isLoading={loading}
            className="h-8"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center gap-3">
            <StatusIndicator
              status={error ? 'offline' : loading ? 'connecting' : 'online'}
              label={error ? 'Backend Offline' : loading ? 'Checking...' : 'Backend Healthy'}
            />
          </div>
          <div className="flex items-center gap-2">
            {latency !== null && !error && (
              <Badge variant="default" className="text-[11px]">
                {latency} ms
              </Badge>
            )}
            {contractValid === true && (
              <Badge variant="success" className="text-[11px] gap-1">
                <ShieldCheck className="h-3 w-3" />
                Shared Contract Verified
              </Badge>
            )}
            {contractValid === false && (
              <Badge variant="warning" className="text-[11px] gap-1">
                <AlertTriangle className="h-3 w-3" />
                Contract Mismatch
              </Badge>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Independent Operation Mode Active</span>
            </div>
            <p className="mt-1 text-slate-400">
              Frontend is running cleanly on its own. Backend was not detected at {config.apiUrl}.
              Start it with <code className="text-slate-200">pnpm --filter @zoopie/server dev</code>
              .
            </p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
              <span className="text-slate-400">Service</span>
              <p className="font-semibold text-slate-100 mt-0.5">{data.service}</p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
              <span className="text-slate-400">Status</span>
              <p className="font-semibold text-emerald-400 mt-0.5 uppercase">{data.status}</p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
              <span className="text-slate-400">Uptime</span>
              <p className="font-semibold text-slate-100 mt-0.5">{data.uptime} seconds</p>
            </div>
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5">
              <span className="text-slate-400">Version</span>
              <p className="font-semibold text-slate-100 mt-0.5">{data.version}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
