# Zoopie Security Baseline & Content Security Policy (CSP)

## 1. Security Architecture Overview

Phase 3 establishes an enterprise security baseline across the Zoopie monorepo:

1. **Security Headers & Strict CSP**: Configured via Helmet.
2. **Explicit Origin CORS**: Strict environment-governed allowed origins. Wildcard `*` is explicitly blocked in production.
3. **Payload Size Enforcement**: Strict JSON request limits (`10kb`) preventing memory exhaustion attacks.
4. **Baseline & Endpoint Rate Limiting**: Mitigates brute-force, resource starvation, and report spam.
5. **Sensitive Field Redaction**: Automatic redaction of credentials, database URLs, and session tokens from logs.
6. **Zero Stack Trace Leaks**: Centralized error middleware masks internal details in production.

---

## 2. Content Security Policy (CSP) Directives

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' <ALLOWED_CORS_ORIGIN> ws: wss:;
  frame-ancestors 'none';
  object-src 'none';
  upgrade-insecure-requests;
```

### Directive Justification

- `default-src 'self'`: Prevents arbitrary script, style, and media injection from untrusted domains.
- `script-src 'self'`: Disallows inline eval and arbitrary remote script execution.
- `style-src 'self' 'unsafe-inline'`: Permits CSS styles and Tailwind utility classes while disallowing remote style loads.
- `connect-src 'self' ... ws: wss:`: Authorizes Socket.IO signaling WebSockets and backend REST endpoints.
- `frame-ancestors 'none'`: Prevents clickjacking attacks by forbidding iframing into third-party sites.
- `object-src 'none'`: Blocks Flash, Java, and obsolete plugin vectors.

---

## 3. Other Security Headers

| Header                         | Value                                          | Purpose                                                 |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                                      | Blocks MIME-sniffing exploits.                          |
| `X-Frame-Options`              | `DENY`                                         | Hardens against clickjacking.                           |
| `Strict-Transport-Security`    | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS in production.                           |
| `Cross-Origin-Resource-Policy` | `cross-origin`                                 | Allows authorized frontend origin resource consumption. |
| `X-Powered-By`                 | _Removed_                                      | Obscures Express technology fingerprint.                |

---

## 4. Rate Limiting Strategy

1. **Standard API Rate Limiter**:
   - Window: `60 seconds`
   - Max Requests: `120 requests per IP`
   - Applies to: General endpoints, health checks, session creation.

2. **Strict Sensitive Endpoint Rate Limiter**:
   - Window: `15 minutes`
   - Max Requests: `15 requests per IP`
   - Applies to: `/api/reports` to prevent abuse report flooding and spam attacks.

---

## 5. Administrator Authentication Strategy & Public Launch Blocker

### Strategy Specification

- **Password Hashing**: Argon2id (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`) with individual cryptographic salts.
- **Session Tokens**: Cryptographically signed HttpOnly, Secure, `SameSite=Strict` cookies.
- **Multi-Factor Authentication (MFA)**: Mandatory TOTP (Time-based One-Time Password) or WebAuthn hardware tokens for all administrator roles.
- **Zero Public Registration**: No public endpoints exist to register or elevate accounts to administrator privileges. All accounts must be provisioned through secure database seeding scripts with pre-generated secure keys.

> [!CAUTION]
>
> ### Pre-Launch Blocker Notice
>
> Full administrator dashboard access and authentication endpoints are staged in Phase 3. **Public launch is strictly blocked** until the hardened Argon2id authentication service and multi-factor authorization flows are fully audited.
