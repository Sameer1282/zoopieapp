import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { IceServersResponseSchema, type IceServer } from '@zoopie/shared';
import { logger } from '../utils/logger.js';

export const webrtcRouter = Router();

/**
 * GET /api/webrtc/ice-servers
 * Provides safe, authorized ICE server configuration (STUN/TURN)
 * without exposing TURN shared secrets to the frontend client.
 */
webrtcRouter.get('/api/webrtc/ice-servers', (req: Request, res: Response, next: NextFunction) => {
  try {
    const iceServers: IceServer[] = [];

    // 1. Primary Public STUN Server(s)
    const stunUrls = env.STUN_SERVER_URL.split(',')
      .map(u => u.trim())
      .filter(Boolean);

    if (stunUrls.length > 0) {
      iceServers.push({
        urls: stunUrls,
      });
    }

    // 2. TURN Server (Relay for restrictive NATs)
    if (env.TURN_SERVER_URL) {
      const turnUrls = env.TURN_SERVER_URL.split(',')
        .map(u => u.trim())
        .filter(Boolean);

      if (env.TURN_SERVER_SECRET) {
        // Standard RFC 5766 / REST API for Ephemeral TURN Credentials (HMAC-SHA1)
        const ttl = env.TURN_CREDENTIAL_TTL_SECONDS || 86400;
        const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
        const ephemeralUsername = `${expiryTimestamp}:${crypto.randomUUID()}`;

        const hmac = crypto.createHmac('sha1', env.TURN_SERVER_SECRET);
        hmac.update(ephemeralUsername);
        const ephemeralPassword = hmac.digest('base64');

        iceServers.push({
          urls: turnUrls,
          username: ephemeralUsername,
          credential: ephemeralPassword,
        });
      } else if (env.TURN_SERVER_USERNAME && env.TURN_SERVER_CREDENTIAL) {
        iceServers.push({
          urls: turnUrls,
          username: env.TURN_SERVER_USERNAME,
          credential: env.TURN_SERVER_CREDENTIAL,
        });
      }
    }

    const responsePayload = {
      iceServers,
      ttl: env.TURN_CREDENTIAL_TTL_SECONDS || 86400,
    };

    const validated = IceServersResponseSchema.parse(responsePayload);

    logger.info('ICE server configuration issued', {
      requestId: req.id,
      serversCount: iceServers.length,
      hasTurn: Boolean(env.TURN_SERVER_URL),
    });

    res.status(200).json(validated);
  } catch (err) {
    next(err);
  }
});
