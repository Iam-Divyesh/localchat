import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import { DbUser, getUserByUsername } from "../db/database.js";
import {
  joinRoom,
  leaveRoom,
  getUser,
  getRoomUsernames,
  addMessage,
  getMessages,
  getMessagesBefore,
  dmRoomId,
  findAllSocketsByUsernameInNetwork,
  findMessage,
  toggleReaction,
  deleteMessage,
  pinMessage,
  unpinMessage,
  getPinned,
  createChannelInNetwork,
  deleteChannelInNetwork,
  listChannelsInNetwork,
  getAllUsersInNetwork,
  appendLogInNetwork,
  getLogRoomInNetwork,
  searchMessagesInNetwork,
  connectionCountForUserInNetwork,
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

function getNetworkId(socket: Socket): string {
  return (socket as unknown as Record<string, unknown>).lcNetworkId as string;
}

// Returns the Socket.IO network room key for broadcasting to all sockets on the same network
function netRoom(networkId: string): string {
  return `net:${networkId}`;
}

// Converts a client-facing room name to the server-internal prefixed room key
function toServerRoom(networkId: string, clientRoom: string): string {
  return `${networkId}:${clientRoom}`;
}

// Strips the network prefix from a server room key to get the client-facing name
function toClientRoom(networkId: string, serverRoom: string): string {
  const prefix = `${networkId}:`;
  return serverRoom.startsWith(prefix) ? serverRoom.slice(prefix.length) : serverRoom;
}

// Strip HTML tags to prevent XSS if text is ever rendered as HTML
function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

function broadcastLog(io: Server, networkId: string, text: string): void {
  const msg = appendLogInNetwork(networkId, text);
  io.to(netRoom(networkId)).emit(SOCKET_EVENTS.LOG_MESSAGE, msg);
}

export function registerChatHandlers(io: Server, socket: Socket): void {
  const networkId = getNetworkId(socket);

  // Send current channel list to newly connected socket
  socket.emit(SOCKET_EVENTS.CHANNELS_UPDATE, listChannelsInNetwork(networkId));

  socket.on(
    SOCKET_EVENTS.ROOM_JOIN,
    (
      { room }: { room: string },
      ack: (res: { ok: boolean; messages: ChatMessage[]; users: string[]; channels: string[]; pinned: ChatMessage | null }) => void
    ) => {
      const authUser = getAuthUser(socket);
      const cleanUsername = authUser.username;
      const cleanName = ((room ?? "").trim().slice(0, 40) || "general").toLowerCase();
      const cleanRoom = toServerRoom(networkId, cleanName);

      const prev = getUser(socket.id);
      if (prev) {
        socket.leave(prev.room);
        leaveRoom(socket.id);
        io.to(prev.room).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(prev.room));
      }

      createChannelInNetwork(networkId, cleanName);
      joinRoom(socket.id, cleanUsername, cleanRoom, networkId);
      socket.join(cleanRoom);

      io.to(cleanRoom).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(cleanRoom));
      io.to(netRoom(networkId)).emit(SOCKET_EVENTS.USERS_ALL, getAllUsersInNetwork(networkId).map((u) => u.username));

      ack({
        ok: true,
        messages: getMessages(cleanRoom),
        users: getRoomUsernames(cleanRoom),
        channels: listChannelsInNetwork(networkId),
        pinned: getPinned(cleanRoom) ?? null,
      });
    }
  );

  // Channel creation
  socket.on(
    SOCKET_EVENTS.CHANNEL_CREATE,
    (name: string, ack?: (res: { ok: boolean; channels: string[] }) => void) => {
      const authUser = getAuthUser(socket);
      const isNew = createChannelInNetwork(networkId, name);
      const channels = listChannelsInNetwork(networkId);
      if (isNew) {
        io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
        broadcastLog(io, networkId, `${authUser.username} created channel #${name}`);
      }
      ack?.({ ok: true, channels });
    }
  );

  // Channel deletion
  socket.on(
    SOCKET_EVENTS.CHANNEL_DELETE,
    (name: string, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const authUser = getAuthUser(socket);
      const deleted = deleteChannelInNetwork(networkId, name);
      if (!deleted) {
        return ack?.({ ok: false, error: "Channel cannot be deleted" });
      }
      const serverRoom = toServerRoom(networkId, name);
      // Kick all sockets out of the deleted room so Socket.IO room is cleaned up
      for (const [, s] of io.sockets.sockets) {
        const u = getUser(s.id);
        if (u && u.room === serverRoom) {
          s.leave(serverRoom);
          leaveRoom(s.id);
        }
      }
      const channels = listChannelsInNetwork(networkId);
      io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNELS_UPDATE, channels);
      io.to(netRoom(networkId)).emit(SOCKET_EVENTS.CHANNEL_DELETED, name);
      broadcastLog(io, networkId, `${authUser.username} deleted channel #${name}`);
      ack?.({ ok: true });
    }
  );

  // Channel list request
  socket.on(SOCKET_EVENTS.CHANNELS_LIST, (ack: (channels: string[]) => void) => {
    ack(listChannelsInNetwork(networkId));
  });

  socket.on(SOCKET_EVENTS.MESSAGE_SEND, (payload: string | { text: string; replyTo?: { id: string; username: string; text: string } }) => {
    const user = getUser(socket.id);
    if (!user) return;
    // #log is read-only
    if (user.room === getLogRoomInNetwork(networkId)) return;

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

    // Notify @mentioned users within the same network
    const mentions = [...new Set((trimmed.match(/@([a-zA-Z0-9_-]+)/g) ?? []).map((m) => m.slice(1)))];
    for (const mentionedName of mentions) {
      if (mentionedName === user.username) continue;
      for (const sid of findAllSocketsByUsernameInNetwork(mentionedName, networkId)) {
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
  socket.on("message:delete", ({ room, msgId }: { room: string; msgId: string }) => {
    const authUser = getAuthUser(socket);
    const serverRoom = toServerRoom(networkId, room);
    const deleted = deleteMessage(serverRoom, msgId, authUser.username);
    if (deleted) {
      if (room.startsWith("dm:")) {
        const [, a, b] = room.split(":");
        for (const s of io.sockets.sockets.values()) {
          const u = getUser(s.id);
          if (u && (u.username === a || u.username === b) && u.networkId === networkId) {
            s.emit("message:delete", { room, msgId });
          }
        }
        for (const sid of findAllSocketsByUsernameInNetwork(authUser.username, networkId)) {
          io.to(sid).emit("message:delete", { room, msgId });
        }
      } else {
        io.to(serverRoom).emit("message:delete", { room, msgId });
      }
    }
  });

  // Reaction toggle
  socket.on(SOCKET_EVENTS.REACTION_TOGGLE, ({ room, msgId, emoji }: { room: string; msgId: string; emoji: string }) => {
    const authUser = getAuthUser(socket);
    if (!emoji || emoji.length > 8) return;
    const serverRoom = toServerRoom(networkId, room);
    const updated = toggleReaction(serverRoom, msgId, emoji, authUser.username);
    if (updated) {
      if (room.startsWith("dm:")) {
        const [, a, b] = room.split(":");
        for (const sid of findAllSocketsByUsernameInNetwork(a, networkId)) {
          io.to(sid).emit(SOCKET_EVENTS.MESSAGE_UPDATE, { ...updated, _room: room });
        }
        for (const sid of findAllSocketsByUsernameInNetwork(b, networkId)) {
          io.to(sid).emit(SOCKET_EVENTS.MESSAGE_UPDATE, { ...updated, _room: room });
        }
      } else {
        io.to(serverRoom).emit(SOCKET_EVENTS.MESSAGE_UPDATE, updated);
      }
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_START, () => {
    const user = getUser(socket.id);
    if (user && user.room !== getLogRoomInNetwork(networkId))
      socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: true });
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, () => {
    const user = getUser(socket.id);
    if (user)
      socket.to(user.room).emit(SOCKET_EVENTS.TYPING_UPDATE, { username: user.username, typing: false });
  });

  // DM typing indicators — only delivered to the recipient (all their tabs) on the same network
  socket.on(SOCKET_EVENTS.DM_TYPING, ({ to, typing }: { to: string; typing: boolean }) => {
    const sender = getUser(socket.id) ?? { username: getAuthUser(socket).username };
    for (const recipientSocketId of findAllSocketsByUsernameInNetwork(to, networkId)) {
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
      const bareRoomId = dmRoomId(sender.username, to);
      const serverRoomId = toServerRoom(networkId, bareRoomId);
      const msg: ChatMessage = {
        id: randomUUID(),
        username: sender.username,
        text: trimmed,
        timestamp: Date.now(),
        type: "message",
        ...(replyTo ? { replyTo } : {}),
      };

      addMessage(serverRoomId, msg);

      // Deliver to all recipient tabs on the same network
      for (const recipientSocketId of findAllSocketsByUsernameInNetwork(to, networkId)) {
        io.to(recipientSocketId).emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId: bareRoomId, msg });
      }
      // Deliver to all sender tabs (echo to other tabs)
      socket.emit(SOCKET_EVENTS.DM_RECEIVE, { from: sender.username, roomId: bareRoomId, msg });
    }
  );

  socket.on(SOCKET_EVENTS.USERS_ALL, (ack: (users: string[]) => void) => {
    ack(getAllUsersInNetwork(networkId).map((u) => u.username));
  });

  // Message history pagination (scroll up)
  socket.on("messages:before", ({ room, before }: { room: string; before: number }, ack: (msgs: ChatMessage[]) => void) => {
    ack(getMessagesBefore(toServerRoom(networkId, room), before));
  });

  // Pin a message in current room
  socket.on(SOCKET_EVENTS.PIN_SET, ({ room, msgId }: { room: string; msgId: string }) => {
    if (room.startsWith("dm:")) return; // no pinning in DMs
    const serverRoom = toServerRoom(networkId, room);
    const pinned = pinMessage(serverRoom, msgId);
    if (pinned) {
      io.to(serverRoom).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned });
    }
  });

  socket.on(SOCKET_EVENTS.PIN_CLEAR, ({ room }: { room: string }) => {
    const serverRoom = toServerRoom(networkId, room);
    unpinMessage(serverRoom);
    io.to(serverRoom).emit(SOCKET_EVENTS.PIN_UPDATE, { room, pinned: null });
  });

  // Full-text search scoped to this network
  socket.on(SOCKET_EVENTS.SEARCH, (query: string, ack: (results: Array<{ room: string; msg: ChatMessage }>) => void) => {
    if (typeof query !== "string" || !query.trim()) return ack([]);
    ack(searchMessagesInNetwork(networkId, query.trim().slice(0, 100)));
  });

  // User profile lookup — scoped to this network for online status
  socket.on(SOCKET_EVENTS.USER_PROFILE, (username: string, ack: (profile: { username: string; email: string; online: boolean } | null) => void) => {
    try {
      const dbUser = getUserByUsername(username);
      if (!dbUser) return ack(null);
      const online = getAllUsersInNetwork(networkId).some((u) => u.username === username);
      ack({ username: dbUser.username, email: dbUser.email, online });
    } catch {
      const online = getAllUsersInNetwork(networkId).some((u) => u.username === username);
      ack({ username, email: "", online });
    }
  });

  socket.on("disconnect", () => {
    const user = leaveRoom(socket.id);
    if (!user) return;
    io.to(user.room).emit(SOCKET_EVENTS.ROOM_USERS, getRoomUsernames(user.room));
    io.to(netRoom(user.networkId)).emit(SOCKET_EVENTS.USERS_ALL, getAllUsersInNetwork(user.networkId).map((u) => u.username));
    // Only log "left" if this was their last active connection on this network
    if (connectionCountForUserInNetwork(user.username, user.networkId) === 0) {
      broadcastLog(io, user.networkId, `${user.username} left LocalChat`);
    }
  });
}

// Called from index.ts on socket connect (after auth)
export function logUserJoined(io: Server, username: string, networkId: string): void {
  broadcastLog(io, networkId, `${username} joined LocalChat`);
}
