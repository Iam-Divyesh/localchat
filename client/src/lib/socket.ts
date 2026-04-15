import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket {
  if (!socket) throw new Error("Socket not initialized. Call initSocket(token) first.");
  return socket;
}

export function initSocket(token: string): Socket {
  // Reuse existing socket if token unchanged and still connected
  if (socket && currentToken === token) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io({
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Stop reconnecting on auth errors — token is invalid/expired
  socket.on("connect_error", (err) => {
    const msg = err.message;
    if (msg === "AUTH_REQUIRED" || msg === "AUTH_INVALID") {
      const s = socket;
      if (s) { s.io.opts.reconnection = false; s.disconnect(); }
      // Signal the app to log out
      window.dispatchEvent(new CustomEvent("lc:auth_error"));
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
