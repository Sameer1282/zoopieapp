import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LocalVideoPreview } from '../../src/components/video/local-video-preview';
import { RemoteVideoPlayer } from '../../src/components/video/remote-video-player';
import { VideoChatInterface } from '../../src/components/video/video-chat-interface';
import { getSafeDiagnostics } from '../../src/lib/webrtc';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    })),
  };
});

describe('Phase 6: WebRTC Video & Audio Components', () => {
  describe('LocalVideoPreview Component', () => {
    it('renders mirrored video container with local "You" label', () => {
      render(<LocalVideoPreview stream={null} videoEnabled={true} audioEnabled={true} />);

      expect(screen.getByTestId('local-video-preview')).toBeDefined();
      expect(screen.getByText('You')).toBeDefined();
    });

    it('displays camera offline placeholder when video is disabled', () => {
      render(<LocalVideoPreview stream={null} videoEnabled={false} audioEnabled={false} />);

      expect(screen.getByText(/camera turned off|camera offline/i)).toBeDefined();
    });
  });

  describe('RemoteVideoPlayer Component', () => {
    it('displays connecting spinner and state label when establishing peer connection', () => {
      render(<RemoteVideoPlayer stream={null} connectionState="connecting" />);

      expect(screen.getByTestId('remote-video-player')).toBeDefined();
      expect(screen.getByText(/establishing webrtc call/i)).toBeDefined();
    });

    it('displays failure state and advice when connectionState is failed', () => {
      render(<RemoteVideoPlayer stream={null} connectionState="failed" />);

      expect(screen.getByText(/webrtc connection failed/i)).toBeDefined();
      expect(screen.getByText(/click next to find another partner/i)).toBeDefined();
    });
  });

  describe('VideoChatInterface Component', () => {
    it('renders deliberate pre-call permission gate with privacy explanations', () => {
      render(<VideoChatInterface initialMatchId="test-gate-room" />);

      expect(screen.getByText(/camera & microphone permission/i)).toBeDefined();
      expect(screen.getByText(/never recorded, proxied, or stored/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /enable camera & mic/i })).toBeDefined();
    });
  });

  describe('WebRTC Safe Diagnostics', () => {
    it('returns uninitialized safe diagnostics when peer connection is null without throwing', () => {
      const diag = getSafeDiagnostics(null, null, null);

      expect(diag.connectionState).toBe('uninitialized');
      expect(diag.iceConnectionState).toBe('uninitialized');
      expect(diag.localTracksCount).toBe(0);
      expect(diag.remoteTracksCount).toBe(0);
    });
  });
});
