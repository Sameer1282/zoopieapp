# Zoopie Trust, Safety, and Moderation Architecture

## 1. Safety Philosophy & Core Principles

Zoopie is engineered to provide spontaneous, enjoyable, and safe real-time connections while upholding strict privacy protections. Safety on Zoopie is built around five pillars:

1. **Adult-Only Platform (18+)**: Strictly restricted to adults. Minors are prohibited.
2. **Immediate User Empowerment**: Participants have immediate controls: **Next (Esc)** to change partners, **Stop** to immediately sever connections, **Block** to permanently avoid pairing, and **Report** to submit violations.
3. **Server-Authoritative Enforcement**: Blocks, suspensions, and rate-limits are strictly enforced on the server. Clients cannot bypass or override moderation restrictions.
4. **Least-Privilege Administrative Security**: Staff operations are governed by cryptographically signed HMAC-SHA256 tokens with strict role-based access control (`SUPERADMIN`, `MODERATOR`, `AUDITOR`).
5. **Zero Media Wiretapping**: Live peer-to-peer video and audio are transient. Zoopie never activates covert recording, interception proxies, or persistent media storage.

---

## 2. Age Requirement & Age-Assurance Strategy

### 2.1 The 18+ Minimum-Age Policy

- Zoopie is strictly an 18+ service. Anyone under the age of 18 is prohibited from connecting, initiating sessions, or participating in text or video chat.
- Any participant suspected or reported for underage presence is immediately investigated and subject to permanent session and device fingerprint bans under the `UNDERAGE_SUSPICION` category.

### 2.2 Gatekeeping & Age-Assurance Mechanism

1. **Interactive Consent Gate (`TermsAgreementModal`)**:
   - Before accessing matchmaking queues in `/chat`, every visitor must affirmatively certify they are 18+ and agree to the Terms of Service and Community Guidelines.
   - The user's consent timestamp is stored in local storage (`zoopie_terms_accepted_v1`).
2. **Commercial Launch Roadmap Recommendation**:
   > [!IMPORTANT]
   > Prior to commercial or high-scale public release, self-attestation should be supplemented with accredited third-party age verification services (e.g., Yoti, Veriff, or Persona) in jurisdictions that legally mandate verified age assurance (such as the UK Online Safety Act and EU Digital Services Act).

---

## 3. Reporting System & Honest User Disclosure

### 3.1 Transparent Reporting Categories

Zoopie categorizes abuse reports using validated enumerated categories:

- `HARASSMENT`: Targeted insults, bullying, persistent offensive behavior.
- `INAPPROPRIATE_CONTENT`: Unsolicited nudity, explicit acts, sexual harassment.
- `THREATS_OR_VIOLENCE`: Threats of physical harm, self-harm, coercion.
- `HATE_SPEECH`: Attacks targeting race, religion, sexual orientation, disability, or identity.
- `SPAM_OR_BOT`: Phishing links, automated scripts, unauthorized commercial advertising.
- `IMPERSONATION`: Misrepresenting identity or deceptive impersonation.
- `OTHER`: Other guideline infractions.

### 3.2 Honest Disclosure Notice

The reporting dialog provides full transparency:

> _"Submitting a report creates a moderation record for review by our trust & safety team and logs an immutable audit trail. Zoopie does not promise immediate live human intervention. If you feel uncomfortable, harassed, or unsafe, please click Stop or Next to leave this conversation immediately."_

### 3.3 Anti-Spam Rate Limiting & Deduplication

- Report endpoints (`POST /api/reports`) are protected by Express strict rate limiters.
- In-memory sliding cache rejects duplicate reports submitted by the same reporter against the same peer within 60 seconds, returning `409 Conflict`.

---

## 4. User Blocking & Matchmaking Isolation

### 4.1 Blocking Architecture

- When a user blocks a participant via `/api/blocks`, the server registers a bidirectional block in `matchmakingQueue.recordBlock(blockerSessionId, blockedFingerprint)` and persists the record to the `UserBlock` database table.
- When evaluating matchmaking pairings in `matchmakingQueue.findCompatibleMatch()`, blocked pairs are strictly excluded:
  ```ts
  if (this.isBlocked(candidate.sessionId, other.sessionId)) {
    continue; // Strictly skip blocked pair
  }
  ```
- Blocks are bidirectional: Neither user will ever be paired with the other again in future text or video queues.

---

## 5. Administrative Authentication & Role-Based Access Control (RBAC)

### 5.1 Admin Authentication (`POST /api/admin/login`)

- Administrators authenticate using the configured `ADMIN_SECRET_KEY` (minimum 16 characters).
- Key verification uses constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing side-channel reconnaissance.
- Successful authentication yields an HMAC-SHA256 signed bearer token with a configurable expiration (default: 8 hours).

### 5.2 Role Hierarchy & Least Privilege

| Role             | Permissions                                                                                                                                           | Justification                                                        |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------- |
| **`AUDITOR`**    | Read-only inspection of abuse reports (`GET /api/admin/reports`), detailed records, stats, and audit logs.                                            | Independent compliance and safety oversight without execution risks. |
| **`MODERATOR`**  | All Auditor privileges + Execute actions (`POST /api/admin/reports/:id/action`): Warning, Temporary Ban, Permanent Ban, Session Termination, Dismiss. | Day-to-day Trust & Safety operations.                                |
| **`SUPERADMIN`** | Full access to moderation operations, audit trails, and administrative configuration.                                                                 | Platform administrators.                                             |

### 5.3 Server-Side Suspension Enforcement

- When a moderator executes a `PERMANENT_BAN` or `TEMPORARY_BAN`:
  1. The target session is added to `matchmakingQueue.setSuspended(targetSessionId, true)`.
  2. Any active match session is terminated immediately via `matchManager.leaveAnyActiveMatch(targetSessionId)`.
  3. If the suspended user attempts to join a matchmaking queue via Socket.IO, the server rejects the request with a `SESSION_SUSPENDED` error event:
     ```ts
     socket.emit(SOCKET_EVENTS.ERROR, {
       code: 'SESSION_SUSPENDED',
       message: 'Session is restricted or suspended from matchmaking',
     });
     ```

---

## 6. Immutable Moderation Audit Trail

Every moderation action produces a structured audit record stored in the database (`ModerationAction` table) and in-memory audit logs:

```ts
interface ModerationActionAudit {
  id: string;
  reportId: string | null;
  targetFingerprint: string;
  actionType: 'WARNING' | 'TEMPORARY_BAN' | 'PERMANENT_BAN' | 'SESSION_TERMINATION' | 'DISMISS';
  reason: string;
  adminId: string;
  createdAt: string;
  expiresAt: string | null;
}
```

Auditors and Superadmins can inspect this log at any time via `GET /api/admin/audit-logs` or the Web Moderation Dashboard to ensure accountability.

---

## 7. Legal Disclaimer & Staging Status

> [!WARNING]
> All Terms of Service, Community Guidelines, and Privacy Policy files present in this repository (`apps/web/src/app/terms/page.tsx`, `apps/web/src/app/safety/page.tsx`, `apps/web/src/app/privacy/page.tsx`) are architectural drafts created for engineering staging. Before releasing Zoopie to the general public, qualified legal counsel licensed in your operating jurisdictions must formally review, amend, and approve these policies.
