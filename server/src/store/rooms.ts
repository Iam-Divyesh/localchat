import { randomUUID } from "crypto";
import { saveMessage as dbSave, getRecentMessages, DbMessage, ensureRoom as dbEnsureRoom } from "../db/database.js";

export interface UserInfo {
  id: string;
  username: string;
  room: string;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  type: "message" | "system";
  replyTo?: { id: string; username: string; text: string };
  reactions?: Record<string, string[]>; // emoji → list of usernames
}

export interface FileRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  room: string;
  timestamp: number;
  expiresAt: number;
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  room: string;
  timestamp: number;
  expiresAt: number;
}

// ── State ─────────────────────────────────────────────────────
const roomUsers  = new Map<string, Set<string>>();   // room → socket ids
const userMap    = new Map<string, UserInfo>();       // socket id → user
const usernameToSockets = new Map<string, Set<string>>(); // username → socket ids (O(1) lookup)
const roomMessages = new Map<string, ChatMessage[]>(); // room → messages
const pinnedMessages = new Map<string, ChatMessage>(); // room → pinned message
const fileStore  = new Map<string, FileRecord>();
let totalStorageBytes = 0; // running total of all file sizes currently in memory

// Server-authoritative channel list (persists as long as server is up)
// Seeded with "general" and "log" on startup
const channelSet = new Set<string>(["general", "log"]);

// Protected channels — cannot be deleted
const PROTECTED = new Set<string>(["general", "log"]);

let persistMode = false;

export function setPersistMode(enabled: boolean): void {
  persistMode = enabled;
}

// ── Channels ──────────────────────────────────────────────────

export function createChannel(name: string): boolean {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40);
  if (!clean || clean.startsWith("dm:")) return false;
  const isNew = !channelSet.has(clean);
  channelSet.add(clean);
  if (persistMode) dbEnsureRoom(clean);
  return isNew;
}

export function listChannels(): string[] {
  return [...channelSet].sort();
}

export function deleteChannel(name: string): boolean {
  if (PROTECTED.has(name)) return false;
  if (!channelSet.has(name)) return false;
  channelSet.delete(name);
  roomMessages.delete(name);
  roomUsers.delete(name);
  return true;
}

export function isProtectedChannel(name: string): boolean {
  return PROTECTED.has(name);
}

// ── Activity log ──────────────────────────────────────────────
const LOG_ROOM = "log";

export function appendLog(text: string): ChatMessage {
  const msg: ChatMessage = {
    id: randomUUID(),
    username: "log",
    text,
    timestamp: Date.now(),
    type: "system",
  };
  addMessage(LOG_ROOM, msg);
  return msg;
}

export function getLogRoom(): string { return LOG_ROOM; }

// ── Rooms / users ─────────────────────────────────────────────

export function joinRoom(socketId: string, username: string, room: string): void {
  userMap.set(socketId, { id: socketId, username, room, joinedAt: Date.now() });
  if (!roomUsers.has(room)) roomUsers.set(room, new Set());
  roomUsers.get(room)!.add(socketId);
  // Maintain reverse index
  if (!usernameToSockets.has(username)) usernameToSockets.set(username, new Set());
  usernameToSockets.get(username)!.add(socketId);

  if (!roomMessages.has(room)) {
    roomMessages.set(
      room,
      persistMode ? getRecentMessages(room, 100).map(dbMsgToChatMsg) : []
    );
  }
}

export function leaveRoom(socketId: string): UserInfo | undefined {
  const user = userMap.get(socketId);
  if (!user) return undefined;

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
    if (userSockets.size === 0) usernameToSockets.delete(user.username);
  }

  userMap.delete(socketId);
  return user;
}

export function getUser(socketId: string): UserInfo | undefined {
  return userMap.get(socketId);
}

export function getRoomUsers(room: string): UserInfo[] {
  return [...(roomUsers.get(room) ?? [])].map((id) => userMap.get(id)!).filter(Boolean);
}

export function getRoomUsernames(room: string): string[] {
  return getRoomUsers(room).map((u) => u.username);
}

export function addMessage(room: string, msg: ChatMessage): void {
  if (!roomMessages.has(room)) roomMessages.set(room, []);
  const msgs = roomMessages.get(room)!;
  msgs.push(msg);
  if (msgs.length > 200) msgs.shift();

  if (persistMode && msg.type === "message") {
    try { dbSave({ ...msg, room }); } catch { /* non-fatal */ }
  }
}

export function getMessages(room: string): ChatMessage[] {
  if (roomMessages.has(room)) return roomMessages.get(room)!;
  // Load from DB on first access even if no one is in the room yet
  if (persistMode) {
    const history = getRecentMessages(room, 100).map(dbMsgToChatMsg);
    roomMessages.set(room, history);
    return history;
  }
  return [];
}

