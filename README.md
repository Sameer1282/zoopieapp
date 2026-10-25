# Zoopie ⚡

> Modern real-time interactive communication platform built with Next.js 15, Express, Socket.IO, and strict TypeScript.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange?logo=pnpm)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4-lightgrey?logo=express)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-white?logo=socket.io)](https://socket.io/)
[![Vitest](https://img.shields.io/badge/Vitest-3-yellow?logo=vitest)](https://vitest.dev/)

---

## 📦 Workspace Architecture

This repository is organized as a unified `pnpm` monorepo:

| Package          | Path          | Description                                       | Port   |
| ---------------- | ------------- | ------------------------------------------------- | ------ |
| `@zoopie/web`    | `apps/web`    | Next.js 15 App Router frontend with Tailwind CSS  | `3000` |
| `@zoopie/server` | `apps/server` | Express REST API & Socket.IO WebSocket gateway    | `4000` |
| `@zoopie/shared` | `apps/shared` | Shared TypeScript contracts, types, & Zod schemas | N/A    |

For architectural diagrams and technical deep-dives, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: `v20.0.0` or later (tested on Node `v24.20.0`)
- **pnpm**: `v9.0.0` or later (`npm install -g pnpm`)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Setup

Copy the template configuration:

```bash
cp .env.example .env
```

_(Default values work out of the box for local development)._

### 4. Running the Development Environment

#### Run Full Stack (Frontend + Backend Concurrently)

```bash
pnpm dev
```

- Web Application: [http://localhost:3000](http://localhost:3000)
- Backend Gateway: [http://localhost:4000](http://localhost:4000)
- Health Check: [http://localhost:4000/health](http://localhost:4000/health)

#### Run Services Independently

The frontend and backend are completely decoupled and can run independently:

```bash
# Run backend server only
pnpm dev:server

# Run frontend web app only
pnpm dev:web
```

---

## 🛠️ Monorepo Scripts

| Command             | Action                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`          | Starts server and web concurrently with colored logging                |
| `pnpm dev:server`   | Starts Express & Socket.IO server with hot reloading (`tsx watch`)     |
| `pnpm dev:web`      | Starts Next.js development server at port 3000                         |
| `pnpm build`        | Builds shared package, server, and web application for production      |
| `pnpm test`         | Runs all unit and integration test suites via Vitest across workspaces |
| `pnpm test:watch`   | Runs Vitest in interactive watch mode                                  |
| `pnpm test:e2e`     | Runs Playwright end-to-end tests                                       |
| `pnpm typecheck`    | Validates TypeScript types strictly across all workspaces              |
| `pnpm lint`         | Runs ESLint 9 checks across all source files                           |
| `pnpm format`       | Formats the codebase using Prettier                                    |
| `pnpm format:check` | Checks formatting compliance with Prettier                             |

---

## 🧪 Testing & Verification

### Running Vitest Suites

```bash
pnpm test
```

Vitest tests cover:

- Backend `GET /health` endpoint response and Zod contract compliance.
- Socket.IO connection lifecycle, client handshake, and typed Ping/Pong exchange.
- Web component rendering, variants, and UI contracts.

### Running Health Check Manually

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok",
  "uptime": 42,
  "timestamp": "2026-10-25T13:20:00.000Z",
  "service": "zoopie-server",
  "version": "0.1.0",
  "environment": "development"
}
```

---

## 🔒 Security & Secrets

- Environment configuration is validated at runtime using Zod.
- All secrets are excluded from Git via `.gitignore`.
- `.env.example` provides safe placeholders only.
