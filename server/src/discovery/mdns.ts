import { Bonjour } from "bonjour-service";

let bonjour: Bonjour | null = null;

export function startMdns(name: string, port: number): void {
  try {
    bonjour = new Bonjour();
    const service = bonjour.publish({ name, type: "http", port, txt: { path: "/", version: "1.0" } });

    service.on("error", (err: Error) => {
      if (err.message?.includes("already in use")) {
        console.warn("[mDNS] Name conflict — another LocalChat is on this network. Discovery still works via UDP broadcast.");
      } else {
        console.warn("[mDNS] Service error (non-fatal):", err.message);
      }
    });

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
