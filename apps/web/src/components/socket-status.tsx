'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { StatusIndicator } from './ui/status-indicator';
import {
  SOCKET_EVENTS,
  PongPayloadSchema,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from '@zoopie/shared';
import { config } from '@/lib/config';
import { Wifi, Send, Power, Terminal } from 'lucide-react';

interface EventLogEntry {
  id: string;
  timestamp: string;
  type: 'incoming' | 'outgoing' | 'info' | 'error';
  message: string;
}

export function SocketStatus() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [rtt, setRtt] = useState<number | null>(null);
  const [logs, setLogs] = useState<EventLogEntry[]>([]);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  const addLog = (type: EventLogEntry['type'], message: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs(prev => [
      { id: `${Date.now()}-${Math.random()}`, timestamp: timeStr, type, message },
      ...prev.slice(0, 9),
    ]);
  };

  const connectSocket = () => {
    if (socketRef.current?.connected) return;

    setConnecting(true);
    addLog('info', `Connecting to Socket.IO at ${config.socketUrl}...`);

    const s = io(config.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 3,
      timeout: 5000,
    });

    s.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setSocketId(s.id || null);
      addLog('incoming', `Connected with Socket ID: ${s.id}`);
    });

    s.on(SOCKET_EVENTS.PONG, payload => {
      const parsed = PongPayloadSchema.safeParse(payload);
      const now = Date.now();
      if (parsed.success) {
        const roundtrip = now - parsed.data.clientTimestamp;
        setRtt(roundtrip);
        addLog('incoming', `Received PONG in ${roundtrip}ms: "${parsed.data.message}"`);
      } else {
        addLog('error', `Received invalid PONG schema payload`);
      }
    });

    s.on('connect_error', err => {
      setConnecting(false);
      setConnected(false);
      addLog('error', `Connection error: ${err.message}`);
    });

    s.on('disconnect', reason => {
      setConnected(false);
      setConnecting(false);
      setSocketId(null);
      addLog('info', `Disconnected (reason: ${reason})`);
    });

    socketRef.current = s;
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnecting(false);
      setSocketId(null);
      addLog('info', 'Disconnected manually by user.');
    }
  };

  const sendPing = () => {
    if (!socketRef.current || !connected) {
      addLog('error', 'Cannot ping: Socket is not connected');
      return;
    }

    const now = Date.now();
    addLog('outgoing', `Sending PING event with clientTimestamp: ${now}`);
    socketRef.current.emit(SOCKET_EVENTS.PING, {
      clientTimestamp: now,
      nonce: Math.random().toString(36).substring(2, 9),
    });
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <Card className="border-slate-800 bg-slate-900/90 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/20">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Socket.IO Connection Test</CardTitle>
              <CardDescription>
                Server Gateway: <code className="text-slate-300">{config.socketUrl}</code>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!connected ? (
              <Button
                size="sm"
                variant="brand"
                onClick={connectSocket}
                isLoading={connecting}
                className="h-8"
              >
                <Power className="h-3.5 w-3.5" />
                Connect
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={disconnectSocket} className="h-8">
                <Power className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="flex items-center gap-3">
            <StatusIndicator
              status={connected ? 'online' : connecting ? 'connecting' : 'offline'}
              label={
                connected
                  ? `Connected (ID: ${socketId?.slice(0, 8)}...)`
                  : connecting
                    ? 'Connecting...'
                    : 'Disconnected'
              }
            />
          </div>
          <div className="flex items-center gap-2">
            {rtt !== null && connected && (
              <Badge variant="brand" className="text-[11px]">
                RTT: {rtt} ms
              </Badge>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={sendPing}
              disabled={!connected}
              className="h-7 text-xs px-2.5"
            >
              <Send className="h-3 w-3" />
              Emit Ping
            </Button>
          </div>
        </div>

        {/* Live Socket Logs */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 font-mono text-xs">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 mb-2 text-slate-400">
            <Terminal className="h-3.5 w-3.5 text-primary-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">Event Stream</span>
          </div>
          {logs.length === 0 ? (
            <p className="text-slate-500 italic py-1">
              No socket events recorded yet. Click Connect to initiate.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-[11px]">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span
                    className={
                      log.type === 'incoming'
                        ? 'text-emerald-400'
                        : log.type === 'outgoing'
                          ? 'text-primary-400'
                          : log.type === 'error'
                            ? 'text-red-400'
                            : 'text-slate-300'
                    }
                  >
                    {log.type === 'incoming' && '⬇ '}
                    {log.type === 'outgoing' && '⬆ '}
                    {log.type === 'error' && '✖ '}
                    {log.type === 'info' && 'ℹ '}
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
