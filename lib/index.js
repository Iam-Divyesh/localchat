"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const qrcode_1 = __importDefault(require("qrcode"));
const config_js_1 = require("./config.js");
const chat_js_1 = require("./socket/chat.js");
const files_js_1 = require("./socket/files.js");
const mdns_js_1 = require("./discovery/mdns.js");
const udpBroadcast_js_1 = require("./discovery/udpBroadcast.js");
const database_js_1 = require("./db/database.js");
const rooms_js_1 = require("./store/rooms.js");
function startServer(overrides = {}) {
    const cfg = { ...config_js_1.config, ...overrides };
    if (cfg.persist) {
        (0, database_js_1.initDb)(cfg.dataDir);
        (0, rooms_js_1.setPersistMode)(true);
        console.log("[db] Message persistence enabled");
    }
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const io = new socket_io_1.Server(server, {
        cors: { origin: "*", methods: ["GET", "POST"] },
        maxHttpBufferSize: cfg.maxFileSizeMb * 1024 * 1024,
    });
    app.use(express_1.default.json());
    // Serve built React client
    // When installed via npm/GitHub, client-dist/ is bundled inside the server package.
    // Locally it falls back to the sibling client/dist for dev convenience.
    const clientDist = (() => {
        const bundled = path_1.default.resolve(__dirname, "..", "public");
        const local = path_1.default.resolve(__dirname, "..", "client", "dist");
        const fs = require("fs");
        return fs.existsSync(bundled) ? bundled : local;
    })();
    app.use(express_1.default.static(clientDist));
    // Health endpoint
    const serverStartTime = Date.now();
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            uptime: Math.floor((Date.now() - serverStartTime) / 1000),
            connectedUsers: (0, rooms_js_1.getAllUsers)().length,
            ts: new Date().toISOString(),
        });
    });
    // Discovery endpoint
    app.get("/discover", (_req, res) => {
        const ip = (0, udpBroadcast_js_1.getLocalIpExport)();
        const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
        res.json({
            service: cfg.mdnsName,
            url: `http://${ip}${portSuffix}`,
            mdns: `http://${cfg.mdnsName}.local${portSuffix}`,
        });
    });
    // QR code
    app.get("/qr", async (_req, res) => {
        const ip = (0, udpBroadcast_js_1.getLocalIpExport)();
        const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
        const url = `http://${ip}${portSuffix}`;
        try {
            const svg = await qrcode_1.default.toString(url, { type: "svg" });
            res.setHeader("Content-Type", "image/svg+xml");
            res.send(svg);
        }
        catch {
            res.status(500).send("QR generation failed");
        }
    });
    app.get("*", (_req, res) => {
        res.sendFile(path_1.default.join(clientDist, "index.html"));
    });
    // Socket.IO middleware — accept username directly (no login required)
    io.use((socket, next) => {
        const username = socket.handshake.auth?.username?.trim();
        if (!username || username.length < 2 || username.length > 30)
            return next(new Error("AUTH_REQUIRED"));
        if (!/^[a-zA-Z0-9 _-]+$/.test(username))
            return next(new Error("AUTH_INVALID"));
        socket.lcUser = { username };
        next();
    });
    // Extract client public IP for network isolation
    // Behind Nginx, the real IP arrives via X-Forwarded-For
    io.use((socket, next) => {
        const forwarded = socket.handshake.headers["x-forwarded-for"];
        const ip = forwarded?.split(",")[0]?.trim() ?? socket.handshake.address;
        socket.lcNetworkId = ip;
        next();
    });
    io.on("connection", (socket) => {
        const lcUser = socket.lcUser;
        const networkId = socket.lcNetworkId;
        // Join the network-scoped Socket.IO room for scoped broadcasts
        socket.join(`net:${networkId}`);
        // Count connections BEFORE registering this socket in userMap
        // If count is 0 this is their first tab — log joined
        const existingConnections = lcUser?.username ? (0, rooms_js_1.connectionCountForUserInNetwork)(lcUser.username, networkId) : 1;
        (0, chat_js_1.registerChatHandlers)(io, socket);
        (0, files_js_1.registerFileHandlers)(io, socket);
        if (lcUser?.username && existingConnections === 0) {
            (0, chat_js_1.logUserJoined)(io, lcUser.username, networkId);
        }
    });
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n✗ Port ${cfg.port} is already in use.`);
            console.error(`  Stop the other process first, or change PORT in server/.env\n`);
            process.exit(1);
        }
        throw err;
    });
    server.listen(cfg.port, "0.0.0.0", () => {
        const ip = (0, udpBroadcast_js_1.getLocalIpExport)();
        const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
        const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
        const green = (s) => `\x1b[32m${s}\x1b[0m`;
        const dim = (s) => `\x1b[2m${s}\x1b[0m`;
        console.log(`\n  ${green("LocalChat")}  ${dim("v1.0.0")}\n`);
        console.log(`  ${dim("➜")}  ${dim("Local:")}    ${cyan(`http://localhost${portSuffix}/`)}`);
        console.log(`  ${dim("➜")}  ${dim("Network:")}  ${cyan(`http://${ip}${portSuffix}/`)}`);
        console.log(`  ${dim("➜")}  ${dim("QR code:")}  ${cyan(`http://${ip}${portSuffix}/qr`)}`);
        console.log();
        (0, mdns_js_1.startMdns)(cfg.mdnsName, cfg.port);
        (0, udpBroadcast_js_1.startUdpBroadcast)(cfg.mdnsName, cfg.port, cfg.udpBroadcastPort);
        (0, files_js_1.startFileExpiry)();
    });
    function shutdown() {
        console.log("\nShutting down...");
        (0, mdns_js_1.stopMdns)();
        (0, udpBroadcast_js_1.stopUdpBroadcast)();
        if (cfg.persist)
            (0, database_js_1.closeDb)();
        server.close(() => process.exit(0));
    }
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
// Only auto-start when run directly (not imported by CLI)
if (require.main === module) {
    startServer();
}
