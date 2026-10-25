'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/loading-indicator';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { TextChatInterface } from '@/components/chat/text-chat-interface';
import { io, type Socket } from 'socket.io-client';
import { config } from '@/lib/config';
import {
  Video,
  MessageSquare,
  ArrowLeft,
  Sparkles,
  Camera,
  Mic,
  Wifi,
  Construction,
  FlaskConical,
} from 'lucide-react';

function ChatSetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = (searchParams.get('mode') === 'text' ? 'text' : 'video') as 'video' | 'text';
  const customRoom = searchParams.get('room') || 'dev-match-room-1';
  const rawInterests = searchParams.get('interests') || '';
  const interests = rawInterests
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  // Device permissions state (video mode)
  const [testingMedia, setTestingMedia] = useState(false);
  const [mediaGranted, setMediaGranted] = useState<boolean | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Gateway socket state
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'offline'>(
    'connecting'
  );
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    let socket: Socket | null = null;
    try {
      socket = io(config.socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 4000,
        reconnectionAttempts: 2,
      });

      socket.on('connect', () => {
        setSocketStatus('connected');
        setSocketId(socket?.id || null);
      });

      socket.on('connect_error', () => {
        setSocketStatus('offline');
      });

      socket.on('disconnect', () => {
        setSocketStatus('offline');
      });
    } catch {
      setSocketStatus('offline');
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const testMediaPermissions = async () => {
    setTestingMedia(true);
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setMediaGranted(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (err: unknown) {
      setMediaGranted(false);
      setMediaError(err instanceof Error ? err.message : 'Permission denied or no device found');
    } finally {
      setTestingMedia(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center gap-2">
          {mode === 'text' && (
            <Badge variant="teal" size="sm" className="gap-1">
              <FlaskConical className="h-3 w-3" />
              <span>Phase 4 Live Chat</span>
            </Badge>
          )}
          <Badge variant={mode === 'video' ? 'brand' : 'teal'}>
            {mode === 'video' ? 'Video Mode' : 'Text Chat Active'}
          </Badge>
        </div>
      </div>

      {/* Render Text Chat Interface for Text Mode */}
      {mode === 'text' ? (
        <div className="space-y-4">
          <TextChatInterface
            initialMatchId={customRoom}
            interests={interests}
            isDevFixture={true}
          />
        </div>
      ) : (
        /* Video Mode: Honest Staged Notice & Device Check */
        <Card className="border-surface-700 bg-surface-900/90 shadow-2xl space-y-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-brand-500/15 text-brand-300 border-brand-500/30">
                <Video className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl">Camera & Audio Setup</CardTitle>
                <CardDescription>
                  Review your session settings before entering the matchmaking queue.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Selected Interests */}
            <div className="space-y-2 rounded-xl border border-surface-800 bg-surface-950/60 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-surface-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                  <span>Selected Topic Preferences</span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-brand-400 hover:text-brand-300 font-medium text-[11px]"
                >
                  Edit on Home
                </button>
              </div>
              {interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {interests.map(t => (
                    <Badge key={t} variant="brand" size="sm">
                      #{t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-surface-500 italic">
                  No specific topics selected. You will be matched with any available partner.
                </p>
              )}
            </div>

            {/* Media Permission Test */}
            <div className="space-y-3 rounded-xl border border-surface-800 bg-surface-950/60 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-white block">
                    Device Permission Check
                  </span>
                  <span className="text-xs text-surface-400">
                    Verify camera and microphone access before WebRTC pairing.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testMediaPermissions}
                  isLoading={testingMedia}
                  className="h-8 gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Check Access</span>
                </Button>
              </div>

              {mediaGranted === true && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                  <Camera className="h-4 w-4 shrink-0" />
                  <Mic className="h-4 w-4 shrink-0" />
                  <span>Camera and microphone permissions verified successfully.</span>
                </div>
              )}

              {mediaGranted === false && (
                <div className="text-xs text-coral-400 bg-coral-500/10 border border-coral-500/20 p-2.5 rounded-lg">
                  <span>Device error: {mediaError}</span>
                </div>
              )}
            </div>

            {/* Real-time Gateway Health Check */}
            <div className="flex items-center justify-between rounded-xl border border-surface-800 bg-surface-950/60 p-3.5">
              <div className="flex items-center gap-3">
                <Wifi className="h-4 w-4 text-surface-400" />
                <div className="text-xs">
                  <span className="font-semibold text-surface-200 block">Signaling Gateway</span>
                  <span className="text-surface-400 font-mono text-[11px]">{config.socketUrl}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator
                  status={
                    socketStatus === 'connected'
                      ? 'online'
                      : socketStatus === 'connecting'
                        ? 'connecting'
                        : 'offline'
                  }
                  label={
                    socketStatus === 'connected'
                      ? `Connected (${socketId?.slice(0, 6)}...)`
                      : socketStatus === 'connecting'
                        ? 'Connecting...'
                        : 'Gateway Offline'
                  }
                />
              </div>
            </div>

            {/* Video Mode Notice */}
            <Alert variant="info" title="Video Chat Pipeline Scheduled for Phase 5">
              <div className="space-y-2">
                <p>
                  Phase 4 implements the <strong>real-time text chat engine</strong>. Full WebRTC
                  audio/video peer stream negotiation is being completed in the upcoming phase.
                </p>
                <Link href="/chat?mode=text">
                  <Button variant="teal" size="sm" className="mt-1 gap-1.5 font-bold">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Try Real-Time Text Chat Now</span>
                  </Button>
                </Link>
              </div>
            </Alert>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Change Mode or Interests
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <Construction className="h-3.5 w-3.5 text-amber-400" />
              <span>WebRTC media pipeline scheduled for Phase 5</span>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Spinner size="lg" variant="brand" />
        </div>
      }
    >
      <ChatSetupContent />
    </Suspense>
  );
}
