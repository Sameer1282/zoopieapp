import { z } from 'zod';

export const RtcIceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const WebRtcOfferPayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  sdp: z.string().min(1).max(50000, { message: 'SDP offer exceeds size limit' }),
  type: z.literal('offer'),
});

export const WebRtcAnswerPayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  sdp: z.string().min(1).max(50000, { message: 'SDP answer exceeds size limit' }),
  type: z.literal('answer'),
});

export const WebRtcIceCandidatePayloadSchema = z.object({
  matchId: z.string().min(1).max(128),
  candidate: RtcIceCandidateSchema,
});

export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema),
  ttl: z.number().positive(),
});

export type RtcIceCandidate = z.infer<typeof RtcIceCandidateSchema>;
export type WebRtcOfferPayload = z.infer<typeof WebRtcOfferPayloadSchema>;
export type WebRtcAnswerPayload = z.infer<typeof WebRtcAnswerPayloadSchema>;
export type WebRtcIceCandidatePayload = z.infer<typeof WebRtcIceCandidatePayloadSchema>;
export type IceServer = z.infer<typeof IceServerSchema>;
export type IceServersResponse = z.infer<typeof IceServersResponseSchema>;
