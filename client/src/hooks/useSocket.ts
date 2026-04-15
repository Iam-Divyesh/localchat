import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";

export function useSocketStatus() {
  const [connected, setConnected] = useState(false);

  // No dep array — re-subscribes every render to always bind to the current socket instance
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try { socket = getSocket(); } catch { return; }

    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  });

  return connected;
}
