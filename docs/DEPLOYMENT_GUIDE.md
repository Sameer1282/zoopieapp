# Zoopie Production Deployment Guide: Vercel & Render

This guide outlines the production deployment strategy for the Zoopie monorepo:

- **Frontend (`apps/web`)**: Next.js App Router deployed to **Vercel**.
- **Backend (`apps/server`)**: Persistent Express & Socket.IO Web Service deployed to **Render**.
- **Database**: Managed PostgreSQL on **Render** (or external provider like Neon/Supabase).
- **Media Relay**: WebRTC with ephemeral RFC 5766 TURN credentials.

---

## 1. Production Architecture Topology

```
+-------------------------------------------------------------------------+
|                               Client Browser                            |
+-------------------+---------------------------------+-------------------+
                    | HTTPS                           | WSS / WebRTC
                    v                                 v
+-----------------------------+     +-------------------------------------+
|        Vercel (Edge)        |     |           Render (Server)           |
|      apps/web (Next.js)     |     |     apps/server (Node/Express/IO)   |
|   Static Assets & SSR HTML  |     |   Real-time Gateway & REST APIs     |
+-----------------------------+     +------------------+------------------+
                                                       | TCP / TLS
                                                       v
                                    +-------------------------------------+
                                    |         Managed PostgreSQL          |
                                    |       Sessions / Moderation DB      |
                                    +-------------------------------------+
```

---

## 2. Frontend Deployment on Vercel

### 2.1 Monorepo Build Configuration

In the Vercel Dashboard, import the Git repository with the following settings:

| Setting                        | Value                                                                               |
| :----------------------------- | :---------------------------------------------------------------------------------- |
| **Framework Preset**           | Next.js                                                                             |
| **Root Directory**             | `apps/web`                                                                          |
| **Include files outside root** | **Enabled** (Required for `@zoopie/shared` workspace package)                       |
| **Install Command**            | `cd ../.. && pnpm install`                                                          |
| **Build Command**              | `cd ../.. && pnpm --filter @zoopie/shared build && pnpm --filter @zoopie/web build` |
| **Output Directory**           | `.next`                                                                             |

