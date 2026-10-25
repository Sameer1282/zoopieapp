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
} from '@zoopie/shared';
import { config } from '@/lib/config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Alert } from '@/components/ui/alert';
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
} from 'lucide-react';

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
}

export function TextChatInterface({
  initialMatchId = 'dev-match-room-1',
  interests = [],
  isDevFixture = true,
}: TextChatInterfaceProps) {
  const [matchId, setMatchId] = useState(initialMatchId);
  const [roomInput, setRoomInput] = useState(initialMatchId);
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

  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [matchState, setMatchState] = useState<'waiting' | 'active' | 'ended'>('waiting');
  const [endReason, setEndReason] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, peerTyping, scrollToBottom]);

  // Connect to Socket.IO and Join Match Room
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
      // Join the match room
      socket.emit(SOCKET_EVENTS.JOIN_MATCH, {
        matchId,
        sessionId,
      });
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on(SOCKET_EVENTS.MATCH_JOINED, payload => {
      if (payload.peerConnected) {
        setMatchState('active');
        setMessages(prev => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            content: 'Connected to peer. Say hello!',
            sender: 'system',
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMatchState('waiting');
      }
    });

    socket.on(SOCKET_EVENTS.PEER_JOINED, () => {
      setMatchState('active');
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

    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ReceiveMessagePayload) => {
      setPeerTyping(false);
      setMessages(prev => {
        // Deduplicate incoming message ID
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
      setMatchState('ended');
      setEndReason(
        payload.reason === 'peer_disconnected'
          ? 'Your partner disconnected from the session.'
          : 'Your partner left the conversation.'
      );
    });

    socket.on(SOCKET_EVENTS.MATCH_ENDED, (payload: MatchEndedPayload) => {
      setMatchState('ended');
      setEndReason(
        payload.reason === 'peer_disconnected'
          ? 'Peer disconnected'
          : payload.reason === 'peer_left'
            ? 'Peer left the match'
            : 'Session ended'
      );
    });

    socket.on(SOCKET_EVENTS.ERROR, err => {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          content: `Socket error: ${err.message}`,
          sender: 'system',
          status: 'failed',
          timestamp: Date.now(),
        },
      ]);
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit(SOCKET_EVENTS.LEAVE_MATCH, { matchId });
      socket.disconnect();
    };
  }, [matchId, sessionId]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (socketRef.current?.connected && matchState === 'active') {
      socketRef.current.emit(SOCKET_EVENTS.TYPING_INDICATOR, {
        matchId,
        isTyping: val.length > 0,
      });
    }
  };

  // Send message handler
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputValue.trim();
    if (!content) return;
    if (content.length > MAX_MESSAGE_LENGTH) return;
    if (!socketRef.current?.connected || matchState !== 'active') return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    // Optimistically add message with 'sending' status
    const optimisticMessage: ChatMessage = {
      id: messageId,
      content,
      sender: 'me',
      status: 'sending',
      timestamp: now,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setInputValue('');

    // Clear typing state
    socketRef.current.emit(SOCKET_EVENTS.TYPING_INDICATOR, {
      matchId,
      isTyping: false,
    });

    // Emit message to server
    socketRef.current.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      matchId,
      messageId,
      content,
      clientTimestamp: now,
    });
  };

  const handleSwitchRoom = () => {
    if (roomInput.trim() && roomInput.trim() !== matchId) {
      setMessages([]);
      setMatchState('waiting');
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
      {/* Top Header: Session & Status Info */}
      <div className="border-b border-surface-800 bg-surface-950/80 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <StatusIndicator
            status={
              connectionStatus !== 'connected'
                ? 'offline'
                : matchState === 'active'
                  ? 'online'
                  : 'connecting'
            }
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {matchState === 'active'
                  ? 'Active Conversation'
                  : matchState === 'waiting'
                    ? 'Waiting for Peer'
                    : 'Session Ended'}
              </h3>
              {isDevFixture && (
                <Badge variant="teal" size="sm" className="text-[10px]">
                  Dev Fixture Match
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-surface-400 font-mono">Room: {matchId}</span>
          </div>
        </div>

        {/* Fixture Controls: Room Switch & Copy Link */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={copyRoomLink}
            className="h-7 text-xs px-2.5 gap-1.5"
            title="Copy link to test in another tab"
          >
            {copiedLink ? (
              <Check className="h-3 w-3 text-teal-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copiedLink ? 'Copied' : 'Share Tab Link'}</span>
          </Button>
        </div>
      </div>

      {/* Topics Header (if any) */}
      {interests.length > 0 && (
        <div className="border-b border-surface-800/80 bg-surface-900/50 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-surface-400 text-[11px] shrink-0">Topics:</span>
          {interests.map(t => (
            <Badge key={t} variant="brand" size="sm">
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {/* Main Messages Viewport */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 font-sans"
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        {matchState === 'waiting' && (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-xl border border-surface-800/80 bg-surface-950/40">
            <Radio className="h-8 w-8 text-brand-400 animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-white">Waiting for a partner to join...</h4>
              <p className="text-xs text-surface-400 max-w-sm">
                Open this link in another private window or tab to test real-time message exchange
                between two independent clients.
              </p>
            </div>
            <Button size="sm" variant="brand" onClick={copyRoomLink} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Copy Direct Peer Link</span>
            </Button>
          </div>
        )}

        {/* Message Stream */}
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
                {/* Safe plain text rendering preventing any HTML execution */}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              </div>

              {/* Status and Timestamp */}
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
                    {msg.status === 'delivered' && <CheckCheck className="h-3 w-3 text-teal-400" />}
                    {msg.status === 'failed' && (
                      <span className="flex items-center gap-1 text-coral-400" title={msg.error}>
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

        {/* Peer Typing Indicator */}
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

        <div ref={messagesEndRef} />
      </div>

      {/* Match Ended Banner */}
      {matchState === 'ended' && (
        <div className="p-3 bg-surface-950 border-t border-surface-800">
          <Alert variant="warning" title="Conversation Ended">
            <div className="flex items-center justify-between gap-4">
              <span>{endReason || 'This session has concluded.'}</span>
              <Button
                size="sm"
                variant="brand"
                onClick={() => {
                  setMatchId(`dev-match-${Math.random().toString(36).slice(2, 7)}`);
                  setMessages([]);
                  setMatchState('waiting');
                  setEndReason(null);
                }}
              >
                Find New Match
              </Button>
            </div>
          </Alert>
        </div>
      )}

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
            disabled={connectionStatus !== 'connected' || matchState !== 'active'}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              connectionStatus !== 'connected'
                ? 'Signaling gateway connecting...'
                : matchState === 'waiting'
                  ? 'Waiting for partner before sending...'
                  : matchState === 'ended'
                    ? 'Conversation ended'
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
              !inputValue.trim() || connectionStatus !== 'connected' || matchState !== 'active'
            }
            className="h-10 px-4 shrink-0 gap-1.5"
            aria-label="Send message"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Character Counter & Helper */}
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

      {/* Test Fixture Room Switcher Accordion (Bottom) */}
      {isDevFixture && (
        <div className="border-t border-surface-800/80 bg-surface-950/90 px-4 py-2 flex items-center justify-between text-xs text-surface-400">
          <div className="flex items-center gap-2">
            <span className="text-[11px]">Switch Room:</span>
            <input
              type="text"
              value={roomInput}
              onChange={e => setRoomInput(e.target.value)}
              className="rounded border border-surface-800 bg-surface-900 px-2 py-0.5 text-xs text-surface-200 w-36 font-mono"
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
            Phase 4 Test Fixture Harness
          </span>
        </div>
      )}
    </Card>
  );
}
