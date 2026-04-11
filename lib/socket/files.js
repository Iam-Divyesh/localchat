"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileHandlers = registerFileHandlers;
exports.startFileExpiry = startFileExpiry;
const crypto_1 = require("crypto");
const config_js_1 = require("../config.js");
const rooms_js_1 = require("../store/rooms.js");
function getAuthUser(socket) {
    return socket.lcUser;
}
const MAX_BYTES = config_js_1.config.maxFileSizeMb * 1024 * 1024;
function registerFileHandlers(io, socket) {
    socket.on("file:init", (meta, ack) => {
        const authUser = getAuthUser(socket);
        const user = (0, rooms_js_1.getUser)(socket.id);
        const username = user?.username ?? authUser.username;
        // Validate the roomId
        const roomId = (meta.roomId ?? "").trim();
        if (!roomId)
            return ack({ ok: false, error: "roomId required" });
        // For DMs: verify sender is one of the two participants
        if (roomId.startsWith("dm:")) {
            const parts = roomId.slice(3).split(":");
            if (!parts.includes(username)) {
                return ack({ ok: false, error: "Not a participant of this DM" });
            }
        }
        if (meta.size > MAX_BYTES)
            return ack({ ok: false, error: `File too large (max ${config_js_1.config.maxFileSizeMb} MB per file)` });
        if (!(0, rooms_js_1.canStoreFile)(meta.size, config_js_1.config.maxStorageMb))
            return ack({
                ok: false,
                error: `Server storage full (${(0, rooms_js_1.getTotalStorageMb)().toFixed(0)}/${config_js_1.config.maxStorageMb} MB used). Try again shortly.`,
            });
        const fileId = (0, crypto_1.randomUUID)();
        (0, rooms_js_1.addFileRecord)({
            id: fileId,
            name: meta.name.slice(0, 255),
            size: meta.size,
            mimeType: meta.mimeType,
            uploadedBy: username,
            room: roomId,
            timestamp: Date.now(),
            expiresAt: Date.now() + config_js_1.config.fileExpiryMinutes * 60 * 1000,
            chunks: new Array(meta.totalChunks),
            totalChunks: meta.totalChunks,
            receivedChunks: 0,
        });
        ack({ ok: true, fileId });
    });
    socket.on("file:chunk", (data) => {
        const record = (0, rooms_js_1.getFileRecord)(data.fileId);
        if (!record)
            return;
        const buf = Buffer.isBuffer(data.chunk)
            ? data.chunk
            : Buffer.from(new Uint8Array(data.chunk));
        record.chunks[data.index] = buf;
        record.receivedChunks += 1;
        socket.emit("file:progress", {
            fileId: data.fileId,
            received: record.receivedChunks,
            total: record.totalChunks,
        });
        if (record.receivedChunks === record.totalChunks) {
            const meta = (0, rooms_js_1.toFileMetadata)(record);
            if (record.room.startsWith("dm:")) {
                const [, a, b] = record.room.split(":");
                for (const s of io.sockets.sockets.values()) {
                    const u = (0, rooms_js_1.getUser)(s.id);
                    if (u && (u.username === a || u.username === b)) {
                        s.emit("file:available", meta);
                    }
                }
                const senderUser = (0, rooms_js_1.getUser)(socket.id);
                if (!senderUser)
                    socket.emit("file:available", meta);
                // Log DM file share (no content, just metadata)
                const logMsg = (0, rooms_js_1.appendLog)(`${record.uploadedBy} shared a file in DM (${record.name} · ${(record.size / 1024).toFixed(1)} KB)`);
                io.emit("log:message", logMsg);
            }
            else {
                io.to(record.room).emit("file:available", meta);
                // Log channel file share
                const logMsg = (0, rooms_js_1.appendLog)(`${record.uploadedBy} shared ${record.name} (${(record.size / 1024).toFixed(1)} KB) in #${record.room}`);
                io.emit("log:message", logMsg);
            }
        }
    });
    socket.on("file:download", (fileId, ack) => {
        const record = (0, rooms_js_1.getFileRecord)(fileId);
        if (!record)
            return ack({ ok: false, error: "File not found or expired" });
        if (Date.now() > record.expiresAt) {
            (0, rooms_js_1.deleteFileRecord)(fileId);
            return ack({ ok: false, error: "File expired" });
        }
        // For DMs, verify the requester is a participant
        if (record.room.startsWith("dm:")) {
            const authUser = getAuthUser(socket);
            const user = (0, rooms_js_1.getUser)(socket.id);
            const username = user?.username ?? authUser.username;
            const parts = record.room.slice(3).split(":");
            if (!parts.includes(username))
                return ack({ ok: false, error: "Not a participant of this DM" });
        }
        ack({ ok: true });
        for (let i = 0; i < record.chunks.length; i++) {
            socket.emit("file:chunk:recv", {
                fileId,
                index: i,
                chunk: record.chunks[i],
                total: record.totalChunks,
            });
        }
    });
}
function startFileExpiry() {
    return setInterval(() => {
        for (const record of (0, rooms_js_1.getAllFileRecords)()) {
            if (Date.now() > record.expiresAt) {
                (0, rooms_js_1.deleteFileRecord)(record.id);
                console.log(`[files] Expired: ${record.name}`);
            }
        }
    }, 60000);
}
