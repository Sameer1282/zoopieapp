'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/components/ui/tag-input';
import { Badge } from '@/components/ui/badge';
import { Video, MessageSquare, ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';

export function HeroChatLauncher() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isNavigating, setIsNavigating] = useState<'video' | 'text' | null>(null);

  const handleStart = (mode: 'video' | 'text') => {
    setIsNavigating(mode);
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (selectedInterests.length > 0) {
      params.set('interests', selectedInterests.join(','));
    }
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <Card className="border-surface-700/80 bg-surface-900/90 shadow-2xl p-6 sm:p-8 space-y-6 max-w-2xl mx-auto backdrop-blur-xl">
      {/* Top Selector Header */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-teal-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Start a Spontaneous Conversation
            </h2>
          </div>
          <Badge variant="teal" size="sm" className="gap-1">
            <Shield className="h-3 w-3" />
            No account required
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-surface-400">
          Pick your preferred medium and optionally add topics to find partners with similar
          interests.
        </p>
      </div>

      {/* Mode Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Video Chat */}
        <div className="relative group rounded-2xl border border-brand-500/30 bg-gradient-to-b from-brand-950/40 to-surface-950/80 p-5 space-y-4 hover:border-brand-500/60 transition-all shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <Video className="h-6 w-6" />
            </div>
            <Badge variant="brand" size="sm">
              Camera + Mic
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Video & Audio Chat</h3>
            <p className="text-xs text-surface-400 mt-1 leading-relaxed">
              Camera-to-camera real-time connection. High-definition peer-to-peer WebRTC streams.
            </p>
          </div>
          <Button
            variant="brand"
            size="lg"
            className="w-full gap-2 shadow-glow"
            onClick={() => handleStart('video')}
            isLoading={isNavigating === 'video'}
            disabled={isNavigating !== null}
          >
            <span>Start Video Chat</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Start Text Chat */}
        <div className="relative group rounded-2xl border border-surface-700/80 bg-gradient-to-b from-surface-850/50 to-surface-950/80 p-5 space-y-4 hover:border-teal-500/40 transition-all shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 border border-teal-500/30">
              <MessageSquare className="h-6 w-6" />
            </div>
            <Badge variant="teal" size="sm">
              Keyboard Only
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Pure Text Chat</h3>
            <p className="text-xs text-surface-400 mt-1 leading-relaxed">
              Fast, anonymous text-only conversations. Low bandwidth and zero camera permission.
            </p>
          </div>
          <Button
            variant="teal"
            size="lg"
            className="w-full gap-2 shadow-glow-teal text-surface-950 font-bold"
            onClick={() => handleStart('text')}
            isLoading={isNavigating === 'text'}
            disabled={isNavigating !== null}
          >
            <span>Start Text Chat</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Optional Interests Input */}
      <div className="pt-2 border-t border-surface-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-surface-200 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span>Optional Shared Interests</span>
          </label>
          <span className="text-surface-400 text-[11px]">
            {selectedInterests.length > 0
              ? `${selectedInterests.length} selected`
              : 'Matches any if empty'}
          </span>
        </div>
        <TagInput
          tags={selectedInterests}
          onChange={setSelectedInterests}
          placeholder="Add tags (e.g. Gaming, Music, Coding)..."
        />
      </div>

      {/* Trust & Transparency Note */}
      <div className="flex items-center justify-between text-[11px] text-surface-400 px-1 pt-1">
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-amber-400" />
          <span>Instant matching</span>
        </span>
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3 text-teal-400" />
          <span>Encrypted direct streams</span>
        </span>
        <span>Skip anytime</span>
      </div>
    </Card>
  );
}
