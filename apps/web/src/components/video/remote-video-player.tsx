'use client';

import React, { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/loading-indicator';
import { User, VideoOff } from 'lucide-react';

export interface RemoteVideoPlayerProps {
  stream: MediaStream | null;
  connectionState: 'idle' | 'searching' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  className?: string;
}

export function RemoteVideoPlayer({
  stream,
  connectionState,
  className = '',
}: RemoteVideoPlayerProps) {
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

  const hasRemoteVideoTrack = Boolean(
    stream && stream.getVideoTracks().some(track => track.enabled && track.readyState === 'live')
  );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface-950 border border-surface-700/80 shadow-2xl aspect-video flex items-center justify-center ${className}`}
      data-testid="remote-video-player"
    >
      {/* Remote Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          connectionState === 'connected' && stream ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Remote partner video stream"
      />

      {/* State Overlays */}
      {connectionState === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/90 text-surface-400 space-y-3 z-10">
          <Spinner size="lg" variant="brand" />
          <div className="text-center space-y-1">
            <span className="text-sm font-semibold text-white block">
              Establishing WebRTC Call...
            </span>
            <span className="text-xs text-surface-400 block">
              Negotiating peer-to-peer encryption & ICE candidates
            </span>
          </div>
        </div>
      )}

      {connectionState === 'reconnecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/90 text-surface-400 space-y-3 z-10">
          <Spinner size="lg" variant="brand" />
          <span className="text-sm font-semibold text-amber-300">Reconnecting WebRTC media...</span>
        </div>
      )}

      {connectionState === 'connected' && !hasRemoteVideoTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/95 text-surface-400 space-y-2 z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-800 border border-surface-700 text-surface-400">
            <User className="h-8 w-8 text-surface-400" />
          </div>
          <span className="text-sm font-medium text-surface-300">
            Partner is speaking (Audio Only)
          </span>
        </div>
      )}

      {connectionState === 'failed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/95 text-surface-400 space-y-2 z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-500/10 border border-coral-500/30 text-coral-400">
            <VideoOff className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-coral-300">WebRTC connection failed</span>
          <span className="text-xs text-surface-500">Click Next to find another partner</span>
        </div>
      )}

      {/* Top Left Stranger Badge */}
      {connectionState === 'connected' && (
        <div className="absolute top-3 left-3 z-20">
          <Badge variant="teal" size="sm" className="bg-surface-900/80 backdrop-blur-md">
            Stranger
          </Badge>
        </div>
      )}
    </div>
  );
}
