import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { DbUser } from "../db/database.js";
import { config } from "../config.js";
import {
  getUser,
  addFileRecord,
  getFileRecord,
  deleteFileRecord,
  getAllFileRecords,
  toFileMetadata,
  appendLog,
  canStoreFile,
  getTotalStorageMb,
} from "../store/rooms.js";

function getAuthUser(socket: Socket): DbUser {
  return (socket as unknown as Record<string, unknown>).lcUser as DbUser;
}

const MAX_BYTES = config.maxFileSizeMb * 1024 * 1024;

export function registerFileHandlers(io: Server, socket: Socket): void {
  socket.on(
    "file:init",
    (
      meta: { name: string; size: number; mimeType: string; totalChunks: number; roomId: string },
      ack: (res: { ok: boolean; fileId?: string; error?: string }) => void
    ) => {
      const authUser = getAuthUser(socket);
      const user = getUser(socket.id);
      const username = user?.username ?? authUser.username;

      // Validate the roomId
      const roomId = (meta.roomId ?? "").trim();
      if (!roomId) return ack({ ok: false, error: "roomId required" });

      // For DMs: verify sender is one of the two participants
      if (roomId.startsWith("dm:")) {
        const parts = roomId.slice(3).split(":");
        if (!parts.includes(username)) {
          return ack({ ok: false, error: "Not a participant of this DM" });
        }
      }

      if (meta.size > MAX_BYTES)
        return ack({ ok: false, error: `File too large (max ${config.maxFileSizeMb} MB per file)` });

      if (!canStoreFile(meta.size, config.maxStorageMb))
        return ack({
          ok: false,
          error: `Server storage full (${getTotalStorageMb().toFixed(0)}/${config.maxStorageMb} MB used). Try again shortly.`,
        });

      const fileId = randomUUID();
      addFileRecord({
        id: fileId,
        name: meta.name.slice(0, 255),
        size: meta.size,
        mimeType: meta.mimeType,
        uploadedBy: username,
        room: roomId,
        timestamp: Date.now(),
        expiresAt: Date.now() + config.fileExpiryMinutes * 60 * 1000,
        chunks: new Array(meta.totalChunks),
        totalChunks: meta.totalChunks,
        receivedChunks: 0,
      });
      ack({ ok: true, fileId });
    }
  );

  socket.on("file:chunk", (data: { fileId: string; index: number; chunk: ArrayBuffer | Buffer }) => {
    const record = getFileRecord(data.fileId);
    if (!record) return;

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
      const meta = toFileMetadata(record);

      if (record.room.startsWith("dm:")) {
        const [, a, b] = record.room.split(":");
        for (const s of io.sockets.sockets.values()) {
          const u = getUser(s.id);
          if (u && (u.username === a || u.username === b)) {
            s.emit("file:available", meta);
          }
        }
        const senderUser = getUser(socket.id);
        if (!senderUser) socket.emit("file:available", meta);
        // Log DM file share (no content, just metadata)
        const logMsg = appendLog(`${record.uploadedBy} shared a file in DM (${record.name} · ${(record.size / 1024).toFixed(1)} KB)`);
        io.emit("log:message", logMsg);
      } else {
        io.to(record.room).emit("file:available", meta);
        // Log channel file share
        const logMsg = appendLog(`${record.uploadedBy} shared ${record.name} (${(record.size / 1024).toFixed(1)} KB) in #${record.room}`);
        io.emit("log:message", logMsg);
      }
    }
  });

  socket.on("file:download", (fileId: string, ack: (res: { ok: boolean; error?: string }) => void) => {
    const record = getFileRecord(fileId);
    if (!record) return ack({ ok: false, error: "File not found or expired" });
    if (Date.now() > record.expiresAt) {
      deleteFileRecord(fileId);
      return ack({ ok: false, error: "File expired" });
    }

    // For DMs, verify the requester is a participant
    if (record.room.startsWith("dm:")) {
      const authUser = getAuthUser(socket);
      const user = getUser(socket.id);
      const username = user?.username ?? authUser.username;
      const parts = record.room.slice(3).split(":");
      if (!parts.includes(username)) return ack({ ok: false, error: "Not a participant of this DM" });
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

export function startFileExpiry(): NodeJS.Timeout {
  return setInterval(() => {
    for (const record of getAllFileRecords()) {
      if (Date.now() > record.expiresAt) {
        deleteFileRecord(record.id);
        console.log(`[files] Expired: ${record.name}`);
      }
    }
  }, 60_000);
}
