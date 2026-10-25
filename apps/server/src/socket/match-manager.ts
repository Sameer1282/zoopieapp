export interface ParticipantInfo {
  socketId: string;
  joinedAt: number;
}

export interface ActiveMatch {
  id: string;
  mode: 'text' | 'video';
  status: 'waiting' | 'active' | 'ended';
  participants: Map<string, ParticipantInfo>; // sessionId -> ParticipantInfo
  commonInterests: string[];
  createdAt: number;
  expiresAt: number;
  recentMessageIds: Set<string>;
  isDevFixture: boolean;
}

const DEFAULT_MATCH_TTL_MS = 60 * 60 * 1000; // 1 hour max active session
const MAX_DEDUPLICATION_CACHE = 200;

class MatchManager {
  private matches = new Map<string, ActiveMatch>();
  private sessionToMatch = new Map<string, string>(); // sessionId -> matchId

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
   * Get active match for a session
   */
  getActiveMatchForSession(sessionId: string): ActiveMatch | undefined {
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return undefined;
    const match = this.getMatch(matchId);
    if (!match || match.status === 'ended') {
      this.sessionToMatch.delete(sessionId);
      return undefined;
    }
    return match;
  }

  /**
   * Create or register a match
   */
  createMatch(
    matchId: string,
    mode: 'text' | 'video' = 'text',
    options?: { isDevFixture?: boolean; ttlMs?: number; commonInterests?: string[] }
  ): ActiveMatch {
    const now = Date.now();
    const match: ActiveMatch = {
      id: matchId,
      mode,
      status: 'waiting',
      participants: new Map(),
      commonInterests: options?.commonInterests || [],
      createdAt: now,
      expiresAt: now + (options?.ttlMs || DEFAULT_MATCH_TTL_MS),
      recentMessageIds: new Set(),
      isDevFixture: options?.isDevFixture ?? false,
    };

    this.matches.set(matchId, match);
    return match;
  }

  /**
   * Directly provisions a match between two authorized participants
   */
  createMatchWithParticipants(
    matchId: string,
    mode: 'text' | 'video',
    p1: { sessionId: string; socketId: string },
    p2: { sessionId: string; socketId: string },
    commonInterests: string[] = []
  ): ActiveMatch {
    // Terminate any previous matches these sessions were part of
    this.leaveAnyActiveMatch(p1.sessionId);
    this.leaveAnyActiveMatch(p2.sessionId);

    const now = Date.now();
    const match: ActiveMatch = {
      id: matchId,
      mode,
      status: 'active',
      participants: new Map([
        [p1.sessionId, { socketId: p1.socketId, joinedAt: now }],
        [p2.sessionId, { socketId: p2.socketId, joinedAt: now }],
      ]),
      commonInterests,
      createdAt: now,
      expiresAt: now + DEFAULT_MATCH_TTL_MS,
      recentMessageIds: new Set(),
      isDevFixture: false,
    };

    this.matches.set(matchId, match);
    this.sessionToMatch.set(p1.sessionId, matchId);
    this.sessionToMatch.set(p2.sessionId, matchId);

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
      this.sessionToMatch.set(sessionId, matchId);
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
    this.sessionToMatch.set(sessionId, matchId);

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
   * Leave an active match
   */
  leaveMatch(
    matchId: string,
    sessionId: string
  ): {
    matchEnded: boolean;
    peerSocketId?: string;
    peerSessionId?: string;
  } {
    const match = this.getMatch(matchId);
    this.sessionToMatch.delete(sessionId);

    if (!match) return { matchEnded: false };

    let peerSocketId: string | undefined;
    let peerSessionId: string | undefined;

    for (const [sId, info] of match.participants.entries()) {
      if (sId !== sessionId) {
        peerSocketId = info.socketId;
        peerSessionId = sId;
      }
    }

    match.participants.delete(sessionId);
    match.status = 'ended';

    if (peerSessionId) {
      this.sessionToMatch.delete(peerSessionId);
    }

    return {
      matchEnded: true,
      peerSocketId,
      peerSessionId,
    };
  }

  /**
   * Leave any current active match for a session
   */
  leaveAnyActiveMatch(sessionId: string): {
    matchEnded: boolean;
    matchId?: string;
    peerSocketId?: string;
    peerSessionId?: string;
  } {
    const matchId = this.sessionToMatch.get(sessionId);
    if (!matchId) return { matchEnded: false };
    const leaveResult = this.leaveMatch(matchId, sessionId);
    return {
      matchEnded: leaveResult.matchEnded,
      matchId,
      peerSocketId: leaveResult.peerSocketId,
      peerSessionId: leaveResult.peerSessionId,
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
        for (const sId of match.participants.keys()) {
          this.sessionToMatch.delete(sId);
        }
        this.matches.delete(id);
      }
    }
  }

  /**
   * Reset for test suites
   */
  reset(): void {
    this.matches.clear();
    this.sessionToMatch.clear();
  }
}

export const matchManager = new MatchManager();
