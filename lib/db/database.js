"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.updateUsername = updateUsername;
exports.updatePassword = updatePassword;
exports.resetPasswordByEmail = resetPasswordByEmail;
exports.getUserByUsername = getUserByUsername;
exports.createSession = createSession;
exports.validateSession = validateSession;
exports.deleteSession = deleteSession;
exports.ensureRoom = ensureRoom;
exports.saveMessage = saveMessage;
exports.getRecentMessages = getRecentMessages;
const node_sqlite_1 = require("node:sqlite");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
let db = null;
// node:sqlite returns null-prototype objects; spread them into plain objects
function plain(obj) {
    return Object.assign({}, obj);
}
function initDb(dataDir) {
    const dir = dataDir ?? path_1.default.join(os_1.default.homedir(), ".localchat");
    fs_1.default.mkdirSync(dir, { recursive: true });
    const dbPath = path_1.default.join(dir, "localchat.db");
    db = new node_sqlite_1.DatabaseSync(dbPath);
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
function getDb() {
    if (!db)
        throw new Error("Database not initialized. Start server with PERSIST=true.");
    return db;
}
function closeDb() {
    db?.close();
    db = null;
}
function registerUser(email, username, password) {
    const hash = bcryptjs_1.default.hashSync(password, 10);
    const stmt = getDb().prepare("INSERT INTO users (email, username, password) VALUES (?, ?, ?)");
    const result = stmt.run(email.trim().toLowerCase(), username.trim(), hash);
    return getUserById(Number(result.lastInsertRowid));
}
function loginUser(email, password) {
    const row = getDb()
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email.trim().toLowerCase());
    if (!row)
        return null;
    const r = plain(row);
    if (!bcryptjs_1.default.compareSync(password, r.password))
        return null;
    return { id: r.id, email: r.email, username: r.username, created_at: r.created_at };
}
function getUserById(id) {
    const row = getDb()
        .prepare("SELECT id, email, username, created_at FROM users WHERE id = ?")
        .get(id);
    return row ? plain(row) : null;
}
function getUserByEmail(email) {
    const row = getDb()
        .prepare("SELECT id, email, username, created_at FROM users WHERE email = ?")
        .get(email.trim().toLowerCase());
    return row ? plain(row) : null;
}
function updateUsername(userId, newUsername) {
    try {
        getDb().prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername.trim(), userId);
        return { ok: true };
    }
    catch (err) {
        const msg = err.message ?? "";
        if (msg.includes("UNIQUE"))
            return { ok: false, error: "Username already taken" };
        return { ok: false, error: "Update failed" };
    }
}
function updatePassword(userId, currentPassword, newPassword) {
    const row = getDb()
        .prepare("SELECT password FROM users WHERE id = ?")
        .get(userId);
    if (!row)
        return { ok: false, error: "User not found" };
    const r = plain(row);
    if (!bcryptjs_1.default.compareSync(currentPassword, r.password))
        return { ok: false, error: "Current password is incorrect" };
    const hash = bcryptjs_1.default.hashSync(newPassword, 10);
    getDb().prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, userId);
    return { ok: true };
}
function resetPasswordByEmail(email, currentPassword, newPassword) {
    const row = getDb()
        .prepare("SELECT id, password FROM users WHERE email = ?")
        .get(email.trim().toLowerCase());
    if (!row)
        return { ok: false, error: "No account found with that email" };
    const r = plain(row);
    if (!bcryptjs_1.default.compareSync(currentPassword, r.password))
        return { ok: false, error: "Current password is incorrect" };
    const hash = bcryptjs_1.default.hashSync(newPassword, 10);
    getDb().prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, r.id);
    return { ok: true };
}
function getUserByUsername(username) {
    const row = getDb()
        .prepare("SELECT id, email, username, created_at FROM users WHERE username = ?")
        .get(username);
    return row ? plain(row) : null;
}
// ── Sessions ───────────────────────────────────────────────────
function createSession(userId) {
    const token = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
    getDb()
        .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
        .run(token, userId, expiresAt);
    return token;
}
function validateSession(token) {
    const row = getDb()
        .prepare(`
      SELECT u.id, u.email, u.username, u.created_at
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > unixepoch()
    `)
        .get(token);
    return row ? plain(row) : null;
}
function deleteSession(token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
// ── Rooms ──────────────────────────────────────────────────────
function ensureRoom(room) {
    getDb().prepare("INSERT OR IGNORE INTO rooms (name) VALUES (?)").run(room);
}
function saveMessage(msg) {
    ensureRoom(msg.room);
    getDb()
        .prepare("INSERT OR IGNORE INTO messages (id, room, username, text, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
        .run(msg.id, msg.room, msg.username, msg.text, msg.type, msg.timestamp);
}
function getRecentMessages(room, limit = 100) {
    const rows = getDb()
        .prepare(`SELECT id, room, username, text, type, timestamp
       FROM messages WHERE room = ?
       ORDER BY timestamp DESC LIMIT ?`)
        .all(room, limit);
    return rows.map(plain).reverse();
}
