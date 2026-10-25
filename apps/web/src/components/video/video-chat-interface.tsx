'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type MatchFoundPayload,
  type WebRtcOfferPayload,
  type WebRtcAnswerPayload,
  type WebRtcIceCandidatePayload,
  type QueueStatusPayload,
  type QueueTimeoutPayload,
} from '@zoopie/shared';
import { config } from '@/lib/config';
import { fetchIceServers, getSafeDiagnostics, type WebRtcDiagnostics } from '@/lib/webrtc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Alert } from '@/components/ui/alert';
import { LocalVideoPreview } from './local-video-preview';
import { RemoteVideoPlayer } from './remote-video-player';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  RotateCw,
  Square,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Camera,
  Flag,
  Ban,
} from 'lucide-react';
import { TermsAgreementModal, TERMS_STORAGE_KEY } from '@/components/safety/terms-agreement-modal';
import { ReportDialog } from '@/components/safety/report-dialog';

export type VideoCallConnectionState =
  | 'permission-gate'
  | 'requesting-permission'
  | 'searching'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected';

export interface VideoChatInterfaceProps {
  initialMatchId?: string;
  interests?: string[];
  isDevFixture?: boolean;
}

export function VideoChatInterface({
  initialMatchId = 'dev-video-room-1',
  interests = [],
  isDevFixture: _isDevFixture = false,
}: VideoChatInterfaceProps) {
  const [matchId, setMatchId] = useState(initialMatchId);
  const [commonInterests, setCommonInterests] = useState<string[]>([]);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('zoopie_session_id');
      if (stored) return stored;
      const created = crypto.randomUUID();
      sessionStorage.setItem('zoopie_session_id', created);
      return created;
    }
    return crypto.randomUUID();
  });

  // Call connection states: requesting-permission, connecting, connected, reconnecting, failed, disconnected
  const [callState, setCallState] = useState<VideoCallConnectionState>('permission-gate');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);

  // Local media tracks
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Check 18+ Terms Agreement on initial mount
  useEffect(() => {
    try {
      const accepted = localStorage.getItem(TERMS_STORAGE_KEY);
      if (!accepted) {
        setIsTermsOpen(true);
      }
    } catch {
      // Storage fallback
    }
  }, []);

  // Diagnostic panel toggle
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<WebRtcDiagnostics | null>(null);

  // References
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const isPoliteRef = useRef<boolean>(false);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);

  const localStreamRef = useRef<MediaStream | null>(null);

  // Tear down peer connection cleanly
  const teardownPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateBufferRef.current = [];
    setRemoteStream(null);
  }, []);

  // Stop local media tracks completely
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
  }, []);

  // Request camera and microphone access deliberately upon user interaction
  const requestMediaPermissions = async () => {
    setCallState('requesting-permission');
    setPermissionError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCallState('failed');
      setPermissionError(
        'Your current browser does not support WebRTC media devices. Please update or use a modern browser.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setVideoEnabled(true);
      setAudioEnabled(true);
      setCallState('searching');

      // Enter matchmaking queue for video mode
      if (socketRef.current?.connected) {
        socketRef.current.emit(SOCKET_EVENTS.QUEUE_JOIN, {
          sessionId,
          mode: 'video',
          interests,
        });
      }
    } catch (err: unknown) {
      setCallState('permission-gate');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError(
            'Camera and microphone permissions were denied. Please allow camera and microphone access in your browser settings to continue.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setPermissionError(
            'No camera or microphone hardware found on this device. Please connect a webcam or headset.'
          );
        } else {
          setPermissionError(`Media access error: ${err.message}`);
        }
      } else {
        setPermissionError('Unable to access media devices. Please check permissions.');
      }
    }
  };

  // Toggle Microphone (Mute/Unmute)
  const handleToggleAudio = () => {
    setAudioEnabled(prev => {
      const next = !prev;
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = next;
        }
      }
      return next;
    });
  };

  // Toggle Camera (Enable/Disable)
  const handleToggleVideo = () => {
    setVideoEnabled(prev => {
      const next = !prev;
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = next;
        }
      }
      return next;
    });
  };

  // Setup RTCPeerConnection with Perfect Negotiation Pattern
  const initializePeerConnection = useCallback(
    async (currentMatchId: string, role: 'initiator' | 'receiver') => {
      teardownPeerConnection();

      const iceServers = await fetchIceServers();
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 2,
      });
      peerConnectionRef.current = pc;

      // Perfect negotiation: receiver is polite, initiator is impolite
      isPoliteRef.current = role === 'receiver';

      // 1. Attach local tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // 2. Handle remote tracks
      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          const stream = new MediaStream();
          stream.addTrack(event.track);
          setRemoteStream(stream);
        }
      };

      // 3. Handle local ICE candidates -> emit to signaling server
      pc.onicecandidate = event => {
        if (event.candidate && socketRef.current?.connected) {
          socketRef.current.emit(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, {
            matchId: currentMatchId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment,
            },
          });
        }
      };

      // 4. Handle connection state changes
      pc.onconnectionstatechange = () => {
        setDiagnostics(getSafeDiagnostics(pc, localStream, remoteStream));
        if (pc.connectionState === 'connected') {
          setCallState('connected');
        } else if (pc.connectionState === 'connecting') {
          setCallState('connecting');
        } else if (pc.connectionState === 'failed') {
          setCallState('failed');
        } else if (pc.connectionState === 'disconnected') {
          setCallState('reconnecting');
        }
      };

      pc.oniceconnectionstatechange = () => {
        setDiagnostics(getSafeDiagnostics(pc, localStream, remoteStream));
        if (pc.iceConnectionState === 'disconnected') {
          setCallState('reconnecting');
        } else if (pc.iceConnectionState === 'failed') {
          setCallState('failed');
        }
      };

      // 5. Perfect Negotiation: negotiationneeded
      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current = true;
          const offer = await pc.createOffer();

          if (pc.signalingState !== 'stable') return;

          await pc.setLocalDescription(offer);

          if (socketRef.current?.connected) {
            socketRef.current.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
              matchId: currentMatchId,
              sdp: offer.sdp || '',
              type: 'offer',
            });
          }
        } catch (err) {
          console.error('[WebRTC] Negotiation error:', err);
        } finally {
          makingOfferRef.current = false;
        }
      };

      // If initiator role, start negotiation offer
      if (role === 'initiator') {
        try {
          makingOfferRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current?.connected) {
            socketRef.current.emit(SOCKET_EVENTS.SIGNAL_OFFER, {
              matchId: currentMatchId,
              sdp: offer.sdp || '',
              type: 'offer',
            });
          }
        } catch (err) {
          console.error('[WebRTC] Initiator offer error:', err);
        } finally {
          makingOfferRef.current = false;
        }
      }

      setDiagnostics(getSafeDiagnostics(pc, localStream, remoteStream));
    },
    [localStream, teardownPeerConnection, remoteStream]
  );

  const initializePeerConnectionRef = useRef(initializePeerConnection);
  initializePeerConnectionRef.current = initializePeerConnection;

  const teardownPeerConnectionRef = useRef(teardownPeerConnection);
  teardownPeerConnectionRef.current = teardownPeerConnection;

  // Initialize Socket.IO connection and attach WebRTC signaling listeners
  useEffect(() => {
    const socket = io(config.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      forceNew: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // 1. Match Found
    socket.on(SOCKET_EVENTS.MATCH_FOUND, (payload: MatchFoundPayload) => {
      setMatchId(payload.matchId);
      setCommonInterests(payload.commonInterests);
      setCallState('connecting');
      initializePeerConnectionRef.current(payload.matchId, payload.role);
    });

    // 2. Incoming WebRTC Offer (Perfect Negotiation with Glare Handling)
    socket.on(SOCKET_EVENTS.SIGNAL_OFFER, async (payload: WebRtcOfferPayload) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      const readyForOffer =
        !makingOfferRef.current && (pc.signalingState === 'stable' || isPoliteRef.current);

      const offerCollision = !readyForOffer;
      ignoreOfferRef.current = !isPoliteRef.current && offerCollision;

      if (ignoreOfferRef.current) {
        return; // Impolite peer ignores collision offer
      }

      try {
        if (isPoliteRef.current && pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload));

        // Flush buffered ICE candidates
        while (iceCandidateBufferRef.current.length > 0) {
          const candidate = iceCandidateBufferRef.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit(SOCKET_EVENTS.SIGNAL_ANSWER, {
          matchId: payload.matchId,
          sdp: answer.sdp || '',
          type: 'answer',
        });
      } catch (err) {
        console.error('[WebRTC] Handle offer error:', err);
      }
    });

    // 3. Incoming WebRTC Answer
    socket.on(SOCKET_EVENTS.SIGNAL_ANSWER, async (payload: WebRtcAnswerPayload) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));

        // Flush buffered ICE candidates
        while (iceCandidateBufferRef.current.length > 0) {
          const candidate = iceCandidateBufferRef.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.error('[WebRTC] Handle answer error:', err);
      }
    });

    // 4. Incoming ICE Candidate
    socket.on(SOCKET_EVENTS.SIGNAL_ICE_CANDIDATE, async (payload: WebRtcIceCandidatePayload) => {
      const pc = peerConnectionRef.current;
      if (!pc || ignoreOfferRef.current) return;

      try {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          // Buffer candidate until remote description is set
          iceCandidateBufferRef.current.push(payload.candidate);
        }
      } catch (err) {
        console.error('[WebRTC] Add ICE candidate error:', err);
      }
    });

    // 5. Match Ended / Peer Departure
    socket.on(SOCKET_EVENTS.PEER_LEFT, payload => {
      teardownPeerConnectionRef.current();
      setCallState('disconnected');
      setEndReason(
        payload.reason === 'skip'
          ? 'Your partner skipped to the next conversation.'
          : payload.reason === 'peer_disconnected'
            ? 'Your partner disconnected.'
            : 'Your partner left the video chat.'
      );
    });

    socket.on(SOCKET_EVENTS.MATCH_ENDED, payload => {
      teardownPeerConnectionRef.current();
      setCallState('disconnected');
      setEndReason(
        payload.reason === 'skip'
          ? 'Partner skipped'
          : payload.reason === 'peer_disconnected'
            ? 'Partner disconnected'
            : 'Video call ended'
      );
    });

    socket.on(SOCKET_EVENTS.QUEUE_STATUS, (payload: QueueStatusPayload) => {
      if (payload.status === 'searching' || payload.status === 'waiting') {
        setCallState('searching');
      } else if (payload.status === 'timeout') {
        setCallState('failed');
        setPermissionError('No video partners available right now. You can try again.');
      }
    });

    socket.on(SOCKET_EVENTS.QUEUE_TIMEOUT, (payload: QueueTimeoutPayload) => {
      setCallState('failed');
      setPermissionError(payload.message);
    });

    return () => {
      teardownPeerConnectionRef.current();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (typeof socket.removeAllListeners === 'function') {
        socket.removeAllListeners();
      }
      socket.disconnect();
    };
  }, []);

  // Next / Skip: closes old call and re-enters video queue
  const handleSkip = () => {
    teardownPeerConnection();
    setCallState('searching');
    setEndReason(null);

    if (socketRef.current?.connected) {
      socketRef.current.emit(SOCKET_EVENTS.MATCH_SKIP, {
        sessionId,
        currentMatchId: matchId,
        mode: 'video',
        interests,
      });
    }
  };

  // Stop: leaves match and queue, stops local tracks, resets to permission gate
  const handleStop = () => {
    teardownPeerConnection();
    stopLocalMedia();
    setCallState('permission-gate');
    setEndReason(null);

    if (socketRef.current?.connected) {
      socketRef.current.emit(SOCKET_EVENTS.MATCH_STOP, {
        sessionId,
        currentMatchId: matchId,
      });
    }
  };

  // Block: records block, ends call immediately and skips
  const handleBlockPeer = async () => {
    if (
      typeof window !== 'undefined' &&
      window.confirm(
        'Block this participant? You will immediately leave this video call and will not be matched with them again.'
      )
    ) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        await fetch(`${apiUrl}/api/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockerSessionId: sessionId,
            blockedFingerprint: matchId,
            reason: 'User blocked during video call',
          }),
        });
      } catch {
        // Block API fallback
      }
      handleSkip();
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 1. Pre-call Deliberate Permission Gate */}
      {callState === 'permission-gate' && (
        <Card className="border-surface-700 bg-surface-900/90 shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-brand-500/15 text-brand-300 border-brand-500/30">
              <Video className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Camera & Microphone Permission
              </h3>
              <p className="text-sm text-surface-400 leading-relaxed">
                Zoopie uses direct peer-to-peer WebRTC technology to connect you with video
                partners. Your media streams travel directly between you and your partner and are
                never recorded, proxied, or stored on our servers.
              </p>
            </div>
          </div>

          {permissionError && (
            <Alert variant="error" title="Permission Notice">
              <span>{permissionError}</span>
            </Alert>
          )}

          <div className="rounded-xl border border-surface-800 bg-surface-950/60 p-4 space-y-2 text-xs text-surface-400">
            <div className="flex items-center gap-2 text-surface-300 font-semibold">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              <span>Privacy & Device Safety</span>
            </div>
            <p>
              You will always have direct controls to mute your microphone or turn off your webcam
              at any moment during the call.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="lg"
              variant="brand"
              onClick={requestMediaPermissions}
              className="gap-2 px-6 shadow-lg shadow-brand-500/20"
            >
              <Camera className="h-4 w-4" />
              <span>Enable Camera & Mic</span>
            </Button>
          </div>
        </Card>
      )}

      {/* 2. Active Video Interface */}
      {callState !== 'permission-gate' && (
        <Card className="border-surface-700 bg-surface-900/95 shadow-2xl p-4 sm:p-6 space-y-4">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-surface-800">
            <div className="flex items-center gap-2.5">
              <StatusIndicator
                status={
                  callState === 'connected'
                    ? 'online'
                    : callState === 'searching' || callState === 'connecting'
                      ? 'connecting'
                      : 'offline'
                }
              />
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>
                    {callState === 'connected' && 'Live Video Chat'}
                    {callState === 'connecting' && 'Establishing Peer Media...'}
                    {callState === 'searching' && 'Searching for Video Partner...'}
                    {callState === 'reconnecting' && 'Reconnecting Peer Media...'}
                    {callState === 'failed' && 'WebRTC Connection Failed'}
                    {callState === 'disconnected' && 'Call Concluded'}
                  </span>
                  {callState === 'connected' && (
                    <Badge variant="teal" size="sm" className="text-[10px] animate-pulse">
                      Encrypted P2P
                    </Badge>
                  )}
                </h4>
                {commonInterests.length > 0 && callState === 'connected' && (
                  <span className="text-[11px] text-teal-400">
                    Shared topics: {commonInterests.map(t => `#${t}`).join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* In-Call Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                className="h-8 text-xs px-3 gap-1.5"
                title="Next partner"
              >
                <RotateCw className="h-3 w-3 text-brand-400" />
                <span>Next</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStop}
                className="h-8 text-xs px-3 gap-1.5 text-coral-400 hover:text-white"
                title="Stop call"
              >
                <Square className="h-3 w-3" />
                <span>Stop</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsReportOpen(true)}
                className="h-8 text-xs px-2.5 gap-1 text-surface-400 hover:text-amber-400"
                title="Report participant"
              >
                <Flag className="h-3 w-3 text-amber-400" />
                <span className="hidden sm:inline">Report</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleBlockPeer}
                className="h-8 text-xs px-2.5 gap-1 text-surface-400 hover:text-red-400"
                title="Block participant"
              >
                <Ban className="h-3 w-3 text-red-400" />
                <span className="hidden sm:inline">Block</span>
              </Button>
            </div>
          </div>

          {/* Video Streams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Remote Partner Video */}
            <RemoteVideoPlayer
              stream={remoteStream}
              connectionState={
                callState === 'connected'
                  ? 'connected'
                  : callState === 'connecting'
                    ? 'connecting'
                    : callState === 'reconnecting'
                      ? 'reconnecting'
                      : callState === 'failed'
                        ? 'failed'
                        : 'searching'
              }
              className="w-full"
            />

            {/* Local User Preview */}
            <LocalVideoPreview
              stream={localStream}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              className="w-full"
            />
          </div>

          {/* In-Call Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {/* Mic Toggle */}
              <Button
                size="sm"
                variant={audioEnabled ? 'outline' : 'destructive'}
                onClick={handleToggleAudio}
                className="gap-2"
                aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
              </Button>

              {/* Camera Toggle */}
              <Button
                size="sm"
                variant={videoEnabled ? 'outline' : 'destructive'}
                onClick={handleToggleVideo}
                className="gap-2"
                aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                <span>{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
              </Button>
            </div>

            {/* Diagnostics Toggle */}
            <button
              type="button"
              onClick={() => setShowDiagnostics(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Diagnostics</span>
              {showDiagnostics ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Notification / End Reason */}
          {endReason && (
            <Alert variant="warning" title="Session Update">
              <div className="flex items-center justify-between gap-4">
                <span>{endReason}</span>
                <Button size="sm" variant="brand" onClick={handleSkip}>
                  Find Next Partner
                </Button>
              </div>
            </Alert>
          )}

          {/* Safe WebRTC Diagnostics Drawer */}
          {showDiagnostics && diagnostics && (
            <div className="rounded-xl border border-surface-800 bg-surface-950 p-3 space-y-2 text-xs font-mono text-surface-400">
              <div className="text-surface-300 font-semibold flex items-center justify-between">
                <span>WebRTC Peer Diagnostics</span>
                <span className="text-[10px] text-surface-500 font-sans">
                  Private media & IP redacted
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-surface-500 block">Connection:</span>
                  <span className="text-white">{diagnostics.connectionState}</span>
                </div>
                <div>
                  <span className="text-surface-500 block">ICE State:</span>
                  <span className="text-white">{diagnostics.iceConnectionState}</span>
                </div>
                <div>
                  <span className="text-surface-500 block">Signaling:</span>
                  <span className="text-white">{diagnostics.signalingState}</span>
                </div>
                <div>
                  <span className="text-surface-500 block">Gathering:</span>
                  <span className="text-white">{diagnostics.iceGatheringState}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Safety & Reporting Dialogs */}
      <ReportDialog
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        reporterSessionId={sessionId}
        conversationId={matchId}
        onBlockPeer={handleSkip}
      />

      <TermsAgreementModal
        isOpen={isTermsOpen}
        onAccept={() => setIsTermsOpen(false)}
        onDecline={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
      />
    </div>
  );
}
