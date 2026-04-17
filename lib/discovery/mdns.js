"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMdns = startMdns;
exports.stopMdns = stopMdns;
const bonjour_service_1 = require("bonjour-service");
let bonjour = null;
function startMdns(name, port) {
    try {
        bonjour = new bonjour_service_1.Bonjour();
        const service = bonjour.publish({ name, type: "http", port, txt: { path: "/", version: "1.0" } });
        service.on("error", (err) => {
            if (err.message?.includes("already in use")) {
                console.warn("[mDNS] Name conflict — another LocalChat is on this network. Discovery still works via UDP broadcast.");
            }
            else {
                console.warn("[mDNS] Service error (non-fatal):", err.message);
            }
        });
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
