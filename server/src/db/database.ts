import { DatabaseSync, StatementSync } from "node:sqlite";
import path from "path";
import os from "os";
import fs from "fs";
import bcrypt from "bcryptjs";

let db: DatabaseSync | null = null;

// node:sqlite returns null-prototype objects; spread them into plain objects
function plain<T>(obj: unknown): T {
  return Object.assign({}, obj) as T;
}

export function initDb(dataDir?: string): DatabaseSync {
  const dir = dataDir ?? path.join(os.homedir(), ".localchat");
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "localchat.db");

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      email     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      username  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password  TEXT    NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT    PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      name TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id        TEXT    PRIMARY KEY,
      room      TEXT    NOT NULL,
      username  TEXT    NOT NULL,
      text      TEXT    NOT NULL,
      type      TEXT    NOT NULL DEFAULT 'message',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (room) REFERENCES rooms(name)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages(room, timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
  `);

  console.log(`[db] Storage: ${dbPath}`);
  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error("Database not initialized. Start server with PERSIST=true.");
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

// ── Auth ───────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  email: string;
  username: string;
  created_at: number;
}

export function registerUser(email: string, username: string, password: string): DbUser {
  const hash = bcrypt.hashSync(password, 10);
  const stmt = getDb().prepare(
    "INSERT INTO users (email, username, password) VALUES (?, ?, ?)"
  );
  const result = stmt.run(email.trim().toLowerCase(), username.trim(), hash);
  return getUserById(Number(result.lastInsertRowid))!;
}

export function loginUser(email: string, password: string): DbUser | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as (DbUser & { password: string }) | undefined;
  if (!row) return null;
  const r = plain<DbUser & { password: string }>(row);
  if (!bcrypt.compareSync(password, r.password)) return null;
  return { id: r.id, email: r.email, username: r.username, created_at: r.created_at };
}

export function getUserById(id: number): DbUser | null {
  const row = getDb()
    .prepare("SELECT id, email, username, created_at FROM users WHERE id = ?")
    .get(id);
  return row ? plain<DbUser>(row) : null;
}

export function getUserByEmail(email: string): DbUser | null {
  const row = getDb()
    .prepare("SELECT id, email, username, created_at FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  return row ? plain<DbUser>(row) : null;
}

export function updateUsername(userId: number, newUsername: string): { ok: boolean; error?: string } {
  try {
    getDb().prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername.trim(), userId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("UNIQUE")) return { ok: false, error: "Username already taken" };
    return { ok: false, error: "Update failed" };
  }
}

export function updatePassword(userId: number, currentPassword: string, newPassword: string): { ok: boolean; error?: string } {
  const row = getDb()
    .prepare("SELECT password FROM users WHERE id = ?")
    .get(userId) as { password: string } | undefined;
  if (!row) return { ok: false, error: "User not found" };
  const r = plain<{ password: string }>(row);
  if (!bcrypt.compareSync(currentPassword, r.password)) return { ok: false, error: "Current password is incorrect" };
  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, userId);
  return { ok: true };
}

export function resetPasswordByEmail(email: string, currentPassword: string, newPassword: string): { ok: boolean; error?: string } {
  const row = getDb()
    .prepare("SELECT id, password FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as { id: number; password: string } | undefined;
  if (!row) return { ok: false, error: "No account found with that email" };
  const r = plain<{ id: number; password: string }>(row);
  if (!bcrypt.compareSync(currentPassword, r.password)) return { ok: false, error: "Current password is incorrect" };
  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, r.id);
  return { ok: true };
}

export function getUserByUsername(username: string): DbUser | null {
  const row = getDb()
    .prepare("SELECT id, email, username, created_at FROM users WHERE username = ?")
    .get(username);
  return row ? plain<DbUser>(row) : null;
}

// ── Sessions ───────────────────────────────────────────────────

export function createSession(userId: number): string {
  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt);
  return token;
}

export function validateSession(token: string): DbUser | null {
  const row = getDb()
    .prepare(`
      SELECT u.id, u.email, u.username, u.created_at
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > unixepoch()
    `)
    .get(token);
  return row ? plain<DbUser>(row) : null;
}

export function deleteSession(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ── Rooms ──────────────────────────────────────────────────────

export function ensureRoom(room: string): void {
  getDb().prepare("INSERT OR IGNORE INTO rooms (name) VALUES (?)").run(room);
}

// ── Messages ───────────────────────────────────────────────────

export interface DbMessage {
  id: string;
  room: string;
  username: string;
  text: string;
  type: "message" | "system";
  timestamp: number;
}

export function saveMessage(msg: DbMessage): void {
  ensureRoom(msg.room);
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO messages (id, room, username, text, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(msg.id, msg.room, msg.username, msg.text, msg.type, msg.timestamp);
}

export function getRecentMessages(room: string, limit = 100): DbMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT id, room, username, text, type, timestamp
       FROM messages WHERE room = ?
       ORDER BY timestamp DESC LIMIT ?`
    )
    .all(room, limit) as unknown[];
  return (rows.map(plain) as DbMessage[]).reverse();
}
