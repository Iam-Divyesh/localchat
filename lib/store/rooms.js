"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPersistMode = setPersistMode;
exports.createChannel = createChannel;
exports.listChannels = listChannels;
exports.deleteChannel = deleteChannel;
exports.isProtectedChannel = isProtectedChannel;
exports.appendLog = appendLog;
exports.getLogRoom = getLogRoom;
exports.joinRoom = joinRoom;
exports.leaveRoom = leaveRoom;
exports.getUser = getUser;
exports.getRoomUsers = getRoomUsers;
exports.getRoomUsernames = getRoomUsernames;
exports.addMessage = addMessage;
exports.getMessages = getMessages;
exports.getMessagesBefore = getMessagesBefore;
exports.deleteMessage = deleteMessage;
exports.toggleReaction = toggleReaction;
exports.findMessage = findMessage;
exports.pinMessage = pinMessage;
exports.unpinMessage = unpinMessage;
exports.getPinned = getPinned;
exports.searchMessages = searchMessages;
exports.canStoreFile = canStoreFile;
exports.getTotalStorageMb = getTotalStorageMb;
exports.addFileRecord = addFileRecord;
exports.getFileRecord = getFileRecord;
exports.deleteFileRecord = deleteFileRecord;
exports.getAllFileRecords = getAllFileRecords;
exports.toFileMetadata = toFileMetadata;
exports.dmRoomId = dmRoomId;
exports.findSocketByUsername = findSocketByUsername;
exports.findAllSocketsByUsername = findAllSocketsByUsername;
exports.getAllUsers = getAllUsers;
exports.connectionCountForUser = connectionCountForUser;
const crypto_1 = require("crypto");
const database_js_1 = require("../db/database.js");
// ── State ─────────────────────────────────────────────────────
const roomUsers = new Map(); // room → socket ids
const userMap = new Map(); // socket id → user
const usernameToSockets = new Map(); // username → socket ids (O(1) lookup)
const roomMessages = new Map(); // room → messages
const pinnedMessages = new Map(); // room → pinned message
const fileStore = new Map();
let totalStorageBytes = 0; // running total of all file sizes currently in memory
// Server-authoritative channel list (persists as long as server is up)
// Seeded with "general" and "log" on startup
const channelSet = new Set(["general", "log"]);
// Protected channels — cannot be deleted
const PROTECTED = new Set(["general", "log"]);
let persistMode = false;
function setPersistMode(enabled) {
    persistMode = enabled;
}
// ── Channels ──────────────────────────────────────────────────
function createChannel(name) {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40);
    if (!clean || clean.startsWith("dm:"))
        return false;
    const isNew = !channelSet.has(clean);
    channelSet.add(clean);
    if (persistMode)
        (0, database_js_1.ensureRoom)(clean);
    return isNew;
}
function listChannels() {
    return [...channelSet].sort();
}
function deleteChannel(name) {
    if (PROTECTED.has(name))
        return false;
    if (!channelSet.has(name))
        return false;
    channelSet.delete(name);
    roomMessages.delete(name);
    roomUsers.delete(name);
    return true;
}
function isProtectedChannel(name) {
    return PROTECTED.has(name);
}
// ── Activity log ──────────────────────────────────────────────
const LOG_ROOM = "log";
function appendLog(text) {
    const msg = {
        id: (0, crypto_1.randomUUID)(),
        username: "log",
        text,
        timestamp: Date.now(),
        type: "system",
    };
    addMessage(LOG_ROOM, msg);
    return msg;
}
function getLogRoom() { return LOG_ROOM; }
// ── Rooms / users ─────────────────────────────────────────────
function joinRoom(socketId, username, room) {
    userMap.set(socketId, { id: socketId, username, room, joinedAt: Date.now() });
    if (!roomUsers.has(room))
        roomUsers.set(room, new Set());
    roomUsers.get(room).add(socketId);
    // Maintain reverse index
    if (!usernameToSockets.has(username))
        usernameToSockets.set(username, new Set());
    usernameToSockets.get(username).add(socketId);
    if (!roomMessages.has(room)) {
        roomMessages.set(room, persistMode ? (0, database_js_1.getRecentMessages)(room, 100).map(dbMsgToChatMsg) : []);
    }
}
function leaveRoom(socketId) {
    const user = userMap.get(socketId);
    if (!user)
        return undefined;
    const roomSockets = roomUsers.get(user.room);
    roomSockets?.delete(socketId);
    // Keep channel in channelSet and keep message cache — don't delete room
    // Only evict message cache if room is truly empty AND not a named channel
    if (roomSockets?.size === 0 && !channelSet.has(user.room)) {
        roomUsers.delete(user.room);
        roomMessages.delete(user.room);
    }
    // Clean up reverse index
    const userSockets = usernameToSockets.get(user.username);
    if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0)
            usernameToSockets.delete(user.username);
    }
    userMap.delete(socketId);
    return user;
}
function getUser(socketId) {
    return userMap.get(socketId);
}
function getRoomUsers(room) {
    return [...(roomUsers.get(room) ?? [])].map((id) => userMap.get(id)).filter(Boolean);
}
function getRoomUsernames(room) {
    return getRoomUsers(room).map((u) => u.username);
}
function addMessage(room, msg) {
    if (!roomMessages.has(room))
        roomMessages.set(room, []);
    const msgs = roomMessages.get(room);
    msgs.push(msg);
    if (msgs.length > 200)
        msgs.shift();
    if (persistMode && msg.type === "message") {
        try {
            (0, database_js_1.saveMessage)({ ...msg, room });
        }
        catch { /* non-fatal */ }
    }
}
function getMessages(room) {
    if (roomMessages.has(room))
        return roomMessages.get(room);
    // Load from DB on first access even if no one is in the room yet
    if (persistMode) {
        const history = (0, database_js_1.getRecentMessages)(room, 100).map(dbMsgToChatMsg);
        roomMessages.set(room, history);
        return history;
    }
    return [];
}
// Returns a page of messages older than the given timestamp (for infinite scroll)
function getMessagesBefore(room, beforeTimestamp, limit = 50) {
    const msgs = roomMessages.get(room) ?? [];
    return msgs.filter((m) => m.timestamp < beforeTimestamp).slice(-limit);
}
// Deletes a message — returns true if deleted, false if not found or not owner
function deleteMessage(room, msgId, username) {
    const msgs = roomMessages.get(room);
    if (!msgs)
        return false;
    const idx = msgs.findIndex((m) => m.id === msgId);
    if (idx === -1)
        return false;
    if (msgs[idx].username !== username)
        return false;
    msgs.splice(idx, 1);
    return true;
}
// Toggles a reaction — returns the updated message or null if not found
function toggleReaction(room, msgId, emoji, username) {
    const msgs = roomMessages.get(room);
    if (!msgs)
        return null;
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg)
        return null;
    if (!msg.reactions)
        msg.reactions = {};
    const users = msg.reactions[emoji] ?? [];
    const idx = users.indexOf(username);
    if (idx === -1) {
        msg.reactions[emoji] = [...users, username];
    }
    else {
        msg.reactions[emoji] = users.filter((u) => u !== username);
        if (msg.reactions[emoji].length === 0)
            delete msg.reactions[emoji];
    }
    return msg;
}
// Retrieves a message by id from any room map entry
function findMessage(room, msgId) {
    return roomMessages.get(room)?.find((m) => m.id === msgId);
}
// Pinning
function pinMessage(room, msgId) {
    const msg = findMessage(room, msgId);
    if (!msg)
        return null;
    pinnedMessages.set(room, msg);
    return msg;
}
function unpinMessage(room) {
    pinnedMessages.delete(room);
}
function getPinned(room) {
    return pinnedMessages.get(room);
}
// Search messages across all channels visible to the caller
function searchMessages(query) {
    const q = query.toLowerCase();
    const results = [];
    for (const [room, msgs] of roomMessages) {
        if (room.startsWith("dm:"))
            continue; // don't leak DMs
        for (const msg of msgs) {
            if (msg.type === "message" && msg.text.toLowerCase().includes(q)) {
                results.push({ room, msg });
            }
        }
    }
    return results.slice(0, 50); // cap results
}
// ── Files ─────────────────────────────────────────────────────
// Returns false if adding this file would exceed the storage budget
function canStoreFile(sizeBytes, budgetMb) {
    return (totalStorageBytes + sizeBytes) <= budgetMb * 1024 * 1024;
}
function getTotalStorageMb() {
    return totalStorageBytes / (1024 * 1024);
}
function addFileRecord(file) {
    fileStore.set(file.id, file);
    totalStorageBytes += file.size;
}
function getFileRecord(fileId) {
    return fileStore.get(fileId);
}
function deleteFileRecord(fileId) {
    const record = fileStore.get(fileId);
    if (record) {
        totalStorageBytes = Math.max(0, totalStorageBytes - record.size);
        record.chunks = [];
        fileStore.delete(fileId);
    }
}
function getAllFileRecords() {
    return [...fileStore.values()];
}
function toFileMetadata(record) {
    return {
        id: record.id, name: record.name, size: record.size,
        mimeType: record.mimeType, uploadedBy: record.uploadedBy,
        room: record.room,
        timestamp: record.timestamp, expiresAt: record.expiresAt,
    };
}
// ── DMs ───────────────────────────────────────────────────────
function dmRoomId(a, b) {
    return `dm:${[a, b].sort().join(":")}`;
}
function findSocketByUsername(username) {
    const sockets = usernameToSockets.get(username);
    if (!sockets || sockets.size === 0)
        return undefined;
    return [...sockets][0]; // return first socket (for single-tab; DMs go to all tabs via loop in chat.ts)
}
function findAllSocketsByUsername(username) {
    const sockets = usernameToSockets.get(username);
    return sockets ? [...sockets] : [];
}
function getAllUsers() {
    // Deduplicate by username — same user in multiple tabs counts as one
    const seen = new Map();
    for (const u of userMap.values()) {
        if (!seen.has(u.username))
            seen.set(u.username, u);
    }
    return [...seen.values()];
}
// Returns how many active socket connections exist for a username
function connectionCountForUser(username) {
    let count = 0;
    for (const u of userMap.values()) {
        if (u.username === username)
            count++;
    }
    return count;
}
function dbMsgToChatMsg(m) {
    return { id: m.id, username: m.username, text: m.text, timestamp: m.timestamp, type: m.type };
}
