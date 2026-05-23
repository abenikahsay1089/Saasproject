import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/**
 * Creates a Socket.io client with JWT in handshake `auth.token`.
 */
export function createSocket(token) {
  return io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
  });
}
