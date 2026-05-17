"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatHandlers = registerChatHandlers;
exports.logUserJoined = logUserJoined;
const crypto_1 = require("crypto");
const database_js_1 = require("../db/database.js");
const rooms_js_1 = require("../store/rooms.js");
const SOCKET_EVENTS = {
    ROOM_JOIN: "room:join",
    ROOM_USERS: "room:users",
    CHANNELS_LIST: "channels:list",
    CHANNELS_UPDATE: "channels:update",
    CHANNEL_CREATE: "channel:create",
    CHANNEL_DELETE: "channel:delete",
    CHANNEL_DELETED: "channel:deleted",
    MESSAGE_SEND: "message:send",
    MESSAGE: "message",
    MESSAGE_UPDATE: "message:update",
    REACTION_TOGGLE: "reaction:toggle",
    PIN_SET: "pin:set",
    PIN_CLEAR: "pin:clear",
    PIN_UPDATE: "pin:update",
    SEARCH: "search",
    TYPING_START: "typing:start",
    TYPING_STOP: "typing:stop",
    TYPING_UPDATE: "typing:update",
    DM_SEND: "dm:send",
    DM_RECEIVE: "dm:receive",
    DM_TYPING: "dm:typing",
    MENTION: "mention",
    USERS_ALL: "users:all",
    LOG_MESSAGE: "log:message",
    USER_PROFILE: "user:profile",
};
function getAuthUser(socket) {
    return socket.lcUser;
}
function getNetworkId(socket) {
    return socket.lcNetworkId;
}
// Returns the Socket.IO network room key for broadcasting to all sockets on the same network
function netRoom(networkId) {
    return `net:${networkId}`;
}
// Converts a client-facing room name to the server-internal prefixed room key
function toServerRoom(networkId, clientRoom) {
    return `${networkId}:${clientRoom}`;
}
// Strips the network prefix from a server room key to get the client-facing name
function toClientRoom(networkId, serverRoom) {
    const prefix = `${networkId}:`;
    return serverRoom.startsWith(prefix) ? serverRoom.slice(prefix.length) : serverRoom;
}
// Strip HTML tags to prevent XSS if text is ever rendered as HTML
function sanitize(text) {
    return text.replace(/<[^>]*>/g, "");
}
function broadcastLog(io, networkId, text) {
    const msg = (0, rooms_js_1.appendLogInNetwork)(networkId, text);
    io.to(netRoom(networkId)).emit(SOCKET_EVENTS.LOG_MESSAGE, msg);
}
function registerChatHandlers(io, socket) {
    const networkId = getNetworkId(socket);
    // Send current channel list to newly connected socket
    socket.emit(SOCKET_EVENTS.CHANNELS_UPDATE, (0, rooms_js_1.listChannelsInNetwork)(networkId));
    socket.on(SOCKET_EVENTS.ROOM_JOIN, ({ room }, ack) => {
        const authUser = getAuthUser(socket);
        const cleanUsername = authUser.username;
        const cleanName = ((room ?? "").trim().slice(0, 40) || "general").toLowerCase();
        const cleanRoom = toServerRoom(networkId, cleanName);
        const prev = (0, rooms_js_1.getUser)(socket.id);
        if (prev) {
            socket.leave(prev.room);
            (0, rooms_js_1.leaveRoom)(socket.id);
            io.to(prev.room).emit(SOCKET_EVENTS.ROOM_USERS, (0, rooms_js_1.getRoomUsernames)(prev.room));
        }
        (0, rooms_js_1.createChannelInNetwork)(networkId, cleanName);
        (0, rooms_js_1.joinRoom)(socket.id, cleanUsername, cleanRoom, networkId);
        socket.join(cleanRoom);
        io.to(cleanRoom).emit(SOCKET_EVENTS.ROOM_USERS, (0, rooms_js_1.getRoomUsernames)(cleanRoom));
        io.to(netRoom(networkId)).emit(SOCKET_EVENTS.USERS_ALL, (0, rooms_js_1.getAllUsersInNetwork)(networkId).map((u) => u.username));
        ack({
            ok: true,
            messages: (0, rooms_js_1.getMessages)(cleanRoom),
            users: (0, rooms_js_1.getRoomUsernames)(cleanRoom),
            channels: (0, rooms_js_1.listChannelsInNetwork)(networkId),
            pinned: (0, rooms_js_1.getPinned)(cleanRoom) ?? null,
        });
    });
    // Channel creation
    socket.on(SOCKET_EVENTS.CHANNEL_CREATE, (name, ack) => {
        const authUser = getAuthUser(socket);
        const isNew = (0, rooms_js_1.createChannelInNetwork)(networkId, name);
        const channels = (0, rooms_js_1.listChannelsInNetwork)(networkId);
        if (isNew) {
            io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
            broadcastLog(io, networkId, `${authUser.username} created channel #${name}`);
        }
        ack?.({ ok: true, channels });
    });
    // Channel deletion
    socket.on(SOCKET_EVENTS.CHANNEL_DELETE, (name, ack) => {
        const authUser = getAuthUser(socket);
        const deleted = (0, rooms_js_1.deleteChannelInNetwork)(networkId, name);
        if (!deleted) {
            return ack?.({ ok: false, error: "Channel cannot be deleted" });
        }
        const serverRoom = toServerRoom(networkId, name);
        // Kick all sockets out of the deleted room so Socket.IO room is cleaned up
        for (const [, s] of io.sockets.sockets) {
            const u = (0, rooms_js_1.getUser)(s.id);
            if (u && u.room === serverRoom) {
                s.leave(serverRoom);
                (0, rooms_js_1.leaveRoom)(s.id);
            }
        }
        const channels = (0, rooms_js_1.listChannelsInNetwork)(networkId);
        io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
        io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNEL_DELETED, name);
        broadcastLog(io, networkId, `${authUser.username} deleted channel #${name}`);
        ack?.({ ok: true });
    });
    // Channel list request
    socket.on(SOCKET_EVENTS.CHANNELS_LIST, (ack) => {
        ack((0, rooms_js_1.listChannelsInNetwork)(networkId));
    });
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, (payload) => {
        const user = (0, rooms_js_1.getUser)(socket.id);
        if (!user)
            return;
        // #log is read-only
        if (user.room === (0, rooms_js_1.getLogRoomInNetwork)(networkId))
            return;
        const text = typeof payload === "string" ? payload : payload?.text;
        const replyTo = typeof payload === "object" ? payload?.replyTo : undefined;
        if (typeof text !== "string")
            return;
        const trimmed = sanitize(text.trim()).slice(0, 20000);
        if (!trimmed)
            return;
        const msg = {
            id: (0, crypto_1.randomUUID)(),
            username: user.username,
            text: trimmed,
            timestamp: Date.now(),
            type: "message",
            ...(replyTo ? { replyTo: { ...replyTo, text: sanitize(replyTo.text).slice(0, 500) } } : {}),
        };
        (0, rooms_js_1.addMessage)(user.room, msg);
        io.to(user.room).emit(SOCKET_EVENTS.MESSAGE, msg);
        // Notify @mentioned users within the same network
        const mentions = [...new Set((trimmed.match(/@([a-zA-Z0-9_-]+)/g) ?? []).map((m) => m.slice(1)))];
        for (const mentionedName of mentions) {
            if (mentionedName === user.username)
                continue;
            for (const sid of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(mentionedName, networkId)) {
                io.to(sid).emit(SOCKET_EVENTS.MENTION, {
                    from: user.username,
                    room: toClientRoom(networkId, user.room),
                    text: trimmed,
                    msgId: msg.id,
                });
            }
        }
    });
    // Message delete — only sender can delete
    socket.on("message:delete", ({ room, msgId }) => {
        const authUser = getAuthUser(socket);
        const serverRoom = toServerRoom(networkId, room);
        const deleted = (0, rooms_js_1.deleteMessage)(serverRoom, msgId, authUser.username);
        if (deleted) {
            if (room.startsWith("dm:")) {
                const [, a, b] = room.split(":");
                for (const s of io.sockets.sockets.values()) {
                    const u = (0, rooms_js_1.getUser)(s.id);
                    if (u && (u.username === a || u.username === b) && u.networkId === networkId) {
                        s.emit("message:delete", { room, msgId });
                    }
                }
                for (const sid of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(authUser.username, networkId)) {
                    io.to(sid).emit("message:delete", { room, msgId });
                }
            }
            else {
                io.to(serverRoom).emit("message:delete", { room, msgId });
            }
        }
    });
    // Reaction toggle
    socket.on(SOCKET_EVENTS.REACTION_TOGGLE, ({ room, msgId, emoji }) => {
        const authUser = getAuthUser(socket);
        if (!emoji || emoji.length > 8)
            return;
        const serverRoom = toServerRoom(networkId, room);
        const updated = (0, rooms_js_1.toggleReaction)(serverRoom, msgId, emoji, authUser.username);
        if (updated) {
            if (room.startsWith("dm:")) {
                const [, a, b] = room.split(":");
                for (const sid of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(a, networkId)) {
                    io.to(sid).emit(SOCKET_EVENTS.MESSAGE_UPDATE, { ...updated, _room: room });
                }
                for (const sid of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(b, networkId)) {
                    io.to(sid).emit(SOCKET_EVENTS.MESSAGE_UPDATE, { ...updated, _room: room });
                }
            }
            else {
                io.to(serverRoom).emit(SOCKET_EVENTS.MESSAGE_UPDATE, updated);
            }
        }
    });
    socket.on(SOCKET_EVENTS.TYPING_START, () => {
        const user = (0, rooms_js_1.getUser)(socket.id);
        if (user && user.room !== (0, rooms_js_1.getLogRoomInNetwork)(networkId))
            socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: true });
    });
    socket.on(SOCKET_EVENTS.TYPING_STOP, () => {
        const user = (0, rooms_js_1.getUser)(socket.id);
        if (user)
            socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: false });
    });
    // DM typing indicators — only delivered to the recipient (all their tabs) on the same network
    socket.on(SOCKET_EVENTS.DM_TYPING, ({ to, typing }) => {
        const sender = (0, rooms_js_1.getUser)(socket.id) ?? { username: getAuthUser(socket).username };
        for (const recipientSocketId of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(to, networkId)) {
            io.to(recipientSocketId).emit(SOCKET_EVENTS.DM_TYPING, { from: sender.username, typing });
        }
    });
    // Direct message
    socket.on(SOCKET_EVENTS.DM_SEND, ({ to, text, replyTo }) => {
        const sender = (0, rooms_js_1.getUser)(socket.id) ?? { username: getAuthUser(socket).username, room: "dm" };
        if (!sender || !text.trim())
            return;
        const trimmed = text.trim().slice(0, 20000);
        const bareRoomId = (0, rooms_js_1.dmRoomId)(sender.username, to);
        const serverRoomId = toServerRoom(networkId, bareRoomId);
        const msg = {
            id: (0, crypto_1.randomUUID)(),
            username: sender.username,
            text: trimmed,
            timestamp: Date.now(),
            type: "message",
            ...(replyTo ? { replyTo } : {}),
        };
        (0, rooms_js_1.addMessage)(serverRoomId, msg);
        // Deliver to all recipient tabs on the same network
        for (const recipientSocketId of (0, rooms_js_1.findAllSocketsByUsernameInNetwork)(to, networkId)) {
            io.to(recipientSocketId).emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId: bareRoomId, msg });
        }
        // Deliver to all sender tabs (echo to other tabs)
        socket.emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId: bareRoomId, msg });
    });
    socket.on(SOCKET_EVENTS.USERS_ALL, (ack) => {
        ack((0, rooms_js_1.getAllUsersInNetwork)(networkId).map((u) => u.username));
    });
    // Message history pagination (scroll up)
    socket.on("messages:before", ({ room, before }, ack) => {
        ack((0, rooms_js_1.getMessagesBefore)(toServerRoom(networkId, room), before));
    });
    // Pin a message in current room
    socket.on(SOCKET_EVENTS.PIN_SET, ({ room, msgId }) => {
        if (room.startsWith("dm:"))
            return; // no pinning in DMs
        const serverRoom = toServerRoom(networkId, room);
        const pinned = (0, rooms_js_1.pinMessage)(serverRoom, msgId);
        if (pinned) {
            io.to(serverRoom).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned });
        }
    });
    socket.on(SOCKET_EVENTS.PIN_CLEAR, ({ room }) => {
        const serverRoom = toServerRoom(networkId, room);
        (0, rooms_js_1.unpinMessage)(serverRoom);
        io.to(serverRoom).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned: null });
    });
    // Full-text search scoped to this network
    socket.on(SOCKET_EVENTS.SEARCH, (query, ack) => {
        if (typeof query !== "string" || !query.trim())
            return ack([]);
        ack((0, rooms_js_1.searchMessagesInNetwork)(networkId, query.trim().slice(0, 100)));
    });
    // User profile lookup — scoped to this network for online status
    socket.on(SOCKET_EVENTS.USER_PROFILE, (username, ack) => {
        try {
            const dbUser = (0, database_js_1.getUserByUsername)(username);
            if (!dbUser)
                return ack(null);
            const online = (0, rooms_js_1.getAllUsersInNetwork)(networkId).some((u) => u.username === username);
            ack({ username: dbUser.username, email: dbUser.email, online });
        }
        catch {
            const online = (0, rooms_js_1.getAllUsersInNetwork)(networkId).some((u) => u.username === username);
            ack({ username, email: "", online });
        }
    });
    socket.on("disconnect", () => {
        const user = (0, rooms_js_1.leaveRoom)(socket.id);
        if (!user)
            return;
        io.to(user.room).emit(SOCKET_EVENTS.ROOM_USERS, (0, rooms_js_1.getRoomUsernames)(user.room));
        io.to(netRoom(user.networkId)).emit(SOCKET_EVENTS.USERS_ALL, (0, rooms_js_1.getAllUsersInNetwork)(user.networkId).map((u) => u.username));
        // Only log "left" if this was their last active connection on this network
        if ((0, rooms_js_1.connectionCountForUserInNetwork)(user.username, user.networkId) === 0) {
            broadcastLog(io, user.networkId, `${user.username} left LocalChat`);
        }
    });
}
// Called from index.ts on socket connect (after auth)
function logUserJoined(io, username, networkId) {
    broadcastLog(io, networkId, `${username} joined LocalChat`);
}
