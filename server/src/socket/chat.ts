import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { DbUser, getUserByUsername } from "../db/database.js";
import {
  joinRoom,
  leaveRoom,
  getUser,
  getRoomUsernames,
  createChannel,
  deleteChannel,
  listChannels,
  addMessage,
  getMessages,
  getMessagesBefore,
  getAllUsers,
  dmRoomId,
  findSocketByUsername,
  findAllSocketsByUsername,
  findMessage,
  toggleReaction,
  deleteMessage,
  pinMessage,
  unpinMessage,
  getPinned,
  searchMessages,
  appendLog,
  getLogRoom,
  connectionCountForUser,
  ChatMessage,
} from "../store/rooms.js";

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
} as const;

function getAuthUser(socket: Socket): DbUser {
  return (socket as unknown as Record<string, unknown>).lcUser as DbUser;
}

// Strip HTML tags to prevent XSS if text is ever rendered as HTML
function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// Broadcast a log entry to all sockets and store it
function broadcastLog(io: Server, text: string): void {
  const msg = appendLog(text);
  io.emit(SOCKET_EVENTS.LOG_MESSAGE, msg);
}

export function registerChatHandlers(io: Server, socket: Socket): void {
  // Send current channel list to newly connected socket
  socket.emit(SOCKET_EVENTS.CHANNELS_UPDATE, listChannels());

  socket.on(
    SOCKET_EVENTS.ROOM_JOIN,
    (
      { room }: { room: string },
      ack: (res: { ok: boolean; messages: ChatMessage[]; users: string[]; channels: string[]; pinned: ChatMessage | null }) => void
    ) => {
      const authUser = getAuthUser(socket);
      const cleanUsername = authUser.username;
      const cleanRoom = (room ?? "").trim().slice(0, 40) || "general";

      const prev = getUser(socket.id);
      if (prev) {
        socket.leave(prev.room);
        leaveRoom(socket.id);
        io.to(prev.room).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(prev.room));
      }

      createChannel(cleanRoom);
      joinRoom(socket.id, cleanUsername, cleanRoom);
      socket.join(cleanRoom);

      io.to(cleanRoom).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(cleanRoom));
      io.emit(SOCKET_EVENTS.USERS_ALL, getAllUsers().map((u) => u.username));

      ack({
        ok: true,
        messages: getMessages(cleanRoom),
        users: getRoomUsernames(cleanRoom),
        channels: listChannels(),
        pinned: getPinned(cleanRoom) ?? null,
      });
    }
  );

  // Channel creation
  socket.on(
    SOCKET_EVENTS.CHANNEL_CREATE,
    (name: string, ack?: (res: { ok: boolean; channels: string[] }) => void) => {
      const authUser = getAuthUser(socket);
      const isNew = createChannel(name);
      const channels = listChannels();
      if (isNew) {
        io.emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
        broadcastLog(io, `${authUser.username} created channel #${name}`);
      }
      ack?.({ ok: true, channels });
    }
  );

  // Channel deletion
  socket.on(
    SOCKET_EVENTS.CHANNEL_DELETE,
    (name: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const authUser = getAuthUser(socket);
      const deleted = deleteChannel(name);
      if (!deleted) {
        return ack?.({ ok: false, error: "Channel cannot be deleted" });
      }
      // Kick all sockets out of the deleted room so Socket.IO room is cleaned up
      for (const [, s] of io.sockets.sockets) {
        const u = getUser(s.id);
        if (u && u.room === name) {
          s.leave(name);
          leaveRoom(s.id);
        }
      }
      const channels = listChannels();
      // Tell everyone: channel list updated + which channel was deleted
      io.emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
      io.emit(SOCKET_EVENTS.CHANNEL_DELETED, name);
      broadcastLog(io, `${authUser.username} deleted channel #${name}`);
      ack?.({ ok: true });
    }
  );

  // Channel list request
  socket.on(SOCKET_EVENTS.CHANNELS_LIST, (ack: (channels: string[]) => void) => {
    ack(listChannels());
  });

  socket.on(SOCKET_EVENTS.MESSAGE_SEND, (payload: string | { text: string; replyTo?: { id: string; username: string; text: string } }) => {
    const user = getUser(socket.id);
    if (!user) return;
    // #log is read-only
    if (user.room === getLogRoom()) return;

    const text = typeof payload === "string" ? payload : payload?.text;
    const replyTo = typeof payload === "object" ? payload?.replyTo : undefined;
    if (typeof text !== "string") return;
    const trimmed = sanitize(text.trim()).slice(0, 20000);
    if (!trimmed) return;

    const msg: ChatMessage = {
      id: randomUUID(),
      username: user.username,
      text: trimmed,
      timestamp: Date.now(),
      type: "message",
      ...(replyTo ? { replyTo: { ...replyTo, text: sanitize(replyTo.text).slice(0, 500) } } : {}),
    };
    addMessage(user.room, msg);
    io.to(user.room).emit(SOCKET_EVENTS.MESSAGE, msg);

    // Notify @mentioned users
    const mentions = [...new Set((trimmed.match(/@([a-zA-Z0-9_-]+)/g) ?? []).map((m) => m.slice(1)))];
    for (const mentionedName of mentions) {
      if (mentionedName === user.username) continue;
      for (const sid of findAllSocketsByUsername(mentionedName)) {
        io.to(sid).emit(SOCKET_EVENTS.MENTION, {
          from: user.username,
          room: user.room,
          text: trimmed,
          msgId: msg.id,
        });
      }
    }
  });

  // Message delete — only sender can delete
  socket.on("message:delete", ({ room, msgId }: { room: string; msgId: string }) => {
    const authUser = getAuthUser(socket);
    const deleted = deleteMessage(room, msgId, authUser.username);
    if (deleted) {
      // Broadcast to the room (channel) or both DM participants
      if (room.startsWith("dm:")) {
        const [, a, b] = room.split(":");
        for (const s of io.sockets.sockets.values()) {
          const u = getUser(s.id);
          if (u && (u.username === a || u.username === b)) {
            s.emit("message:delete", { room, msgId });
          }
        }
        // Also cover sender's other tabs not in userMap (e.g. not joined to a channel)
        for (const sid of findAllSocketsByUsername(authUser.username)) {
          io.to(sid).emit("message:delete", { room, msgId });
        }
      } else {
        io.to(room).emit("message:delete", { room, msgId });
      }
    }
  });

  // Reaction toggle
  socket.on(SOCKET_EVENTS.REACTION_TOGGLE, ({ room, msgId, emoji }: { room: string; msgId: string; emoji: string }) => {
    const authUser = getAuthUser(socket);
    if (!emoji || emoji.length > 8) return;
    const updated = toggleReaction(room, msgId, emoji, authUser.username);
    if (updated) {
      io.to(room).emit(SOCKET_EVENTS.MESSAGE_UPDATE, updated);
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_START, () => {
    const user = getUser(socket.id);
    if (user && user.room !== getLogRoom())
      socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: true });
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, () => {
    const user = getUser(socket.id);
    if (user)
      socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: false });
  });

  // DM typing indicators — only delivered to the recipient (all their tabs)
  socket.on(SOCKET_EVENTS.DM_TYPING, ({ to, typing }: { to: string; typing: boolean }) => {
    const sender = getUser(socket.id) ?? { username: getAuthUser(socket).username };
    for (const recipientSocketId of findAllSocketsByUsername(to)) {
      io.to(recipientSocketId).emit(SOCKET_EVENTS.DM_TYPING, { from: sender.username, typing });
    }
  });

  // Direct message
  socket.on(
    SOCKET_EVENTS.DM_SEND,
    ({ to, text, replyTo }: { to: string; text: string; replyTo?: { id: string; username: string; text: string } }) => {
      const sender = getUser(socket.id) ?? { username: getAuthUser(socket).username, room: "dm" };
      if (!sender || !text.trim()) return;

      const trimmed = text.trim().slice(0, 20000);
      const roomId = dmRoomId(sender.username, to);
      const msg: ChatMessage = {
        id: randomUUID(),
        username: sender.username,
        text: trimmed,
        timestamp: Date.now(),
        type: "message",
        ...(replyTo ? { replyTo } : {}),
      };

      addMessage(roomId, msg);

      // Deliver to all recipient tabs
      for (const recipientSocketId of findAllSocketsByUsername(to)) {
        io.to(recipientSocketId).emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId, msg });
      }
      // Deliver to all sender tabs (echo to other tabs)
      socket.emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId, msg });
    }
  );

  socket.on(SOCKET_EVENTS.USERS_ALL, (ack: (users: string[]) => void) => {
    ack(getAllUsers().map((u) => u.username));
  });

  // Message history pagination (scroll up)
  socket.on("messages:before", ({ room, before }: { room: string; before: number }, ack: (msgs: ChatMessage[]) => void) => {
    ack(getMessagesBefore(room, before));
  });

  // Pin a message in current room
  socket.on(SOCKET_EVENTS.PIN_SET, ({ room, msgId }: { room: string; msgId: string }) => {
    if (room.startsWith("dm:")) return; // no pinning in DMs
    const pinned = pinMessage(room, msgId);
    if (pinned) {
      io.to(room).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned });
    }
  });

  socket.on(SOCKET_EVENTS.PIN_CLEAR, ({ room }: { room: string }) => {
    unpinMessage(room);
    io.to(room).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned: null });
  });

  // Full-text search
  socket.on(SOCKET_EVENTS.SEARCH, (query: string, ack: (results: Array<{ room: string; msg: ChatMessage }>) => void) => {
    if (typeof query !== "string" || !query.trim()) return ack([]);
    ack(searchMessages(query.trim().slice(0, 100)));
  });

  // User profile lookup — returns username, email, and online status from DB
  socket.on(SOCKET_EVENTS.USER_PROFILE, (username: string, ack: (profile: { username: string; email: string; online: boolean } | null) => void) => {
    try {
      const dbUser = getUserByUsername(username);
      if (!dbUser) return ack(null);
      const onlineUsers = getAllUsers();
      const online = onlineUsers.some((u) => u.username === username);
      ack({ username: dbUser.username, email: dbUser.email, online });
    } catch {
      // DB not available (no persist mode) — return online status only
      const onlineUsers = getAllUsers();
      const online = onlineUsers.some((u) => u.username === username);
      ack({ username, email: "", online });
    }
  });

  socket.on("disconnect", () => {
    const user = leaveRoom(socket.id);
    if (!user) return;
    io.to(user.room).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(user.room));
    io.emit(SOCKET_EVENTS.USERS_ALL, getAllUsers().map((u) => u.username));
    // Only log "left" if this was their last active connection
    if (connectionCountForUser(user.username) === 0) {
      broadcastLog(io, `${user.username} left LocalChat`);
    }
  });
}

// Called from index.ts on socket connect (after auth)
export function logUserJoined(io: Server, username: string): void {
  broadcastLog(io, `${username} joined LocalChat`);
}
