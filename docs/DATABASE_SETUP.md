# Zoopie Database Setup & Migration Guide

This guide documents the PostgreSQL database architecture, schema migrations, and operational workflows for Zoopie.

---

## 1. Prerequisites & Environment Variables

Zoopie uses **PostgreSQL 15+** managed through **Prisma ORM**.

### Environment Configuration

Ensure your `.env` file (or `apps/server/.env`) contains a valid `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zoopie_dev?schema=public"
```

---

## 2. Quick Start with Docker Compose

If you have Docker installed, spin up a local PostgreSQL instance:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: zoopie-postgres
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: zoopie_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start the container:

```bash
docker compose up -d
```

---

## 3. Database Migration Workflows

### A. Validating the Schema

Validates the Prisma schema syntax and relation consistency:

```bash
pnpm --filter @zoopie/server prisma:validate
```

### B. Generating Prisma Client

Compiles the TypeScript client based on `prisma/schema.prisma`:

```bash
pnpm --filter @zoopie/server prisma:generate
```

### C. Applying Migrations

Apply existing migrations to the configured database:

```bash
pnpm --filter @zoopie/server exec prisma migrate deploy
```

### D. Developing New Migrations

In development with an active database connection:

```bash
pnpm --filter @zoopie/server exec prisma migrate dev --name <migration_name>
```

### E. Offline Migration Inspection

If PostgreSQL is offline or you wish to inspect the generated DDL:

```bash
pnpm --filter @zoopie/server exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

---

## 4. Schema Architecture & Justified Models

| Model                     | Purpose                             | Data Privacy Rules                                                                  |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `UserSession`             | Opaque participant session          | Raw IP addresses are **never** stored; only salted SHA-256 fingerprint hashes.      |
| `Conversation`            | Match & session metadata            | Stores only timestamps, duration, and mode. **Chat text and media are NOT stored.** |
| `ConversationParticipant` | Session-to-conversation mapping     | Cascade-deletes with parent session.                                                |
| `UserBlock`               | Prevents future re-pairing          | Uses hashed peer fingerprint.                                                       |
| `AbuseReport`             | Trust & Safety reports              | Category, optional detail text, and status workflow.                                |
| `ModerationAction`        | Audit trail of moderation decisions | Records action type (warning, ban, termination) and assigned admin.                 |
| `AdminUser`               | Moderator & administrator accounts  | Password hashed with Argon2id; zero public registration endpoints.                  |
| `InterestTag`             | Matchmaking topic tags              | Curated and community topic index.                                                  |

---

## 5. Visual Database Inspection

To visually inspect and manage records:

```bash
pnpm --filter @zoopie/server exec prisma studio
```

Prisma Studio opens at [http://localhost:5555](http://localhost:5555).
