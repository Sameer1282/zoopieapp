import crypto from 'node:crypto';
import {
  INTEREST_FALLBACK_DELAY_MS,
  QUEUE_TIMEOUT_MS,
  type QueueStatusPayload,
} from '@zoopie/shared';
import { logger } from '../utils/logger.js';

export interface QueuedParticipant {
  sessionId: string;
  socketId: string;
  mode: 'text' | 'video';
  interests: string[];
  normalizedInterests: Set<string>;
  joinedAt: number;
  fallbackEligibleAt: number;
  expiresAt: number;
}

export interface MatchPairResult {
  matchId: string;
  mode: 'text' | 'video';
  initiator: QueuedParticipant;
  receiver: QueuedParticipant;
  commonInterests: string[];
  matchedAt: number;
}

export interface EnqueueResult {
  matched: boolean;
  match?: MatchPairResult;
  status: QueueStatusPayload['status'];
  fallbackEligibleAt?: number;
  error?: string;
}

/**
 * Pluggable matchmaking queue interface.
 * Allows this single-instance in-memory implementation to be seamlessly replaced
 * by a distributed Redis-backed queue service (e.g. using Redis sorted sets and Lua scripts)
 * in multi-instance production environments without altering event contracts or UI.
 */
export interface IMatchmakingQueue {
  enqueue(candidate: {
    sessionId: string;
    socketId: string;
    mode: 'text' | 'video';
    interests?: string[];
  }): EnqueueResult;

  dequeue(sessionId: string): boolean;
  dequeueBySocketId(socketId: string): boolean;
  getQueueItem(sessionId: string): QueuedParticipant | undefined;
  getQueueItemBySocketId(socketId: string): QueuedParticipant | undefined;
  getQueueLength(mode: 'text' | 'video'): number;

  recordBlock(blockerSessionId: string, blockedSessionId: string): void;
  isBlocked(sessionA: string, sessionB: string): boolean;

  setSuspended(sessionId: string, suspended: boolean): void;
  isSuspended(sessionId: string): boolean;

  checkTimeouts(): {
    expiredSessions: Array<{ sessionId: string; socketId: string; mode: 'text' | 'video' }>;
    newMatches: MatchPairResult[];
  };

  reset(): void;
}

/**
 * Normalizes an array of interest tags (lowercased, trimmed, deduped)
 */
