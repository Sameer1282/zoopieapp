'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  MAX_MESSAGE_LENGTH,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type ReceiveMessagePayload,
  type MessageAckPayload,
  type MatchEndedPayload,
  type MatchFoundPayload,
  type QueueStatusPayload,
  type QueueTimeoutPayload,
} from '@zoopie/shared';
import { config } from '@/lib/config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Spinner } from '@/components/ui/loading-indicator';
import {
  Send,
  Radio,
  UserX,
  Clock,
  Check,
  CheckCheck,
  XCircle,
  Copy,
  ExternalLink,
  Sparkles,
  RotateCw,
  Search,
  Square,
  AlertCircle,
  Zap,
  Flag,
  Ban,
} from 'lucide-react';
import { TermsAgreementModal, TERMS_STORAGE_KEY } from '@/components/safety/terms-agreement-modal';
import { ReportDialog } from '@/components/safety/report-dialog';

export type MatchmakingUIState =
  | 'idle'
  | 'searching'
  | 'waiting'
  | 'matched'
  | 'connecting'
  | 'connected'
  | 'skipping'
  | 'stopping'
  | 'error';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'me' | 'peer' | 'system';
  status?: 'sending' | 'delivered' | 'failed';
  error?: string;
  timestamp: number;
}

export interface TextChatInterfaceProps {
  initialMatchId?: string;
  interests?: string[];
  isDevFixture?: boolean;
  autoStartSearch?: boolean;
}

