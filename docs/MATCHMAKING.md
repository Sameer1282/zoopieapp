# Zoopie Matchmaking Architecture & Fallback Specification

## 1. Overview

Zoopie implements a server-authoritative, privacy-preserving matchmaking system designed to pair two anonymous participants for real-time text or video conversations.

## 2. Queue Partitioning & Architecture

### 2.1 Mode-Specific Queues

Matchmaking queues are strictly partitioned by chat mode:

- **`text` Queue**: Pairs users for ephemeral text chat.
- **`video` Queue**: Pairs users for WebRTC peer-to-peer video/audio.

Users in the `text` queue can **never** match with users in the `video` queue.

### 2.2 Storage Model & Scaling Limitations

- **Current Single-Instance Implementation**:
  - Implemented using `InMemoryMatchmakingQueue` behind the pluggable `IMatchmakingQueue` interface.
  - State (queued sockets, session IDs, timestamps, topic filters) is maintained within Node.js process memory.
  - **Scaling Limitations**: Process-local memory is strictly limited to a single Node.js instance. In a horizontally scaled multi-instance cluster, users connected to Instance A would not be discoverable by Instance B without a distributed state store.
- **Production Redis Strategy**:
  - The `IMatchmakingQueue` interface is designed for drop-in replacement by a Redis-backed implementation (`RedisMatchmakingQueue`).
  - Redis data structures:
    - `zset` sorted sets for queue timestamps: `queue:text` and `queue:video` (score = join timestamp).
    - Redis Sets for interest-indexed lookups: `queue:text:tag:{tag}`.
    - Lua scripts or Redis transactions (`MULTI/EXEC`) to guarantee atomic pop and lock operations, eliminating race conditions across multiple backend workers.
    - Redis Pub/Sub or Socket.IO Redis Adapter (`@socket.io/redis-adapter`) for cross-instance event dispatching.

---

## 3. Interest Matching & Fallback Policy

### 3.1 Topic Normalization

- Tags are normalized: lowercased, trimmed, stripped of special characters, limited to 1..30 alphanumeric characters, and capped at 10 tags per participant.

### 3.2 Two-Phase Matching Algorithm

1. **Phase 1: Priority Interest Matching (0 to 10 seconds)**
   - When User A enters the queue with topics (e.g. `['tech', 'gaming']`), the engine searches existing queued users in the same mode for non-empty interest intersections:
     $$\text{shared} = \text{interests}_A \cap \text{interests}_B \neq \emptyset$$
   - Matches are prioritized by largest overlap followed by earliest queue entry (FIFO).
   - If User A and User B have overlapping interests, they are paired immediately.
2. **Phase 2: Relaxed Fallback Window (> 10 seconds)**
   - If User A has waited longer than `INTEREST_FALLBACK_DELAY_MS` (10,000 ms) and no interest match is found, User A becomes eligible for general fallback.
   - Any other user who is also fallback-eligible or entered with no specific interests can be paired.
   - Sockets with empty interest lists (`interests = []`) enter the general pool immediately and can pair with each other or fallback-eligible users.
3. **Phase 3: Queue Expiry & Honest Timeout (60 seconds)**
   - If no eligible peer is available after `QUEUE_TIMEOUT_MS` (60,000 ms), the server expires the entry and emits `matchmaking:timeout`.
   - The UI displays an honest empty state ("No users currently available") with options to retry or adjust topic filters. No fake bots or simulated conversations are ever created.

---

## 4. Safety & Invariant Guarantees

| Invariant                   | Enforcement Mechanism                                                                                                                                                                 |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No Self-Matching**        | Sockets cannot match if `userA.sessionId === userB.sessionId` or `socketA.id === socketB.id`.                                                                                         |
| **No Duplicate Matches**    | Before entering a queue or accepting a match, any prior match is formally terminated (`matchManager.leaveMatch`), and old queue entries are purged.                                   |
| **Blocked Pairs Exclusion** | If User A has blocked User B (or vice versa), the pair is excluded during candidate evaluation.                                                                                       |
| **Atomic Concurrency**      | Candidate selection and removal from queue occur in a single synchronous event-loop step under an atomic check, preventing concurrent events from double-matching the same candidate. |
| **Opaque Match ID**         | Sockets never supply peer socket IDs or match target IDs. The server generates an opaque UUID (`match_${crypto.randomUUID()}`) and assigns both sockets into the isolated room.       |
| **Stale Event Protection**  | Sockets track `currentMatchId`. Messages or signals bearing mismatched match IDs are rejected with `UNAUTHORIZED_MATCH`.                                                              |
| **Immediate Cleanup**       | Socket disconnects, `match:skip`, and `match:stop` immediately remove entries from active queues and notify matched peers.                                                            |
