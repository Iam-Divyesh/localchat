"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMdns = startMdns;
exports.stopMdns = stopMdns;
const bonjour_service_1 = require("bonjour-service");
let bonjour = null;
function startMdns(name, port) {
    try {
        bonjour = new bonjour_service_1.Bonjour();
        bonjour.publish({ name, type: "http", port, txt: { path: "/", version: "1.0" } });
        const portSuffix = port === 80 ? "" : `:${port}`;
        console.log(`[mDNS] Announced as http://${name}.local${portSuffix}`);
    }
    catch (err) {
        console.warn("[mDNS] Could not announce (non-fatal):", err.message);
    }
}
function stopMdns() {
    bonjour?.unpublishAll();
    bonjour?.destroy();
}