// Returns a page of messages older than the given timestamp (for infinite scroll)
export function getMessagesBefore(room: string, beforeTimestamp: number, limit = 50): ChatMessage[] {
  const msgs = roomMessages.get(room) ?? [];
  return msgs.filter((m) => m.timestamp < beforeTimestamp).slice(-limit);
}

// Deletes a message — returns true if deleted, false if not found or not owner
export function deleteMessage(room: string, msgId: string, username: string): boolean {
  const msgs = roomMessages.get(room);
  if (!msgs) return false;
  const idx = msgs.findIndex((m) => m.id === msgId);
  if (idx === -1) return false;
  if (msgs[idx].username !== username) return false;
  msgs.splice(idx, 1);
  return true;
}

// Toggles a reaction — returns the updated message or null if not found
export function toggleReaction(room: string, msgId: string, emoji: string, username: string): ChatMessage | null {
  const msgs = roomMessages.get(room);
  if (!msgs) return null;
  const msg = msgs.find((m) => m.id === msgId);
  if (!msg) return null;
  if (!msg.reactions) msg.reactions = {};
  const users = msg.reactions[emoji] ?? [];
  const idx = users.indexOf(username);
  if (idx === -1) {
    msg.reactions[emoji] = [...users, username];
  } else {
    msg.reactions[emoji] = users.filter((u) => u !== username);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  }
  return msg;
}

// Retrieves a message by id from any room map entry
export function findMessage(room: string, msgId: string): ChatMessage | undefined {
  return roomMessages.get(room)?.find((m) => m.id === msgId);
}

// Pinning
export function pinMessage(room: string, msgId: string): ChatMessage | null {
  const msg = findMessage(room, msgId);
  if (!msg) return null;
  pinnedMessages.set(room, msg);
  return msg;
}

export function unpinMessage(room: string): void {
  pinnedMessages.delete(room);
}

export function getPinned(room: string): ChatMessage | undefined {
  return pinnedMessages.get(room);
}

// Search messages across all channels visible to the caller
export function searchMessages(query: string): Array<{ room: string; msg: ChatMessage }> {
  const q = query.toLowerCase();
  const results: Array<{ room: string; msg: ChatMessage }> = [];
  for (const [room, msgs] of roomMessages) {
    if (room.startsWith("dm:")) continue; // don't leak DMs
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
export function canStoreFile(sizeBytes: number, budgetMb: number): boolean {
  return (totalStorageBytes + sizeBytes) <= budgetMb * 1024 * 1024;
}

export function getTotalStorageMb(): number {
  return totalStorageBytes / (1024 * 1024);
}

export function addFileRecord(file: FileRecord): void {
  fileStore.set(file.id, file);
  totalStorageBytes += file.size;
}

export function getFileRecord(fileId: string): FileRecord | undefined {
  return fileStore.get(fileId);
}

export function deleteFileRecord(fileId: string): void {
  const record = fileStore.get(fileId);
  if (record) {
    totalStorageBytes = Math.max(0, totalStorageBytes - record.size);
    record.chunks = [];
    fileStore.delete(fileId);
  }
}

export function getAllFileRecords(): FileRecord[] {
  return [...fileStore.values()];
}

export function toFileMetadata(record: FileRecord): FileMetadata {
  return {
    id: record.id, name: record.name, size: record.size,
    mimeType: record.mimeType, uploadedBy: record.uploadedBy,
    room: record.room,
    timestamp: record.timestamp, expiresAt: record.expiresAt,
  };
}

// ── DMs ───────────────────────────────────────────────────────

export function dmRoomId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(":")}`;
}

export function findSocketByUsername(username: string): string | undefined {
  const sockets = usernameToSockets.get(username);
  if (!sockets || sockets.size === 0) return undefined;
  return [...sockets][0]; // return first socket (for single-tab; DMs go to all tabs via loop in chat.ts)
}

export function findAllSocketsByUsername(username: string): string[] {
  const sockets = usernameToSockets.get(username);
  return sockets ? [...sockets] : [];
}

export function getAllUsers(): UserInfo[] {
  // Deduplicate by username — same user in multiple tabs counts as one
  const seen = new Map<string, UserInfo>();
  for (const u of userMap.values()) {
    if (!seen.has(u.username)) seen.set(u.username, u);
  }
  return [...seen.values()];
}

// Returns how many active socket connections exist for a username
export function connectionCountForUser(username: string): number {
  let count = 0;
  for (const u of userMap.values()) {
    if (u.username === username) count++;
  }
  return count;
}

function dbMsgToChatMsg(m: DbMessage): ChatMessage {
  return { id: m.id, username: m.username, text: m.text, timestamp: m.timestamp, type: m.type };
}
