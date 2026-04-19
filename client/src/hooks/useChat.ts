import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../lib/socket";
import { FILE_MESSAGE_PREFIX } from "../lib/fileChunker";

export interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  type: "message" | "system";
  replyTo?: { id: string; username: string; text: string };
  reactions?: Record<string, string[]>;
}

export interface FileAvailable {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  room: string;
  timestamp: number;
  expiresAt: number;
}

export interface DmConversation {
  roomId: string;
  peer: string;
  messages: Message[];
  unread: number;
  peerTyping?: boolean;
}

const MAX_MESSAGES = 200;

function appendMsg(prev: Message[], msg: Message): Message[] {
  return [...prev.slice(-(MAX_MESSAGES - 1)), msg];
}

export function useChat(room: string | null, username: string | null, onChannelDeleted?: (name: string) => void) {
  // Per-room message map — key is room name, value is message list
  const [roomMessages, setRoomMessages] = useState<Map<string, Message[]>>(new Map());
  const [users, setUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>(["general", "log"]);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<Map<string, FileAvailable>>(new Map());
  const [dms, setDms] = useState<Map<string, DmConversation>>(new Map());
  const [mentions, setMentions] = useState<Array<{ from: string; room: string; text: string; msgId: string }>>([]);
  const [pinnedByRoom, setPinnedByRoom] = useState<Map<string, Message>>(new Map());
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChannelDeletedRef = useRef(onChannelDeleted);
  onChannelDeletedRef.current = onChannelDeleted;

  // Track which room the server thinks we're in (for message routing)
  const activeRoom = useRef<string | null>(null);

  useEffect(() => {
    if (!room || !username) return;
    const socket = getSocket();
    activeRoom.current = room;

    const joinRoom = () => {
      socket.emit(
        "room:join",
        { room },
        (res: { ok: boolean; messages: Message[]; users: string[]; channels: string[]; pinned?: Message | null }) => {
          if (res.ok) {
            // Only overwrite messages if we don't already have cached ones
            setRoomMessages((prev) => {
              const existing = prev.get(room);
              if (existing && existing.length > 0) return prev;
              return new Map(prev).set(room, res.messages);
            });
            setUsers(res.users);
            if (res.channels?.length) setChannels(res.channels);
            if (res.pinned) {
              setPinnedByRoom((prev) => new Map(prev).set(room, res.pinned!));
            }
          }
        }
      );
      socket.emit("users:all", (list: string[]) => setAllUsers(list));
    };

    // Join now, and re-join automatically after every reconnect
    joinRoom();
    socket.on("connect", joinRoom);
    return () => { socket.off("connect", joinRoom); };
  }, [room, username]);

  useEffect(() => {
    if (!username) return;
    const socket = getSocket();

    // Server pushes channels list on connect and after any channel:create
    const onChannelsUpdate = (list: string[]) => setChannels(list);

    // Incoming channel message — only append to the room it belongs to
    const onMessage = (msg: Message) => {
      const r = activeRoom.current;
      if (!r) return;
      setRoomMessages((prev) => {
        const next = new Map(prev);
        next.set(r, appendMsg(next.get(r) ?? [], msg));
        return next;
      });
      // Mark channel as unread if we're not currently viewing it
      if (r !== activeRoom.current) {
        setUnreadChannels((prev) => new Set([...prev, r]));
      }
    };

    // message:update — for reactions; replace the matching message in-place
    const onMessageUpdate = (updated: Message & { _room?: string }) => {
      // Try channel messages first
      setRoomMessages((prev) => {
        for (const [room, msgs] of prev) {
          const idx = msgs.findIndex((m) => m.id === updated.id);
          if (idx !== -1) {
            const next = new Map(prev);
            const newMsgs = [...msgs];
            newMsgs[idx] = updated;
            next.set(room, newMsgs);
            return next;
          }
        }
        return prev;
      });
      // Also try DM conversations
      setDms((prev) => {
        for (const [roomId, dm] of prev) {
          const idx = dm.messages.findIndex((m) => m.id === updated.id);
          if (idx !== -1) {
            const next = new Map(prev);
            const newMsgs = [...dm.messages];
            newMsgs[idx] = updated;
            next.set(roomId, { ...dm, messages: newMsgs });
            return next;
          }
        }
        return prev;
      });
    };

    // @mention notification
    const onMention = (data: { from: string; room: string; text: string; msgId: string }) => {
      setMentions((prev) => [...prev.slice(-19), data]);
      setUnreadChannels((prev) => new Set([...prev, data.room]));
      // Browser notification if permission granted
      if (Notification.permission === "granted") {
        new Notification(`@mention from ${data.from}`, {
          body: data.text.slice(0, 100),
          tag: data.msgId,
        });
      }
    };

    const onUsers = (list: string[]) => setUsers(list);
    const onAllUsers = (list: string[]) => setAllUsers(list);

    const onTyping = ({ username: u, typing }: { username: string; typing: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        typing ? next.add(u) : next.delete(u);
        return next;
      });
    };

    const onFile = (f: FileAvailable) => {
      setFiles((prev) => new Map(prev).set(f.id, f));
      const fileMsg: Message = {
        id: `${FILE_MESSAGE_PREFIX}${f.id}`,
        username: f.uploadedBy,
        text: `${FILE_MESSAGE_PREFIX}${f.id}`,
        timestamp: f.timestamp,
        type: "system",
      };

      if (f.room.startsWith("dm:")) {
        // Route into the correct DM conversation
        setDms((prev) => {
          const next = new Map(prev);
          const existing = next.get(f.room);
          // Derive peer from room ID: dm:a:b → the one that isn't current user
          const parts = f.room.slice(3).split(":");
          const peer = existing?.peer ?? parts.find((p) => p !== username) ?? parts[0];
          next.set(f.room, {
            roomId: f.room,
            peer,
            messages: appendMsg(existing?.messages ?? [], fileMsg),
            unread: existing ? existing.unread + 1 : 1,
          });
          return next;
        });
      } else {
        // Route into the channel message list
        setRoomMessages((prev) => {
          const next = new Map(prev);
          next.set(f.room, appendMsg(next.get(f.room) ?? [], fileMsg));
          return next;
        });
      }
    };

    const onDmTyping = ({ from, typing }: { from: string; typing: boolean }) => {
      setDms((prev) => {
        const next = new Map(prev);
        for (const [roomId, dm] of next) {
          if (dm.peer === from) {
            next.set(roomId, { ...dm, peerTyping: typing });
            break;
          }
        }
        return next;
      });
    };

    const onDmReceive = ({ from, roomId, msg }: { from: string; roomId: string; msg: Message }) => {
      const peer = from === username
        ? roomId.replace(`dm:${username}:`, "").replace(`:${username}`, "")
        : from;
      setDms((prev) => {
        const next = new Map(prev);
        const existing = next.get(roomId);
        next.set(roomId, {
          roomId,
          peer,
          messages: appendMsg(existing?.messages ?? [], msg),
          unread: (existing?.unread ?? 0) + (from !== username ? 1 : 0),
        });
        return next;
      });
    };

    // Log messages — always append to the "log" room regardless of active room
    const onLogMessage = (msg: Message) => {
      setRoomMessages((prev) => {
        const next = new Map(prev);
        next.set("log", appendMsg(next.get("log") ?? [], msg));
        return next;
      });
    };

    const onMessageDelete = ({ room: r, msgId }: { room: string; msgId: string }) => {
      if (r.startsWith("dm:")) {
        setDms((prev) => {
          const next = new Map(prev);
          const dm = next.get(r);
          if (dm) next.set(r, { ...dm, messages: dm.messages.filter((m) => m.id !== msgId) });
          return next;
        });
      } else {
        setRoomMessages((prev) => {
          const msgs = prev.get(r);
          if (!msgs) return prev;
          return new Map(prev).set(r, msgs.filter((m) => m.id !== msgId));
        });
      }
    };

    const onPinUpdate = ({ room: r, pinned }: { room: string; pinned: Message | null }) => {
      setPinnedByRoom((prev) => {
        const next = new Map(prev);
        if (pinned) next.set(r, pinned);
        else next.delete(r);
        return next;
      });
    };

    // Channel deleted — notify App to redirect if needed
    const onChannelDeleted = (name: string) => {
      setRoomMessages((prev) => { const next = new Map(prev); next.delete(name); return next; });
      onChannelDeletedRef.current?.(name);
    };

    socket.on("message:delete", onMessageDelete);
    socket.on("channels:update", onChannelsUpdate);
    socket.on("channel:deleted", onChannelDeleted);
    socket.on("log:message", onLogMessage);
    socket.on("message", onMessage);
    socket.on("message:update", onMessageUpdate);
    socket.on("mention", onMention);
    socket.on("pin:update", onPinUpdate);
    socket.on("room:users", onUsers);
    socket.on("users:all", onAllUsers);
    socket.on("typing:update", onTyping);
    socket.on("file:available", onFile);
    socket.on("dm:receive", onDmReceive);
    socket.on("dm:typing", onDmTyping);

    // Request notification permission on first connect
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    socket.emit("channels:list", (list: string[]) => {
      if (list?.length) setChannels(list);
    });

    return () => {
      socket.off("message:delete", onMessageDelete);
      socket.off("channels:update", onChannelsUpdate);
      socket.off("channel:deleted", onChannelDeleted);
      socket.off("log:message", onLogMessage);
      socket.off("message", onMessage);
      socket.off("message:update", onMessageUpdate);
      socket.off("mention", onMention);
      socket.off("pin:update", onPinUpdate);
      socket.off("room:users", onUsers);
      socket.off("users:all", onAllUsers);
      socket.off("typing:update", onTyping);
      socket.off("file:available", onFile);
      socket.off("dm:receive", onDmReceive);
      socket.off("dm:typing", onDmTyping);
    };
  }, [username]);

  // Keep activeRoom ref in sync
  useEffect(() => {
    activeRoom.current = room;
  }, [room]);

  const sendMessage = useCallback((text: string, replyTo?: { id: string; username: string; text: string }) => {
    getSocket().emit("message:send", replyTo ? { text, replyTo } : text);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    getSocket().emit("typing:stop");
  }, []);

  const sendDm = useCallback((to: string, text: string, replyTo?: { id: string; username: string; text: string }) => {
    getSocket().emit("dm:send", { to, text, ...(replyTo ? { replyTo } : {}) });
  }, []);

  const toggleReaction = useCallback((room: string, msgId: string, emoji: string) => {
    // Optimistic local update — reaction appears immediately
    const applyReaction = (msgs: Message[]) => {
      const idx = msgs.findIndex((m) => m.id === msgId);
      if (idx === -1) return msgs;
      const msg = msgs[idx];
      const reactions = { ...(msg.reactions ?? {}) };
      const users = reactions[emoji] ?? [];
      const myIdx = users.indexOf(username ?? "");
      if (myIdx === -1) {
        reactions[emoji] = [...users, username ?? ""];
      } else {
        reactions[emoji] = users.filter((u) => u !== username);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }
      const updated = [...msgs];
      updated[idx] = { ...msg, reactions };
      return updated;
    };

    // Update channel messages
    setRoomMessages((prev) => {
      const msgs = prev.get(room);
      if (!msgs) return prev;
      const updated = applyReaction(msgs);
      if (updated === msgs) return prev;
      return new Map(prev).set(room, updated);
    });

    // Update DM messages
    setDms((prev) => {
      const dm = prev.get(room);
      if (!dm) return prev;
      const updated = applyReaction(dm.messages);
      if (updated === dm.messages) return prev;
      return new Map(prev).set(room, { ...dm, messages: updated });
    });

    // Emit to server for persistence and sync to other users
    getSocket().emit("reaction:toggle", { room, msgId, emoji });
  }, [username]);

  const clearChannelUnread = useCallback((channelName: string) => {
    setUnreadChannels((prev) => {
      const next = new Set(prev);
      next.delete(channelName);
      return next;
    });
  }, []);

  const dismissMention = useCallback((msgId: string) => {
    setMentions((prev) => prev.filter((m) => m.msgId !== msgId));
  }, []);

  const deleteMsg = useCallback((room: string, msgId: string) => {
    getSocket().emit("message:delete", { room, msgId });
  }, []);

  const loadMoreMessages = useCallback((roomName: string, beforeTimestamp: number): Promise<Message[]> => {
    return new Promise((resolve) => {
      getSocket().emit("messages:before", { room: roomName, before: beforeTimestamp }, (msgs: Message[]) => {
        if (msgs.length > 0) {
          setRoomMessages((prev) => {
            const existing = prev.get(roomName) ?? [];
            const merged = [...msgs, ...existing];
            return new Map(prev).set(roomName, merged.slice(-200));
          });
        }
        resolve(msgs);
      });
    });
  }, []);

  const pinMsg = useCallback((roomName: string, msgId: string) => {
    getSocket().emit("pin:set", { room: roomName, msgId });
  }, []);

  const unpinMsg = useCallback((roomName: string) => {
    getSocket().emit("pin:clear", { room: roomName });
  }, []);

  const searchMsgs = useCallback((query: string): Promise<Array<{ room: string; msg: Message }>> => {
    return new Promise((resolve) => {
      getSocket().emit("search", query, resolve);
    });
  }, []);

  const getUserProfile = useCallback((targetUsername: string): Promise<{ username: string; email: string; online: boolean } | null> => {
    return new Promise((resolve) => {
      getSocket().emit("user:profile", targetUsername, resolve);
    });
  }, []);

  const notifyTyping = useCallback(() => {
    getSocket().emit("typing:start");
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => getSocket().emit("typing:stop"), 2000);
  }, []);

  const notifyDmTyping = useCallback((to: string) => {
    getSocket().emit("dm:typing", { to, typing: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => getSocket().emit("dm:typing", { to, typing: false }), 2000);
  }, []);

  const clearDmUnread = useCallback((roomId: string) => {
    setDms((prev) => {
      const next = new Map(prev);
      const dm = next.get(roomId);
      if (dm) next.set(roomId, { ...dm, unread: 0 });
      return next;
    });
  }, []);

  const createChannel = useCallback((name: string) => {
    getSocket().emit("channel:create", name);
  }, []);

  const deleteChannel = useCallback((name: string) => {
    getSocket().emit("channel:delete", name);
  }, []);

  const getFileById = useCallback((id: string) => files.get(id), [files]);

  const messages = room ? (roomMessages.get(room) ?? []) : [];

  const pinnedMessage = room ? pinnedByRoom.get(room) : undefined;

  return {
    messages, users, allUsers, typingUsers: [...typingUsers],
    channels, unreadChannels,
    sendMessage, sendDm, notifyTyping, notifyDmTyping,
    createChannel, deleteChannel,
    toggleReaction,
    clearChannelUnread,
    files, getFileById,
    dms, clearDmUnread,
    mentions, dismissMention,
    pinnedMessage, pinMsg, unpinMsg,
    searchMsgs, getUserProfile,
    deleteMsg, loadMoreMessages,
  };
}
