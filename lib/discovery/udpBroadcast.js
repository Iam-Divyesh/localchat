"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalIpExport = getLocalIpExport;
exports.startUdpBroadcast = startUdpBroadcast;
exports.stopUdpBroadcast = stopUdpBroadcast;
const dgram_1 = __importDefault(require("dgram"));
const os_1 = __importDefault(require("os"));
let socket = null;
let interval = null;
function getLocalIpExport() {
    const ifaces = os_1.default.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
        for (const addr of iface ?? []) {
            if (addr.family === "IPv4" && !addr.internal)
                return addr.address;
        }
    }
    return "127.0.0.1";
}
function startUdpBroadcast(name, port, broadcastPort) {
    try {
        socket = dgram_1.default.createSocket({ type: "udp4", reuseAddr: true });
        socket.bind(() => {
            socket?.setBroadcast(true);
            const broadcast = () => {
                const ip = getLocalIpExport();
                const portSuffix = port === 80 ? "" : `:${port}`;
                const msg = Buffer.from(JSON.stringify({
                    service: name,
                    url: `http://${ip}${portSuffix}`,
                    mdns: `http://${name}.local${portSuffix}`,
                }));
                socket?.send(msg, 0, msg.length, broadcastPort, "255.255.255.255");
            };
            broadcast();
            interval = setInterval(broadcast, 10000);
            console.log(`[UDP] Broadcasting on port ${broadcastPort} every 10s`);
        });
    }
    catch (err) {
        console.warn("[UDP] Broadcast failed (non-fatal):", err.message);
    }
}
function stopUdpBroadcast() {
    if (interval)
        clearInterval(interval);
    socket?.close();
}
