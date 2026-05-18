import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import qrcode from "qrcode";
import { config } from "./config.js";
import { registerChatHandlers, logUserJoined } from "./socket/chat.js";
import { registerFileHandlers, startFileExpiry } from "./socket/files.js";
import { startMdns, stopMdns } from "./discovery/mdns.js";
import { startUdpBroadcast, stopUdpBroadcast, getLocalIpExport } from "./discovery/udpBroadcast.js";
import { initDb, closeDb } from "./db/database.js";
import { setPersistMode, connectionCountForUserInNetwork, getAllUsers } from "./store/rooms.js";

export function startServer(overrides: Partial<typeof config> = {}): void {
  const cfg = { ...config, ...overrides };

  if (cfg.persist) {
    initDb(cfg.dataDir);
    setPersistMode(true);
    console.log("[db] Message persistence enabled");
  }

  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: cfg.maxFileSizeMb * 1024 * 1024,
  });

  app.use(express.json());

  // Serve built React client
  // When installed via npm/GitHub, client-dist/ is bundled inside the server package.
  // Locally it falls back to the sibling client/dist for dev convenience.
  const clientDist = (() => {
    const bundled = path.resolve(__dirname, "..", "public");
    const local = path.resolve(__dirname, "..", "client", "dist");
    const fs = require("fs") as typeof import("fs");
    return fs.existsSync(bundled) ? bundled : local;
  })();
  app.use(express.static(clientDist));

  // Health endpoint
  const serverStartTime = Date.now();
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: Math.floor((Date.now() - serverStartTime) / 1000),
      connectedUsers: getAllUsers().length,
      ts: new Date().toISOString(),
    });
  });

  // Discovery endpoint
  app.get("/discover", (_req, res) => {
    const ip = getLocalIpExport();
    const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
    res.json({
      service: cfg.mdnsName,
      url: `http://${ip}${portSuffix}`,
      mdns: `http://${cfg.mdnsName}.local${portSuffix}`,
    });
  });

  // QR code
  app.get("/qr", async (_req, res) => {
    const ip = getLocalIpExport();
    const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
    const url = `http://${ip}${portSuffix}`;
    try {
      const svg = await qrcode.toString(url, { type: "svg" });
      res.setHeader("Content-Type", "image/svg+xml");
      res.send(svg);
    } catch {
      res.status(500).send("QR generation failed");
    }
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Socket.IO middleware — accept username directly (no login required)
  io.use((socket, next) => {
    const username = (socket.handshake.auth?.username as string | undefined)?.trim();
    if (!username || username.length < 2 || username.length > 30) return next(new Error("AUTH_REQUIRED"));
    if (!/^[a-zA-Z0-9 _-]+$/.test(username)) return next(new Error("AUTH_INVALID"));
    (socket as unknown as Record<string, unknown>).lcUser = { username };
    next();
  });

  io.use((socket, next) => {
    const headers = socket.handshake.headers;
    const forwarded = (headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
    const realIp = headers["x-real-ip"] as string | undefined;
    // Behind a reverse proxy (VPS): use client public IP for per-team isolation.
    // Direct LAN access (no proxy headers): everyone shares one space.
    const networkId = forwarded ?? realIp ?? "lan";
    (socket as unknown as Record<string, unknown>).lcNetworkId = networkId;
    next();
  });

  io.on("connection", (socket) => {
    const lcUser = (socket as unknown as Record<string, unknown>).lcUser as { username: string } | undefined;
    const networkId = (socket as unknown as Record<string, unknown>).lcNetworkId as string;

    // Join the network-scoped Socket.IO room for scoped broadcasts
    socket.join(`net:${networkId}`);

    // Count connections BEFORE registering this socket in userMap
    // If count is 0 this is their first tab — log joined
    const existingConnections = lcUser?.username ? connectionCountForUserInNetwork(lcUser.username, networkId) : 1;

    registerChatHandlers(io, socket);
    registerFileHandlers(io, socket);

    if (lcUser?.username && existingConnections === 0) {
      logUserJoined(io, lcUser.username, networkId);
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n✗ Port ${cfg.port} is already in use.`);
      console.error(`  Stop the other process first, or change PORT in server/.env\n`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(cfg.port, "0.0.0.0", () => {
    const ip = getLocalIpExport();
    const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
    const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
    const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
    const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
    console.log(`\n  ${green("LocalChat")}  ${dim("v1.0.0")}\n`);
    console.log(`  ${dim("➜")}  ${dim("Local:")}    ${cyan(`http://localhost${portSuffix}/`)}`);
    console.log(`  ${dim("➜")}  ${dim("Network:")}  ${cyan(`http://${ip}${portSuffix}/`)}`);
    console.log(`  ${dim("➜")}  ${dim("QR code:")}  ${cyan(`http://${ip}${portSuffix}/qr`)}`);
    console.log();

    startMdns(cfg.mdnsName, cfg.port);
    startUdpBroadcast(cfg.mdnsName, cfg.port, cfg.udpBroadcastPort);
    startFileExpiry();
  });

  function shutdown() {
    console.log("\nShutting down...");
    stopMdns();
    stopUdpBroadcast();
    if (cfg.persist) closeDb();
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Only auto-start when run directly (not imported by CLI)
if (require.main === module) {
  startServer();
}