export function normalizeInterests(tags: string[] = []): { list: string[]; set: Set<string> } {
  const set = new Set<string>();
  const list: string[] = [];

  for (const raw of tags) {
    const cleaned = raw.trim().toLowerCase().replace(/^#+/, '');
    if (cleaned.length > 0 && cleaned.length <= 30 && !set.has(cleaned)) {
      set.add(cleaned);
      list.push(cleaned);
    }
  }

  return { list, set };
}

/**
 * In-Memory Server-Authoritative Matchmaking Queue
 * Handles queue segregation by mode, two-phase interest matching,
 * fallback relaxation, self-match prevention, block filtering, and stale entry pruning.
 */
export class InMemoryMatchmakingQueue implements IMatchmakingQueue {
  // Separate queues partitioned strictly by chat mode
  private textQueue = new Map<string, QueuedParticipant>(); // sessionId -> QueuedParticipant
  private videoQueue = new Map<string, QueuedParticipant>();

  // In-memory block and suspension registries
  private blockedPairs = new Set<string>(); // "sessionA:sessionB"
  private suspendedSessions = new Set<string>(); // sessionId

  /**
   * Helper to get queue by mode
   */
  private getQueue(mode: 'text' | 'video'): Map<string, QueuedParticipant> {
    return mode === 'text' ? this.textQueue : this.videoQueue;
  }

  /**
   * Record a bidirectional block between two sessions
   */
  recordBlock(blockerSessionId: string, blockedSessionId: string): void {
    this.blockedPairs.add(`${blockerSessionId}:${blockedSessionId}`);
    this.blockedPairs.add(`${blockedSessionId}:${blockerSessionId}`);
  }

  /**
   * Check if two sessions have a block relation
   */
  isBlocked(sessionA: string, sessionB: string): boolean {
    return (
      this.blockedPairs.has(`${sessionA}:${sessionB}`) ||
      this.blockedPairs.has(`${sessionB}:${sessionA}`)
    );
  }

  /**
   * Mark a session as suspended / restricted
   */
  setSuspended(sessionId: string, suspended: boolean): void {
    if (suspended) {
      this.suspendedSessions.add(sessionId);
      this.dequeue(sessionId);
    } else {
      this.suspendedSessions.delete(sessionId);
    }
  }

  /**
   * Check if a session is suspended
   */
  isSuspended(sessionId: string): boolean {
    return this.suspendedSessions.has(sessionId);
  }

  /**
   * Get total participants in queue for a mode
   */
  getQueueLength(mode: 'text' | 'video'): number {
    return this.getQueue(mode).size;
  }

  /**
   * Retrieve queued item by session ID
   */
  getQueueItem(sessionId: string): QueuedParticipant | undefined {
    return this.textQueue.get(sessionId) || this.videoQueue.get(sessionId);
  }

  /**
   * Retrieve queued item by socket ID
   */
  getQueueItemBySocketId(socketId: string): QueuedParticipant | undefined {
    for (const q of [this.textQueue, this.videoQueue]) {
      for (const item of q.values()) {
        if (item.socketId === socketId) return item;
      }
    }
    return undefined;
  }

  /**
   * Remove participant from both queues
   */
  dequeue(sessionId: string): boolean {
    const textRemoved = this.textQueue.delete(sessionId);
    const videoRemoved = this.videoQueue.delete(sessionId);
    return textRemoved || videoRemoved;
  }

  /**
   * Remove participant by socket ID
   */
  dequeueBySocketId(socketId: string): boolean {
    let removed = false;
    for (const q of [this.textQueue, this.videoQueue]) {
      for (const [sessionId, item] of q.entries()) {
        if (item.socketId === socketId) {
          q.delete(sessionId);
          removed = true;
        }
      }
    }
    return removed;
  }

  /**
   * Server-authoritative enqueue and matching evaluation.
   * Executed synchronously in the single-threaded Node.js event loop,
   * guaranteeing atomic candidate selection without race conditions.
   */
  enqueue(candidateInput: {
    sessionId: string;
    socketId: string;
    mode: 'text' | 'video';
    interests?: string[];
  }): EnqueueResult {
    const { sessionId, socketId, mode, interests = [] } = candidateInput;

    // 1. Suspension Check
    if (this.isSuspended(sessionId)) {
      return {
        matched: false,
        status: 'idle',
        error: 'Session is restricted or suspended from matchmaking',
      };
    }

    // 2. Prevent duplicate entries: remove any prior queue entry for this session or socket
    this.dequeue(sessionId);
    this.dequeueBySocketId(socketId);

    const now = Date.now();
    const { list: normalizedList, set: normalizedSet } = normalizeInterests(interests);

    const candidate: QueuedParticipant = {
      sessionId,
      socketId,
      mode,
      interests: normalizedList,
      normalizedInterests: normalizedSet,
      joinedAt: now,
      fallbackEligibleAt: now + (normalizedList.length > 0 ? INTEREST_FALLBACK_DELAY_MS : 0),
      expiresAt: now + QUEUE_TIMEOUT_MS,
    };

    const queue = this.getQueue(mode);

    // 3. Search for eligible match partner in queue
    const partner = this.findBestMatch(candidate, queue, now);

    if (partner) {
      // Atomic dequeue of selected partner
      queue.delete(partner.sessionId);

      // Compute common interests intersection
      const commonInterests = candidate.interests.filter(tag =>
        partner.normalizedInterests.has(tag)
      );

      // Generate opaque unique match ID
      const matchId = `match_${crypto.randomUUID()}`;

      logger.info('Matchmaking match successfully formed', {
        matchId,
        mode,
        initiatorSessionId: candidate.sessionId,
        receiverSessionId: partner.sessionId,
        commonInterestsCount: commonInterests.length,
      });

      return {
        matched: true,
        match: {
          matchId,
          mode,
          initiator: candidate,
          receiver: partner,
          commonInterests,
          matchedAt: now,
        },
        status: 'matched',
      };
    }

    // 4. No immediate partner found: add candidate to mode queue
    queue.set(sessionId, candidate);

    return {
      matched: false,
      status: 'searching',
      fallbackEligibleAt: candidate.fallbackEligibleAt,
    };
  }

  /**
   * Evaluates queue candidates according to the Two-Phase Matching Algorithm:
   * Phase 1: Direct interest overlap (if candidate has interests)
   * Phase 2: Relaxed fallback matching (if candidate has no interests or is fallback-eligible)
   */
  private findBestMatch(
    candidate: QueuedParticipant,
    queue: Map<string, QueuedParticipant>,
    now: number
  ): QueuedParticipant | null {
    let bestPartner: QueuedParticipant | null = null;
    let highestCommonCount = 0;

    const hasInterests = candidate.interests.length > 0;

    // First Pass: Check for direct interest intersection
    if (hasInterests) {
      for (const waiting of queue.values()) {
        // Disqualify self-match, blocked pairs, or suspended users
        if (!this.isValidPair(candidate, waiting)) continue;

        // Calculate common interests
        let commonCount = 0;
        for (const tag of waiting.interests) {
          if (candidate.normalizedInterests.has(tag)) {
            commonCount++;
          }
        }

        if (commonCount > 0) {
          if (commonCount > highestCommonCount) {
            highestCommonCount = commonCount;
            bestPartner = waiting;
          } else if (commonCount === highestCommonCount && bestPartner) {
            // Tie-break: earliest queue arrival (FIFO)
            if (waiting.joinedAt < bestPartner.joinedAt) {
              bestPartner = waiting;
            }
          }
        }
      }

      if (bestPartner) {
        return bestPartner;
      }
    }

    // Second Pass: General pool / Fallback matching
    // If candidate has no specific interests, they can match with:
    // a) Another participant with no interests, OR
    // b) A waiting participant whose fallback delay has elapsed
    if (!hasInterests) {
      for (const waiting of queue.values()) {
        if (!this.isValidPair(candidate, waiting)) continue;

        const waitingHasNoInterests = waiting.interests.length === 0;
        const waitingIsFallbackEligible = now >= waiting.fallbackEligibleAt;

        if (waitingHasNoInterests || waitingIsFallbackEligible) {
          if (!bestPartner || waiting.joinedAt < bestPartner.joinedAt) {
            bestPartner = waiting;
          }
        }
      }
    }

    return bestPartner;
  }

  /**
   * Invariant validator: ensures no self-matching, no duplicate socket,
   * no blocked pairs, and no suspended participants.
   */
  private isValidPair(a: QueuedParticipant, b: QueuedParticipant): boolean {
    // Prevent self-matching by sessionId
    if (a.sessionId === b.sessionId) return false;

    // Prevent self-matching by socketId
    if (a.socketId === b.socketId) return false;

    // Prevent suspended users
    if (this.isSuspended(a.sessionId) || this.isSuspended(b.sessionId)) return false;

    // Prevent blocked pairs
    if (this.isBlocked(a.sessionId, b.sessionId)) return false;

    return true;
  }

  /**
   * Periodic maintenance:
   * 1. Purges expired queue items (older than QUEUE_TIMEOUT_MS)
   * 2. Evaluates newly fallback-eligible waiting participants and forms matches
   */
  checkTimeouts(): {
    expiredSessions: Array<{ sessionId: string; socketId: string; mode: 'text' | 'video' }>;
    newMatches: MatchPairResult[];
  } {
    const now = Date.now();
    const expiredSessions: Array<{
      sessionId: string;
      socketId: string;
      mode: 'text' | 'video';
    }> = [];
    const newMatches: MatchPairResult[] = [];

    for (const mode of ['text', 'video'] as const) {
      const queue = this.getQueue(mode);

      // 1. Check for expired sessions
      for (const [sessionId, item] of Array.from(queue.entries())) {
        if (now >= item.expiresAt) {
          queue.delete(sessionId);
          expiredSessions.push({
            sessionId,
            socketId: item.socketId,
            mode: item.mode,
          });
        }
      }

      // 2. Check for fallback matches among remaining participants
      const remaining = Array.from(queue.values()).sort((a, b) => a.joinedAt - b.joinedAt);
      const matchedThisRound = new Set<string>();

      for (let i = 0; i < remaining.length; i++) {
        const itemA = remaining[i];
        if (matchedThisRound.has(itemA.sessionId)) continue;

        for (let j = i + 1; j < remaining.length; j++) {
          const itemB = remaining[j];
          if (matchedThisRound.has(itemB.sessionId)) continue;

          if (!this.isValidPair(itemA, itemB)) continue;

          // Check if either has interest match, or both are eligible for general fallback
          const common = itemA.interests.filter(tag => itemB.normalizedInterests.has(tag));
          const hasCommon = common.length > 0;
          const aFallback = now >= itemA.fallbackEligibleAt || itemA.interests.length === 0;
          const bFallback = now >= itemB.fallbackEligibleAt || itemB.interests.length === 0;

          if (hasCommon || (aFallback && bFallback)) {
            // Form match
            queue.delete(itemA.sessionId);
            queue.delete(itemB.sessionId);
            matchedThisRound.add(itemA.sessionId);
            matchedThisRound.add(itemB.sessionId);

            const matchId = `match_${crypto.randomUUID()}`;
            newMatches.push({
              matchId,
              mode,
              initiator: itemA,
              receiver: itemB,
              commonInterests: common,
              matchedAt: now,
            });

            break;
          }
        }
      }
    }

    return { expiredSessions, newMatches };
  }

  /**
   * Reset all queues and test registries
   */
  reset(): void {
    this.textQueue.clear();
    this.videoQueue.clear();
    this.blockedPairs.clear();
    this.suspendedSessions.clear();
  }
}

export const matchmakingQueue = new InMemoryMatchmakingQueue();
