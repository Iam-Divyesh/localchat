import { Bonjour } from "bonjour-service";

let bonjour: Bonjour | null = null;

export function startMdns(name: string, port: number): void {
  try {
    // Temporarily catch the async "Service name already in use" error
    // that bonjour-service throws from an internal EventEmitter
    const handler = (err: Error) => {
      if (err.message?.includes("already in use")) {
        console.warn("[mDNS] Name conflict on network (non-fatal) — discovery still works via UDP");
      } else {
        // Re-throw non-mDNS errors
        throw err;
      }
    };
    process.on("uncaughtException", handler);

    bonjour = new Bonjour();
    const service = bonjour.publish({ name, type: "http", port, txt: { path: "/", version: "1.0" } });

    service.on("error", (err: Error) => {
      console.warn("[mDNS] Service error (non-fatal):", err.message);
    });

    // Remove the temporary handler after a short delay (the async probe takes ~1-2s)
    setTimeout(() => process.removeListener("uncaughtException", handler), 5000);

    const portSuffix = port === 80 ? "" : `:${port}`;
    console.log(`[mDNS] Announced as http://${name}.local${portSuffix}`);
  } catch (err) {
    console.warn("[mDNS] Could not announce (non-fatal):", (err as Error).message);
  }
}

export function stopMdns(): void {
  try {
    bonjour?.unpublishAll();
    bonjour?.destroy();
  } catch {
    // ignore cleanup errors
  }
}
