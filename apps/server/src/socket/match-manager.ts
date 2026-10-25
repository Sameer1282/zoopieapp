export interface ParticipantInfo {
  socketId: string;
  joinedAt: number;
}

export interface ActiveMatch {
  id: string;
  mode: 'text' | 'video';
  status: 'waiting' | 'active' | 'ended';
  participants: Map<string, ParticipantInfo>; // sessionId -> ParticipantInfo
  createdAt: number;
  expiresAt: number;
  recentMessageIds: Set<string>;
  isDevFixture: boolean;
}

const DEFAULT_MATCH_TTL_MS = 60 * 60 * 1000; // 1 hour max active session
const MAX_DEDUPLICATION_CACHE = 200;

class MatchManager {
  private matches = new Map<string, ActiveMatch>();

  /**
   * Get an active match by ID
   */
  getMatch(matchId: string): ActiveMatch | undefined {
    const match = this.matches.get(matchId);
    if (!match) return undefined;

    // Check expiration
    if (Date.now() > match.expiresAt) {
      match.status = 'ended';
      return match;
    }

    return match;
  }

  /**
   * Create or register a match
   */
  createMatch(
    matchId: string,
    mode: 'text' | 'video' = 'text',
    options?: { isDevFixture?: boolean; ttlMs?: number }
  ): ActiveMatch {
    const now = Date.now();
    const match: ActiveMatch = {
      id: matchId,
      mode,
      status: 'waiting',
      participants: new Map(),
      createdAt: now,
      expiresAt: now + (options?.ttlMs || DEFAULT_MATCH_TTL_MS),
      recentMessageIds: new Set(),
      isDevFixture: options?.isDevFixture ?? false,
    };

    this.matches.set(matchId, match);
    return match;
  }

  /**
   * Ensure a development or test fixture match exists
   */
  ensureDevFixtureMatch(matchId: string, mode: 'text' | 'video' = 'text'): ActiveMatch {
    const existing = this.getMatch(matchId);
    if (existing && existing.status !== 'ended') {
      return existing;
    }
    return this.createMatch(matchId, mode, { isDevFixture: true });
  }

  /**
   * Join a match. A match strictly accommodates up to 2 participants.
   */
  joinMatch(
    matchId: string,
    sessionId: string,
    socketId: string
  ): {
    success: boolean;
    role: 'initiator' | 'receiver';
    peerConnected: boolean;
    peerSocketId?: string;
    error?: string;
  } {
    let match = this.getMatch(matchId);

    // In development/test mode, auto-provision test matches
    if (!match && (matchId.startsWith('test-') || matchId.startsWith('dev-'))) {
      match = this.createMatch(matchId, 'text', { isDevFixture: true });
    }

    if (!match) {
      return {
        success: false,
        role: 'initiator',
        peerConnected: false,
        error: 'Match does not exist',
      };
    }

    if (match.status === 'ended') {
      return {
        success: false,
        role: 'initiator',
        peerConnected: false,
        error: 'Match has already ended',
      };
    }

    // Check if user is already an existing participant (e.g. reconnecting)
    if (match.participants.has(sessionId)) {
      match.participants.set(sessionId, { socketId, joinedAt: Date.now() });
      const peerSocketId = this.getPeerSocketId(match, sessionId);
      return {
        success: true,
        role: match.participants.size === 1 ? 'initiator' : 'receiver',
        peerConnected: Boolean(peerSocketId),
        peerSocketId,
      };
    }

    // Enforce two-participant ceiling
    if (match.participants.size >= 2) {
      return {
        success: false,
        role: 'initiator',
        peerConnected: false,
        error: 'Match room is full',
      };
    }

    const isFirst = match.participants.size === 0;
    match.participants.set(sessionId, { socketId, joinedAt: Date.now() });

    if (match.participants.size === 2) {
      match.status = 'active';
    }

    const peerSocketId = this.getPeerSocketId(match, sessionId);

    return {
      success: true,
      role: isFirst ? 'initiator' : 'receiver',
      peerConnected: Boolean(peerSocketId),
      peerSocketId,
    };
  }

  /**
   * Leave a match
   */
  leaveMatch(
    matchId: string,
    sessionId: string
  ): {
    matchEnded: boolean;
    peerSocketId?: string;
  } {
    const match = this.getMatch(matchId);
    if (!match) return { matchEnded: false };

    const peerSocketId = this.getPeerSocketId(match, sessionId);
    match.participants.delete(sessionId);
    match.status = 'ended';

    return {
      matchEnded: true,
      peerSocketId,
    };
  }

  /**
   * Check if a session is an authorized participant in an active match
   */
  isAuthorizedParticipant(matchId: string, sessionId: string): boolean {
    const match = this.getMatch(matchId);
    if (!match) return false;
    if (match.status !== 'active' && match.status !== 'waiting') return false;
    return match.participants.has(sessionId);
  }

  /**
   * Get the socket ID of the peer in the match
   */
  getPeerSocketId(match: ActiveMatch, senderSessionId: string): string | undefined {
    for (const [sessionId, info] of match.participants.entries()) {
      if (sessionId !== senderSessionId) {
        return info.socketId;
      }
    }
    return undefined;
  }

  /**
   * Record message ID to prevent duplicate delivery.
   * Returns true if newly recorded, false if duplicate.
   */
  recordMessageId(matchId: string, messageId: string): boolean {
    const match = this.getMatch(matchId);
    if (!match) return false;

    if (match.recentMessageIds.has(messageId)) {
      return false; // Duplicate
    }

    match.recentMessageIds.add(messageId);

    // Prune oldest if cache exceeds limit
    if (match.recentMessageIds.size > MAX_DEDUPLICATION_CACHE) {
      const first = match.recentMessageIds.values().next().value;
      if (first) match.recentMessageIds.delete(first);
    }

    return true;
  }

  /**
   * Remove ended and expired matches periodically
   */
  cleanup(): void {
    const now = Date.now();
    for (const [id, match] of this.matches.entries()) {
      if (match.status === 'ended' || now > match.expiresAt) {
        this.matches.delete(id);
      }
    }
  }

  /**
   * Reset for test suites
   */
  reset(): void {
    this.matches.clear();
  }
}

export const matchManager = new MatchManager();