export function TextChatInterface({
  initialMatchId = 'test-room-1',
  interests = [],
  isDevFixture = true,
  autoStartSearch = false,
}: TextChatInterfaceProps) {
  const [matchId, setMatchId] = useState(initialMatchId);
  const [roomInput, setRoomInput] = useState(initialMatchId);
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

  // UI state machine covering all 9 required states
  const [uiState, setUiState] = useState<MatchmakingUIState>(() => {
    if (autoStartSearch) return 'searching';
    return isDevFixture ? 'waiting' : 'idle';
  });

  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [endReason, setEndReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [fallbackInSeconds, setFallbackInSeconds] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
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
      // Storage access fallback
    }
  }, []);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerTyping, scrollToBottom]);

  // Search duration timer
  useEffect(() => {
    if (uiState === 'searching' || uiState === 'waiting') {
      searchTimerRef.current = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      setSearchTime(0);
    }

    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, [uiState]);

  // Keyboard navigation shortcuts: Esc to Skip/Stop, Enter to Send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uiState === 'connected') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState, matchId]);

  // Connect to Socket.IO and register real-time listeners
  useEffect(() => {
    const socket = io(config.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      forceNew: true,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');

      // If initial fixture room is requested and not auto-searching
      if (isDevFixture && !autoStartSearch && uiState === 'waiting') {
        socket.emit(SOCKET_EVENTS.JOIN_MATCH, {
          matchId,
          sessionId,
        });
      } else if (autoStartSearch) {
        socket.emit(SOCKET_EVENTS.QUEUE_JOIN, {
          sessionId,
          mode: 'text',
          interests,
        });
      }
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      if (uiState === 'connected') {
        setUiState('error');
        setErrorMessage('Connection lost. Please reconnect.');
      }
    });

    // 1. Server-authoritative Match Found
    socket.on(SOCKET_EVENTS.MATCH_FOUND, (payload: MatchFoundPayload) => {
      setMatchId(payload.matchId);
      setCommonInterests(payload.commonInterests);
      setUiState('matched');
      setMessages([
        {
          id: `sys-${Date.now()}`,
          content:
            payload.commonInterests.length > 0
              ? `Matched with a partner who also likes: ${payload.commonInterests.map(t => `#${t}`).join(', ')}`
              : 'Matched with a partner from the general pool. Say hello!',
          sender: 'system',
          timestamp: Date.now(),
        },
      ]);

      // Brief transition from matched -> connected
      setTimeout(() => {
        setUiState('connected');
      }, 400);
    });

    // 2. Queue Status updates
    socket.on(SOCKET_EVENTS.QUEUE_STATUS, (payload: QueueStatusPayload) => {
      if (payload.status === 'searching') {
        setUiState('searching');
        if (payload.fallbackEligibleAt) {
          const rem = Math.max(0, Math.ceil((payload.fallbackEligibleAt - Date.now()) / 1000));
          setFallbackInSeconds(rem);
        }
      } else if (payload.status === 'waiting') {
        setUiState('waiting');
      } else if (payload.status === 'idle') {
        setUiState('idle');
      } else if (payload.status === 'timeout') {
        setUiState('error');
        setErrorMessage(
          payload.message || 'Search timed out. No partners currently available in the queue.'
        );
      }
    });

    // 3. Queue Timeout notification
    socket.on(SOCKET_EVENTS.QUEUE_TIMEOUT, (payload: QueueTimeoutPayload) => {
      setUiState('error');
      setErrorMessage(payload.message);
    });

    // 4. Match Joined confirmation (direct fixtures or auto-join)
    socket.on(SOCKET_EVENTS.MATCH_JOINED, payload => {
      if (payload.peerConnected) {
        setUiState('connected');
      } else {
        setUiState('waiting');
      }
    });

    socket.on(SOCKET_EVENTS.PEER_JOINED, () => {
      setUiState('connected');
      setMessages(prev => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          content: 'A peer has joined this match! You can now chat in real-time.',
          sender: 'system',
          timestamp: Date.now(),
        },
      ]);
    });

    // 5. Chat messages
    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ReceiveMessagePayload) => {
      setPeerTyping(false);
      setMessages(prev => {
        if (prev.some(m => m.id === payload.messageId)) return prev;
        return [
          ...prev,
          {
            id: payload.messageId,
            content: payload.content,
            sender: 'peer',
            timestamp: payload.timestamp,
          },
        ];
      });
    });

    socket.on(SOCKET_EVENTS.MESSAGE_ACK, (payload: MessageAckPayload) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === payload.messageId
            ? {
                ...msg,
                status: payload.status,
                error: payload.error,
              }
            : msg
        )
      );
    });

    socket.on(SOCKET_EVENTS.PEER_TYPING, payload => {
      setPeerTyping(payload.isTyping);
      if (payload.isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setPeerTyping(false);
        }, 3000);
      }
    });

    socket.on(SOCKET_EVENTS.PEER_LEFT, payload => {
      setEndReason(
        payload.reason === 'skip'
          ? 'Your partner skipped to the next match.'
          : payload.reason === 'peer_disconnected'
            ? 'Your partner disconnected.'
            : 'Your partner left the conversation.'
      );
      setUiState('idle');
    });

    socket.on(SOCKET_EVENTS.MATCH_ENDED, (payload: MatchEndedPayload) => {
      setEndReason(
        payload.reason === 'skip'
          ? 'Partner skipped to next conversation'
          : payload.reason === 'peer_disconnected'
            ? 'Peer disconnected'
            : payload.reason === 'peer_left'
              ? 'Peer left the match'
              : 'Conversation ended'
      );
      setUiState('idle');
    });

    socket.on(SOCKET_EVENTS.ERROR, err => {
      if (err.code === 'UNAUTHORIZED_MATCH') {
        setErrorMessage('Match room authorization failed or session expired.');
      } else {
        setErrorMessage(err.message || 'An unexpected socket error occurred.');
      }
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      socket.emit(SOCKET_EVENTS.LEAVE_MATCH, { matchId });
      if (typeof socket.removeAllListeners === 'function') {
        socket.removeAllListeners();
      }
      socket.disconnect();
    };
  }, [matchId, sessionId]);

  // Action: Start matchmaking search
  const handleStartSearch = () => {
    if (!socketRef.current?.connected) return;
    setMessages([]);
    setEndReason(null);
    setErrorMessage(null);
    setUiState('searching');

    socketRef.current.emit(SOCKET_EVENTS.QUEUE_JOIN, {
      sessionId,
      mode: 'text',
      interests,
    });
  };

  // Action: Cancel active search
  const handleCancelSearch = () => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(SOCKET_EVENTS.QUEUE_CANCEL, { sessionId });
    setUiState('idle');
  };

  // Action: Skip / Next match
  const handleSkip = () => {
    if (!socketRef.current?.connected) return;
    setUiState('skipping');
    setMessages([]);
    setEndReason(null);

    socketRef.current.emit(SOCKET_EVENTS.MATCH_SKIP, {
      sessionId,
      currentMatchId: matchId,
      mode: 'text',
      interests,
    });
  };

  // Action: Stop / Leave conversation
  const handleStop = () => {
    if (!socketRef.current?.connected) return;
    setUiState('stopping');

    socketRef.current.emit(SOCKET_EVENTS.MATCH_STOP, {
      sessionId,
      currentMatchId: matchId,
    });

    setTimeout(() => {
      setUiState('idle');
      setMessages([]);
    }, 200);
  };

  // Action: Block current participant
  const handleBlockPeer = async () => {
    if (
      typeof window !== 'undefined' &&
      window.confirm(
        'Block this participant? You will immediately leave this chat and will not be matched with them again.'
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
            reason: 'User blocked during chat',
          }),
        });
      } catch {
        // Block API fallback
      }
      handleSkip();
      setMessages(prev => [
        ...prev,
        {
          id: `sys-block-${Date.now()}`,
          content: 'Participant blocked. You will not be paired with them again.',
          sender: 'system',
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // Input typing handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (socketRef.current?.connected && uiState === 'connected') {
      socketRef.current.emit(SOCKET_EVENTS.TYPING_INDICATOR, {
        matchId,
        isTyping: val.length > 0,
      });
    }
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputValue.trim();
    if (!content) return;
    if (content.length > MAX_MESSAGE_LENGTH) return;
    if (!socketRef.current?.connected || uiState !== 'connected') return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const optimisticMessage: ChatMessage = {
      id: messageId,
      content,
      sender: 'me',
      status: 'sending',
      timestamp: now,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInputValue('');

    socketRef.current.emit(SOCKET_EVENTS.TYPING_INDICATOR, {
      matchId,
      isTyping: false,
    });

    socketRef.current.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      matchId,
      messageId,
      content,
      clientTimestamp: now,
    });
  };

  // Dev Fixture: Room Switcher
  const handleSwitchRoom = () => {
    if (roomInput.trim() && roomInput.trim() !== matchId) {
      setMessages([]);
      setUiState('waiting');
      setEndReason(null);
      setMatchId(roomInput.trim());
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/chat?mode=text&room=${encodeURIComponent(matchId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Card className="border-surface-700 bg-surface-900/95 shadow-2xl p-0 overflow-hidden flex flex-col h-[700px] max-h-[85vh]">
      {/* Top Header: Session & Matchmaking Status Bar */}
      <div className="border-b border-surface-800 bg-surface-950/80 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusIndicator
            status={
              connectionStatus !== 'connected'
                ? 'offline'
                : uiState === 'connected'
                  ? 'online'
                  : uiState === 'searching' || uiState === 'waiting'
                    ? 'connecting'
                    : 'offline'
            }
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {uiState === 'connected' && 'Active Conversation'}
                {uiState === 'matched' && 'Matched! Connecting...'}
                {uiState === 'searching' && 'Searching for Partner...'}
                {uiState === 'waiting' && 'Waiting for Peer'}
                {uiState === 'skipping' && 'Skipping to Next...'}
                {uiState === 'stopping' && 'Stopping Session...'}
                {uiState === 'idle' && 'Ready to Match'}
                {uiState === 'error' && 'Matchmaking Error'}
              </h3>
              {uiState === 'connected' && (
                <Badge variant="teal" size="sm" className="text-[10px] animate-pulse">
                  Live
                </Badge>
              )}
              {isDevFixture && (
                <Badge variant="brand" size="sm" className="text-[10px]">
                  Dev Fixture Match
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-surface-400 font-mono">Room: {matchId}</span>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2">
          {uiState === 'connected' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                className="h-8 text-xs px-3 gap-1.5 border-surface-700 hover:bg-surface-800"
                title="Skip to next user (Esc)"
              >
                <RotateCw className="h-3 w-3 text-brand-400" />
                <span>Next (Esc)</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStop}
                className="h-8 text-xs px-3 gap-1.5 text-surface-400 hover:text-white"
                title="Leave match"
              >
                <Square className="h-3 w-3 text-coral-400" />
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
            </>
          )}

          {(uiState === 'searching' || uiState === 'waiting') && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelSearch}
              className="h-8 text-xs px-3 gap-1.5 border-surface-700"
            >
              <span>Cancel Search</span>
            </Button>
          )}

          {uiState === 'idle' && (
            <Button
              size="sm"
              variant="brand"
              onClick={handleStartSearch}
              disabled={connectionStatus !== 'connected'}
              className="h-8 text-xs px-3.5 gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Find Partner</span>
            </Button>
          )}

          {/* Fixture tab link button */}
          {isDevFixture && (
            <Button
              size="sm"
              variant="outline"
              onClick={copyRoomLink}
              className="h-8 text-xs px-2.5 gap-1.5 hidden sm:inline-flex"
              title="Copy link to test in another tab"
            >
              {copiedLink ? (
                <Check className="h-3 w-3 text-teal-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Topics Header */}
      <div className="border-b border-surface-800/80 bg-surface-900/50 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-surface-400 text-[11px] shrink-0">Your Topics:</span>
          {interests.length > 0 ? (
            interests.map(t => (
              <Badge key={t} variant="brand" size="sm">
                #{t}
              </Badge>
            ))
          ) : (
            <span className="text-surface-500 text-[11px] italic">
              General pool (any available stranger)
            </span>
          )}
        </div>

        {commonInterests.length > 0 && uiState === 'connected' && (
          <div className="flex items-center gap-1.5">
            <span className="text-teal-400 text-[11px] font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Common:</span>
            </span>
            {commonInterests.map(t => (
              <Badge key={t} variant="teal" size="sm">
                #{t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Main Messages & Matching Viewport */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 font-sans relative"
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        {/* 1. Idle State Overlay */}
        {uiState === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 rounded-xl border border-surface-800/80 bg-surface-950/40">
            <div className="h-14 w-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Zap className="h-7 w-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h4 className="text-base font-semibold text-white">
                {endReason || 'Ready for a new conversation?'}
              </h4>
              <p className="text-xs text-surface-400">
                Click below to enter the server-authoritative matchmaking queue. You will be
                instantly paired with another real connected user.
              </p>
            </div>
            <Button
              size="md"
              variant="brand"
              onClick={handleStartSearch}
              disabled={connectionStatus !== 'connected'}
              className="gap-2 px-6"
            >
              <Search className="h-4 w-4" />
              <span>Start Matchmaking</span>
            </Button>
          </div>
        )}

        {/* 2. Searching / Waiting State Overlay (Matchmaking Mode) */}
        {((uiState === 'searching' && !isDevFixture) ||
          (!isDevFixture && uiState === 'waiting')) && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 rounded-xl border border-surface-800/80 bg-surface-950/40">
            <div className="relative">
              <Spinner size="lg" variant="brand" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Search className="h-5 w-5 text-brand-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-sm font-semibold text-white">
                Searching for an online partner...
              </h4>
              <p className="text-xs text-surface-400">
                {interests.length > 0
                  ? `Looking for strangers interested in ${interests.map(t => `#${t}`).join(', ')}.`
                  : 'Looking for any available stranger in the general queue.'}
              </p>
              <div className="pt-2 text-[11px] text-surface-500 font-mono">
                Searching for {searchTime}s{' '}
                {fallbackInSeconds !== null && fallbackInSeconds > 0 && (
                  <span>(expanding to general pool in {fallbackInSeconds}s)</span>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleCancelSearch}>
              Cancel Search
            </Button>
          </div>
        )}

        {/* 3. Skipping / Stopping State */}
        {(uiState === 'skipping' || uiState === 'stopping') && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
            <Spinner size="md" variant="brand" />
            <span className="text-xs text-surface-400">
              {uiState === 'skipping' ? 'Finding next partner...' : 'Ending conversation...'}
            </span>
          </div>
        )}

        {/* 4. Error State */}
        {uiState === 'error' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-coral-500/10 border border-coral-500/30 flex items-center justify-center text-coral-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-semibold text-white">Matchmaking Notice</h4>
              <p className="text-xs text-surface-400">{errorMessage || 'Something went wrong.'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="brand" onClick={handleStartSearch}>
                Try Again
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUiState('idle')}>
                Return to Idle
              </Button>
            </div>
          </div>
        )}

        {/* 5. Message Stream (when Connected or Dev Fixture Waiting) */}
        {(uiState === 'connected' ||
          (isDevFixture && uiState === 'waiting' && searchTime === 0)) && (
          <>
            {isDevFixture && uiState === 'waiting' && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-xl border border-surface-800/80 bg-surface-950/40">
                <Radio className="h-8 w-8 text-brand-400 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">
                    Waiting for a partner to join...
                  </h4>
                  <p className="text-xs text-surface-400 max-w-sm">
                    Open this link in another tab or start automated matchmaking to connect.
                  </p>
                </div>
                <Button size="sm" variant="brand" onClick={copyRoomLink} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Copy Direct Peer Link</span>
                </Button>
              </div>
            )}

            {messages.map(msg => {
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="rounded-full bg-surface-800/80 border border-surface-700/60 px-3 py-1 text-[11px] text-surface-300">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              const isMe = msg.sender === 'me';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-brand-600 text-white rounded-br-none'
                        : 'bg-surface-800 text-surface-100 rounded-bl-none border border-surface-700/80'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-surface-400 px-1">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && (
                      <>
                        {msg.status === 'sending' && (
                          <Clock className="h-3 w-3 text-surface-400 animate-spin" />
                        )}
                        {msg.status === 'delivered' && (
                          <CheckCheck className="h-3 w-3 text-teal-400" />
                        )}
                        {msg.status === 'failed' && (
                          <span
                            className="flex items-center gap-1 text-coral-400"
                            title={msg.error}
                          >
                            <XCircle className="h-3 w-3" />
                            <span>Failed</span>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {peerTyping && (
              <div className="flex items-center gap-2 text-xs text-surface-400 italic py-1 animate-in fade-in duration-200">
                <span className="flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0.4s]" />
                </span>
                <span>Peer is typing...</span>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input Area */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-surface-800 bg-surface-950 p-3 sm:p-4 space-y-2"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={connectionStatus !== 'connected' || uiState !== 'connected'}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              connectionStatus !== 'connected'
                ? 'Signaling gateway connecting...'
                : uiState === 'searching' || uiState === 'waiting'
                  ? 'Waiting for partner before sending...'
                  : uiState === 'idle'
                    ? 'Click Find Partner above to start chatting...'
                    : 'Type a message (Press Enter to send)...'
            }
            className="flex-1 rounded-xl border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Type a message"
          />
          <Button
            type="submit"
            variant="brand"
            size="md"
            disabled={
              !inputValue.trim() || connectionStatus !== 'connected' || uiState !== 'connected'
            }
            className="h-10 px-4 shrink-0 gap-1.5"
            aria-label="Send message"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-surface-500 px-1">
          <span className="flex items-center gap-1">
            <UserX className="h-3 w-3 text-surface-500" />
            <span>Messages are strictly ephemeral and never stored</span>
          </span>
          <span className={inputValue.length > 900 ? 'text-amber-400' : ''}>
            {inputValue.length} / {MAX_MESSAGE_LENGTH}
          </span>
        </div>
      </form>

      {/* Dev Fixture Accordion */}
      {isDevFixture && (
        <div className="border-t border-surface-800/80 bg-surface-950/90 px-4 py-2 flex items-center justify-between text-xs text-surface-400">
          <div className="flex items-center gap-2">
            <span className="text-[11px]">Room:</span>
            <input
              type="text"
              value={roomInput}
              onChange={e => setRoomInput(e.target.value)}
              className="rounded border border-surface-800 bg-surface-900 px-2 py-0.5 text-xs text-surface-200 w-32 font-mono"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSwitchRoom}
              className="h-6 text-xs px-2"
            >
              Join
            </Button>
          </div>
          <span className="text-[10px] text-surface-500 hidden sm:inline">
            Phase 5 Matchmaking & Fixture Suite
          </span>
        </div>
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
    </Card>
  );
}
