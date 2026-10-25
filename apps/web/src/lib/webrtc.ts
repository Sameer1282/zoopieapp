import { config } from './config';
import { IceServersResponseSchema } from '@zoopie/shared';

export const DEFAULT_STUN_SERVER: RTCIceServer = {
  urls: ['stun:stun.l.google.com:19302'],
};

/**
 * Fetches safe, authorized ICE servers (STUN/TURN) from the backend.
 * Never stores or requests raw TURN secrets in client code.
 */
export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${config.apiUrl}/api/webrtc/ice-servers`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [DEFAULT_STUN_SERVER];
    }

    const data = await res.json();
    const parsed = IceServersResponseSchema.safeParse(data);

    if (parsed.success && parsed.data.iceServers.length > 0) {
      return parsed.data.iceServers as RTCIceServer[];
    }

    return [DEFAULT_STUN_SERVER];
  } catch {
    // Fallback to default public STUN server if backend route is unreachable
    return [DEFAULT_STUN_SERVER];
  }
}

/**
 * Safe diagnostics snapshot of an RTCPeerConnection.
 * Never leaks private media streams, SDP credentials, or IP topology.
 */
export interface WebRtcDiagnostics {
  connectionState: RTCPeerConnectionState | 'uninitialized';
  iceConnectionState: RTCIceConnectionState | 'uninitialized';
  iceGatheringState: RTCIceGatheringState | 'uninitialized';
  signalingState: RTCSignalingState | 'uninitialized';
  localTracksCount: number;
  remoteTracksCount: number;
}

export function getSafeDiagnostics(
  pc: RTCPeerConnection | null,
  localStream: MediaStream | null,
  remoteStream: MediaStream | null
): WebRtcDiagnostics {
  if (!pc) {
    return {
      connectionState: 'uninitialized',
      iceConnectionState: 'uninitialized',
      iceGatheringState: 'uninitialized',
      signalingState: 'uninitialized',
      localTracksCount: localStream ? localStream.getTracks().length : 0,
      remoteTracksCount: remoteStream ? remoteStream.getTracks().length : 0,
    };
  }

  return {
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    signalingState: pc.signalingState,
    localTracksCount: localStream ? localStream.getTracks().length : 0,
    remoteTracksCount: remoteStream ? remoteStream.getTracks().length : 0,
  };
}

