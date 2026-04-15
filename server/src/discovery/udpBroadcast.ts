import dgram from "dgram";
import os from "os";

let socket: dgram.Socket | null = null;
let interval: NodeJS.Timeout | null = null;

export function getLocalIpExport(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "127.0.0.1";
}

export function startUdpBroadcast(name: string, port: number, broadcastPort: number): void {
  try {
    socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    socket.bind(() => {
      socket?.setBroadcast(true);

      const broadcast = () => {
        const ip = getLocalIpExport();
        const portSuffix = port === 80 ? "" : `:${port}`;
        const msg = Buffer.from(
          JSON.stringify({
            service: name,
            url: `http://${ip}${portSuffix}`,
            mdns: `http://${name}.local${portSuffix}`,
          })
        );
        socket?.send(msg, 0, msg.length, broadcastPort, "255.255.255.255");
      };

      broadcast();
      interval = setInterval(broadcast, 10_000);
      console.log(`[UDP] Broadcasting on port ${broadcastPort} every 10s`);
    });
  } catch (err) {
    console.warn("[UDP] Broadcast failed (non-fatal):", (err as Error).message);
  }
}

export function stopUdpBroadcast(): void {
  if (interval) clearInterval(interval);
  socket?.close();
}
