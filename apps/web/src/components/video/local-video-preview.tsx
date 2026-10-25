'use client';

import React, { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { VideoOff, MicOff, User } from 'lucide-react';

export interface LocalVideoPreviewProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  className?: string;
}

export function LocalVideoPreview({
  stream,
  videoEnabled,
  audioEnabled,
  className = '',
}: LocalVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface-950 border border-surface-700/80 shadow-lg aspect-video ${className}`}
      data-testid="local-video-preview"
    >
      {/* Local Video Stream (Mirrored for natural self-view) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
          videoEnabled && stream ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Your local camera preview"
      />

      {/* Camera Off Placeholder Overlay */}
      {(!videoEnabled || !stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/90 text-surface-400 space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-800 border border-surface-700">
            {videoEnabled ? (
              <User className="h-6 w-6 text-surface-400" />
            ) : (
              <VideoOff className="h-6 w-6 text-coral-400" />
            )}
          </div>
          <span className="text-xs font-medium text-surface-300">
            {!stream ? 'Camera offline' : 'Camera turned off'}
          </span>
        </div>
      )}

      {/* Top Left Label */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
        <Badge variant="brand" size="sm" className="bg-surface-900/80 backdrop-blur-md text-[10px]">
          You
        </Badge>
        {!audioEnabled && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-coral-500/80 text-white shadow"
            title="Microphone muted"
          >
            <MicOff className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    </div>
  );
}
