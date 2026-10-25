# Zoopie Data Retention & Privacy Policy Specification

## 1. Core Principle: Privacy by Design

Zoopie is engineered around an uncompromising architectural boundary:
**Ordinary communication must be ephemeral.** Users connect spontaneously without creating persistent accounts, and their private communications must not linger in permanent databases.

---

## 2. Retention Rules by Data Category

| Category                                      | Storage Location                      | Retention Window                 | Purge Mechanism                                                                      |
| --------------------------------------------- | ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| **Text Chat Messages**                        | Volatile RAM only (Socket.IO relay)   | **0 seconds (Ephemeral)**        | Discarded immediately upon socket transport. **Never written to disk or database.**  |
| **Video & Audio Media**                       | Browser-to-browser WebRTC             | **0 seconds (Direct P2P)**       | Direct peer stream; no recording proxy exists.                                       |
| **Session Metadata** (`conversations`)        | PostgreSQL `conversations` table      | **30 days**                      | Automated monthly scheduled cleanup cron purging records older than 30 days.         |
| **User Sessions** (`user_sessions`)           | PostgreSQL `user_sessions` table      | **30 days** from last activity   | Inactive unbanned sessions purged after 30 days.                                     |
| **Abuse Reports** (`abuse_reports`)           | PostgreSQL `abuse_reports` table      | **90 days**                      | Retained strictly for Trust & Safety review and legal compliance, then hard-deleted. |
| **Moderation Actions** (`moderation_actions`) | PostgreSQL `moderation_actions` table | **1 year**                       | Audit log retained for accountability.                                               |
| **User Blocks** (`user_blocks`)               | PostgreSQL `user_blocks` table        | **Indefinite (Until unblocked)** | Retained while active to prevent re-matching blocked users.                          |
| **Ephemeral Server Access Logs**              | Server standard output / log file     | **7 days**                       | Rolling rotation with sensitive-field redaction.                                     |

---

## 3. Cryptographic Anonymization Standards

1. **Zero Raw IP Persistence**:
   - Client IP addresses are never inserted into database columns.
   - Fingerprints are generated via `HMAC-SHA-256(raw_ip + user_agent, server_pepper)`.
   - The resulting hash is one-way and cannot be reverse-engineered without the server pepper.

2. **Zero Plaintext Credentials**:
   - Administrative users authenticate with passwords hashed using **Argon2id**.
   - No secret keys or database credentials are ever delivered to client web bundles.

---

## 4. Report Lifecycle & Deletion Procedures

1. **Abuse Reports (90 Days)**:
   - When an abuse report is filed, it is stored in `abuse_reports` with status `PENDING`.
   - Once resolved, dismissed, or expired after 90 days, automated database pruning permanently hard-deletes the report record.
   - Reporter and reported session references are purged.

2. **Moderation Audit Records (1 Year)**:
   - Moderation actions (`moderation_actions`) are retained for 1 year to satisfy regulatory compliance and ensure staff accountability.
   - Records contain anonymized target fingerprints and reasons. After 365 days, records are pruned.

3. **Data Subject Deletion Requests**:
   - Users wishing to exercise their "Right to be Forgotten" (GDPR Art. 17 / CCPA) can submit their session ID.
   - Because ordinary text and media are never stored (0-second retention), there is no private communication data to delete. Any associated transient blocks or report references tied to that session ID will be purged within 30 days upon request.
