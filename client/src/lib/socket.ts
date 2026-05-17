import { io, Socket } from "socket.io-client";

// In cloud mode set VITE_BACKEND_URL to the Render backend URL.
// When unset (LAN self-host), connects to same origin.
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) || undefined;

let socket: Socket | null = null;
let currentUsername: string | null = null;

export function getSocket(): Socket {
  if (!socket) throw new Error("Socket not initialized. Call initSocket(username) first.");
  return socket;
}

export function initSocket(username: string): Socket {
  if (socket && currentUsername === username) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentUsername = username;
  socket = io(BACKEND_URL, {
    transports: ["websocket"],
    auth: { username },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  currentUsername = null;
}
