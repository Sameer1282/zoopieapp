'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/loading-indicator';
import { TextChatInterface } from '@/components/chat/text-chat-interface';
import { VideoChatInterface } from '@/components/video/video-chat-interface';
import { ArrowLeft, Zap, Video } from 'lucide-react';

function ChatSetupContent() {
  const searchParams = useSearchParams();

  const mode = (searchParams.get('mode') === 'text' ? 'text' : 'video') as 'video' | 'text';
  const hasCustomRoom = Boolean(searchParams.get('room'));
  const customRoom = searchParams.get('room') || 'dev-match-room-1';
  const rawInterests = searchParams.get('interests') || '';
  const interests = rawInterests
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

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
          {mode === 'text' ? (
            <Badge variant="teal" size="sm" className="gap-1">
              <Zap className="h-3 w-3" />
              <span>Text Mode</span>
            </Badge>
          ) : (
            <Badge variant="brand" size="sm" className="gap-1">
              <Video className="h-3 w-3" />
              <span>Video P2P</span>
            </Badge>
          )}
          <Badge variant={mode === 'video' ? 'brand' : 'teal'}>
            {mode === 'video' ? 'Video Mode' : 'Text Mode'}
          </Badge>
        </div>
      </div>

      {/* Render Chat Interface based on Mode */}
      {mode === 'text' ? (
        <div className="space-y-4">
          <TextChatInterface
            initialMatchId={customRoom}
            interests={interests}
            isDevFixture={hasCustomRoom}
            autoStartSearch={!hasCustomRoom}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <VideoChatInterface
            initialMatchId={customRoom}
            interests={interests}
            isDevFixture={hasCustomRoom}
          />
        </div>
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
