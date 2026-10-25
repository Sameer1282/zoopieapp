/**
 * Zoopie Deployment & Health Verification Script
 *
 * Runs non-destructive health, CORS, Socket.IO, and WebRTC checks
 * against local, staging, or production deployments.
 *
 * Usage:
 *   pnpm tsx scripts/verify-deployment.ts [API_URL] [WEB_URL]
 *
 * Example:
 *   pnpm tsx scripts/verify-deployment.ts http://localhost:4000 http://localhost:3000
 *   pnpm tsx scripts/verify-deployment.ts https://zoopie-server.onrender.com https://zoopie.vercel.app
 */

import { io } from 'socket.io-client';

const apiUrl = process.argv[2] || process.env.API_URL || 'http://localhost:4000';
const webUrl = process.argv[3] || process.env.WEB_URL || 'http://localhost:3000';

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  isWarning?: boolean;
}

const results: CheckResult[] = [];

async function runChecks() {
  console.log(`\n======================================================`);
  console.log(`🔍  Zoopie Deployment Verification`);
  console.log(`📡  Target Backend API: ${apiUrl}`);
  console.log(`🌐  Target Frontend Web: ${webUrl}`);
  console.log(`======================================================\n`);

  // 1. Backend Liveness Probe (GET /health)
  try {
    const res = await fetch(`${apiUrl}/health`);
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      results.push({
        name: 'Backend Liveness Probe (GET /health)',
        passed: true,
        details: `HTTP ${res.status} OK (Uptime: ${data.uptime}s, Node: ${data.nodeVersion})`,
      });

      if (!data.turnConfigured) {
        results.push({
          name: 'WebRTC TURN Relay Verification',
          passed: false,
          isWarning: true,
          details:
            'TURN_SERVER_URL is unset. Direct P2P calls will work in test, but media relay behind symmetric NATs is unconfigured.',
        });
      } else {
        results.push({
          name: 'WebRTC TURN Relay Verification',
          passed: true,
          details: 'TURN relay server is configured and active.',
        });
      }
    } else {
      results.push({
        name: 'Backend Liveness Probe (GET /health)',
        passed: false,
        details: `Unexpected response: HTTP ${res.status} - ${JSON.stringify(data)}`,
      });
    }
  } catch (err) {
    results.push({
      name: 'Backend Liveness Probe (GET /health)',
      passed: false,
      details: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 2. Backend Readiness Probe (GET /ready)
  try {
    const res = await fetch(`${apiUrl}/ready`);
    const data = await res.json();
    if (res.ok && data.ready) {
      results.push({
        name: 'Backend Readiness Probe (GET /ready)',
        passed: true,
        details: `HTTP ${res.status} OK (DB: ${data.database}, Heap: ${data.memory?.heapUsedMb}MB, RSS: ${data.memory?.rssMb}MB)`,
      });
    } else {
      results.push({
        name: 'Backend Readiness Probe (GET /ready)',
        passed: false,
        details: `Server is not ready: HTTP ${res.status} - ${JSON.stringify(data)}`,
      });
    }
  } catch (err) {
    results.push({
      name: 'Backend Readiness Probe (GET /ready)',
      passed: false,
      details: `Readiness check failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 3. CORS Policy Enforcement
  try {
    // Unapproved Origin Check
    const unapprovedRes = await fetch(`${apiUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://unauthorized-malicious-domain.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const unapprovedHeader = unapprovedRes.headers.get('access-control-allow-origin');
    const isUnapprovedBlocked = !unapprovedHeader || unapprovedHeader === 'null';

    results.push({
      name: 'CORS Rejection of Unapproved Origins',
      passed: isUnapprovedBlocked,
      details: isUnapprovedBlocked
        ? 'Unapproved origin correctly rejected (no Access-Control-Allow-Origin header granted).'
        : `Security warning: Origin was permitted with header '${unapprovedHeader}'.`,
    });

    // Approved Origin Check
    const approvedRes = await fetch(`${apiUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: webUrl,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const approvedHeader = approvedRes.headers.get('access-control-allow-origin');
    const isApprovedAllowed = approvedHeader === webUrl || approvedHeader === '*';

    results.push({
      name: 'CORS Acceptance of Configured Frontend Origin',
      passed: isApprovedAllowed,
      details: isApprovedAllowed
        ? `Configured frontend origin '${webUrl}' successfully authorized.`
        : `Failed to authorize origin '${webUrl}'. Received header: '${approvedHeader}'.`,
    });
  } catch (err) {
    results.push({
      name: 'CORS Policy Enforcement',
      passed: false,
      details: `CORS preflight failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4. WebRTC ICE Configuration (GET /api/webrtc/ice-servers)
  try {
    const res = await fetch(`${apiUrl}/api/webrtc/ice-servers`);
    const data = await res.json();
    if (res.ok && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      const stringified = JSON.stringify(data);
      const hasLeakedSecrets =
        stringified.includes('ADMIN_SECRET_KEY') ||
        stringified.includes('zoopie-moderator-secret') ||
        stringified.includes('TURN_SERVER_SECRET');

      results.push({
        name: 'WebRTC Ephemeral ICE Servers Endpoint',
        passed: !hasLeakedSecrets,
        details: !hasLeakedSecrets
          ? `Received ${data.iceServers.length} ICE server(s). Secrets verified unexposed.`
          : 'CRITICAL SECURITY DEFECT: Server secrets leaked in ICE response payload!',
      });
    } else {
      results.push({
        name: 'WebRTC Ephemeral ICE Servers Endpoint',
        passed: false,
        details: `Invalid ICE servers response: HTTP ${res.status}`,
      });
    }
  } catch (err) {
    results.push({
      name: 'WebRTC Ephemeral ICE Servers Endpoint',
      passed: false,
      details: `Failed to fetch ICE servers: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 5. Socket.IO WebSocket Upgrade Check
  await new Promise<void>(resolve => {
    try {
      const socket = io(apiUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: false,
      });

      const timer = setTimeout(() => {
        results.push({
          name: 'Socket.IO Real-Time Gateway Handshake',
          passed: false,
          details: 'Socket connection timed out after 5000ms.',
        });
        socket.disconnect();
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timer);
        results.push({
          name: 'Socket.IO Real-Time Gateway Handshake',
          passed: true,
          details: `Connected successfully (Socket ID: ${socket.id}, Transport: ${socket.io.engine.transport.name})`,
        });
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', err => {
        clearTimeout(timer);
        results.push({
          name: 'Socket.IO Real-Time Gateway Handshake',
          passed: false,
          details: `Connection failed: ${err.message}`,
        });
        socket.disconnect();
        resolve();
      });
    } catch (err) {
      results.push({
        name: 'Socket.IO Real-Time Gateway Handshake',
        passed: false,
        details: `Socket init error: ${err instanceof Error ? err.message : String(err)}`,
      });
      resolve();
    }
  });

  // 6. Frontend Reachability Check
  try {
    const res = await fetch(webUrl);
    const html = await res.text();
    const hasZoopieBranding = html.includes('Zoopie') || html.includes('zoopie');

    results.push({
      name: 'Frontend Reachability & HTML Metadata',
      passed: res.ok && hasZoopieBranding,
      details:
        res.ok && hasZoopieBranding
          ? `HTTP ${res.status} OK (Verified Zoopie brand markup in HTML response).`
          : `Unexpected response: HTTP ${res.status}`,
    });
  } catch (err) {
    results.push({
      name: 'Frontend Reachability & HTML Metadata',
      passed: false,
      details: `Frontend unreachable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Summary Report
  console.log('------------------------------------------------------');
  console.log('📋  Verification Report Summary:');
  console.log('------------------------------------------------------');

  let hasFatalFailure = false;

  for (const r of results) {
    const symbol = r.passed ? '✅' : r.isWarning ? '⚠️ ' : '❌';
    console.log(`${symbol}  ${r.name}: ${r.details}`);
    if (!r.passed && !r.isWarning) {
      hasFatalFailure = true;
    }
  }

  console.log('------------------------------------------------------');
  if (hasFatalFailure) {
    console.log('❌  Verification detected blocking deployment issues.');
    process.exit(1);
  } else {
    console.log('🎉  All automated deployment verification checks passed!');
    process.exit(0);
  }
}

runChecks().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