_Alternatively, deploy from monorepo root using the included [`vercel.json`](file:///d:/ZOOPIE/vercel.json)._

### 2.2 Public Environment Variables

Configure the following in **Vercel Project Settings -> Environment Variables**:

| Variable Name            | Environment          | Value Description                | Example Value                                  |
| :----------------------- | :------------------- | :------------------------------- | :--------------------------------------------- |
| `NEXT_PUBLIC_API_URL`    | Production & Preview | HTTPS URL of your Render backend | `https://zoopie-server.onrender.com`           |
| `NEXT_PUBLIC_SOCKET_URL` | Production & Preview | WSS URL of your Render backend   | `https://zoopie-server.onrender.com`           |
| `NEXT_PUBLIC_APP_URL`    | Production           | Canonical public frontend URL    | `https://zoopie.vercel.app` (or custom domain) |

> [!CAUTION]
> **Zero-Secret Rule**: Never prefix backend secrets (`DATABASE_URL`, `ADMIN_SECRET_KEY`, `TURN_SERVER_SECRET`) with `NEXT_PUBLIC_`. Any variable starting with `NEXT_PUBLIC_` is inlined into public client browser bundles.

### 2.3 Preview vs Production Environments

- **Production**: Bound to your primary domain (e.g. `https://zoopie.chat` or `https://zoopie.vercel.app`).
- **Preview Deployments**: Vercel generates dynamic subdomains for every Git pull request (e.g. `https://zoopie-git-feat-xyz-team.vercel.app`).
  - The backend server is pre-configured with `ALLOW_VERCEL_PREVIEWS=true` to automatically allow incoming WebSocket and CORS requests from any legitimate `.vercel.app` preview domain.

---

## 3. Backend Deployment on Render

### 3.1 Blueprint Deployment (`render.yaml`)

The monorepo includes a complete Infrastructure-as-Code blueprint in [`render.yaml`](file:///d:/ZOOPIE/render.yaml).

To deploy via Blueprint:

1. In the Render Dashboard, click **New + -> Blueprint**.
2. Connect your Git repository. Render will automatically detect `render.yaml` and provision:
   - Web Service: `zoopie-server`
   - Managed PostgreSQL Database: `zoopie-db`
3. Click **Apply**.

### 3.2 Manual Web Service Settings

If creating the Web Service manually:

| Setting               | Value                                                                                                                                                        |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service Type**      | Web Service (Persistent Node.js)                                                                                                                             |
| **Environment**       | Node                                                                                                                                                         |
| **Region**            | Choose closest to your target audience (e.g., Oregon, Frankfurt)                                                                                             |
| **Branch**            | `main`                                                                                                                                                       |
| **Build Command**     | `pnpm install --frozen-lockfile && pnpm --filter @zoopie/shared build && pnpm --filter @zoopie/server prisma:generate && pnpm --filter @zoopie/server build` |
| **Start Command**     | `pnpm --filter @zoopie/server start`                                                                                                                         |
| **Health Check Path** | `/health`                                                                                                                                                    |
| **Auto-Deploy**       | Yes                                                                                                                                                          |

### 3.3 Backend Environment Variables

Set the following in **Render Web Service -> Environment**:

| Variable Name                 | Required | Value / Recommendation                                                                                    |
| :---------------------------- | :------: | :-------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                    |   Yes    | `production`                                                                                              |
| `PORT`                        |   Auto   | Injected automatically by Render (defaults to `10000`). The server binds to `process.env.PORT`.           |
| `CLIENT_ORIGIN`               |   Yes    | Comma-separated allowed frontend domains: `https://zoopie.vercel.app,https://zoopie.chat`                 |
| `ALLOW_VERCEL_PREVIEWS`       |   Yes    | `true` (Enables CORS and WebSocket connectivity for Vercel preview branch deployments)                    |
| `DATABASE_URL`                |   Yes    | Connection string from Render PostgreSQL (e.g. `postgresql://user:pass@host/zoopie_prod?sslmode=require`) |
| `DB_TIMEOUT_MS`               |    No    | `3000` (Database operation watchdog timeout)                                                              |
| `ADMIN_SECRET_KEY`            |   Yes    | High-entropy 32+ character random secret for moderator/admin authentication                               |
| `STUN_SERVER_URL`             |   Yes    | Public STUN server(s): `stun:stun.l.google.com:19302`                                                     |
| `TURN_SERVER_URL`             |   Yes    | TURN server address(es) (e.g., `turn:turn.metered.ca:443?transport=tcp`)                                  |
| `TURN_SERVER_SECRET`          |   Yes    | Ephemeral HMAC secret key provided by your TURN provider                                                  |
| `TURN_CREDENTIAL_TTL_SECONDS` |    No    | `86400` (24-hour credential expiration)                                                                   |

### 3.4 WebSocket Support on Render

- Render provides native WebSocket support on all Web Services over standard HTTPS/WSS ports (443).
- No reverse proxy or Nginx upgrade headers need manual configuration.
- The Socket.IO server negotiates both `websocket` and HTTP `polling` fallbacks.

### 3.5 Health Checks & Zero-Downtime Deploys

- Render polls `/health` during deployments.
- New container instances must return `HTTP 200 OK` on `/health` before traffic routes to them.
- When an old container receives `SIGTERM`, graceful shutdown begins immediately:
  - `/ready` returns `HTTP 503` so load balancers stop sending new requests.
  - Active Socket.IO connections drain cleanly.
  - Prisma disconnects with a 10-second watchdog deadline.

---

## 4. Database & Migration Strategy

### 4.1 Production Migrations

Never use `prisma migrate dev` or `prisma db push` in production. Execute production migrations using:

```bash
pnpm --filter @zoopie/server prisma migrate deploy
```

#### Recommended Render Setup:

Set the **Pre-Deploy Command** in Render Web Service settings:

```bash
pnpm --filter @zoopie/server prisma migrate deploy
```

Render runs this command before routing traffic to the newly built container. If the migration fails, deployment halts safely without terminating active services.

### 4.2 Connection Pooling & Limits

- **Render PostgreSQL Free / Starter**: Supports 20 to 50 concurrent connections.
- Append connection limits to `DATABASE_URL` to avoid pool exhaustion:
  ```
  postgresql://user:pass@host:5432/zoopie_prod?sslmode=require&connection_limit=10&pool_timeout=15
  ```
- If using external connection poolers (e.g. PgBouncer on Supabase), append `&pgbouncer=true`.

### 4.3 Database Backups & Recovery

- Render Managed PostgreSQL Starter+ plans provide automated daily backups retained for 7 days.
- Manual backup via CLI:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f zoopie_backup_$(date +%Y%m%d).dump
  ```
- Restore from backup:
  ```bash
  pg_restore --clean --if-exists -d "$DATABASE_URL" zoopie_backup_20261025.dump
  ```

---

## 5. WebRTC STUN / TURN Configuration

### 5.1 TURN Provider Integration

WebRTC requires a TURN relay server when participants are behind symmetric NATs, cellular carriers, or corporate firewalls (approximately 15–20% of internet calls).

#### Recommended Providers:

1. **Metered.ca** (Free tier: 50GB monthly bandwidth):
   - Dashboard provides `TURN Server URL` and `API Secret / HMAC Key`.
   - Set in Render:
     - `TURN_SERVER_URL=turn:openrelay.metered.ca:443?transport=tcp,turns:openrelay.metered.ca:443?transport=tcp`
     - `TURN_SERVER_SECRET=<your-metered-secret-key>`
2. **Cloudflare Calls / Twilio Network Traversal**:
   - Provide standard RFC 5766 REST API TURN endpoints.
3. **Self-Hosted Coturn**:
   - Run Coturn on an Ubuntu VPS with `use-auth-secret` and `static-auth-secret`.

### 5.2 Ephemeral Credential Security

- Frontend clients never receive `TURN_SERVER_SECRET`.
- When a user enters video chat, the client requests `GET /api/webrtc/ice-servers`.
- The server generates short-lived HMAC-SHA1 tokens with an expiration timestamp:
  ```
  username: "<timestamp>:<uuid>"
  credential: "<base64-hmac-sha1>"
  ```
- Tokens expire after 24 hours. Leaked client credentials cannot be reused indefinitely.

### 5.3 Missing TURN Warning

If `NODE_ENV === 'production'` and `TURN_SERVER_URL` is not provided:

- The server logs a prominent `DEPLOYMENT WARNING`.
- The `/health` and `/ready` probes expose `turnConfigured: false`.
- The frontend WebRTC diagnostics drawer alerts the user that media relay is unavailable.

---

## 6. Shared State & Horizontal Scaling (Redis)

### Single-Instance vs Multi-Instance:

- **Default (Single-Instance)**: Matchmaking queues run in-memory within `matchmakingQueue`. A single Render Starter instance easily handles 1,000+ simultaneous real-time connections.
- **Horizontal Scaling (Multi-Instance)**:
  When scaling across multiple Render web service replicas, processes cannot share in-memory state.
  - Set `REDIS_URL` in Render environment variables.
  - Attach `@socket.io/redis-adapter` to distribute WebSocket events across instances.

---

## 7. Post-Deployment Verification Procedure

Run the automated verification script against your deployed URLs:

```bash
pnpm verify:deployment https://zoopie-server.onrender.com https://zoopie.vercel.app
```

### Manual Verification Checklist:

- [ ] **HTTPS / TLS**: Both Vercel and Render serve valid SSL certificates without browser warnings.
- [ ] **Liveness**: `GET https://zoopie-server.onrender.com/health` returns `HTTP 200` with `status: "ok"`.
- [ ] **Readiness**: `GET https://zoopie-server.onrender.com/ready` returns `ready: true` and `database: "healthy"`.
- [ ] **CORS Security**: Making a request with an arbitrary origin header (e.g., `Origin: https://malicious.com`) does not grant `Access-Control-Allow-Origin`.
- [ ] **Socket.IO Handshake**: Opening the chat room establishes a connection using WebSocket transport.
- [ ] **Multi-User Text Chat**: Two independent browsers (e.g. Chrome normal + incognito) can join, match, and exchange text messages.
- [ ] **WebRTC Video/Audio**: Two devices on separate networks establish audio/video streams with local preview and mic/camera toggles.
- [ ] **Abuse Reporting**: Submitting a report returns confirmation without leaking user PII.
- [ ] **Log Redaction**: Reviewing Render log stream confirms passwords, tokens, and database credentials show as `[REDACTED]`.

---

## 8. Rollback Procedures

### Frontend (Vercel):

1. In the Vercel Dashboard, go to **Deployments**.
2. Locate the previous stable deployment.
3. Click the three dots `...` and select **Instant Rollback**.
4. Traffic points to the previous deployment immediately.

### Backend (Render):

1. In the Render Dashboard, navigate to **Web Service -> Deploys**.
2. Select the previous stable commit build.
3. Click **Rollback to this deploy**.
4. Render boots the previous Docker image with zero downtime.
