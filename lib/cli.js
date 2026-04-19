#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// node:sqlite requires --experimental-sqlite flag in Node 22
// Inject it via NODE_OPTIONS so the flag is set before any imports
if (!process.execArgv.includes("--experimental-sqlite")) {
    const { execFileSync } = require("child_process");
    try {
        execFileSync(process.execPath, ["--experimental-sqlite", __filename, ...process.argv.slice(2)], {
            stdio: "inherit",
            env: { ...process.env },
        });
    }
    catch (e) {
        process.exit(e.status ?? 1);
    }
    process.exit(0);
}
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const CONFIG_FILE = path_1.default.join(os_1.default.homedir(), ".localchat", "config.json");
function loadConfig() {
    try {
        return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, "utf-8"));
    }
    catch {
        return {
            mdnsName: "localchat",
            port: 5001,
            persist: false,
            dataDir: path_1.default.join(os_1.default.homedir(), ".localchat"),
        };
    }
}
function saveConfig(cfg) {
    fs_1.default.mkdirSync(path_1.default.dirname(CONFIG_FILE), { recursive: true });
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
const program = new commander_1.Command();
program
    .name("localchat")
    .description("LAN-only ephemeral chat and file sharing")
    .version("1.0.0");
// ── localchat start ──────────────────────────────────────────
program
    .command("start", { isDefault: true })
    .description("Start the LocalChat server")
    .option("-p, --port <number>", "Port to listen on (default: 80)")
    .option("--persist", "Enable SQLite persistence for message history")
    .option("--name <name>", "mDNS domain name (e.g. myteam → myteam.local)")
    .action((opts) => {
    const cfg = loadConfig();
    if (opts.name)
        cfg.mdnsName = opts.name;
    if (opts.port)
        cfg.port = parseInt(opts.port, 10);
    if (opts.persist)
        cfg.persist = true;
    process.env.PORT = String(cfg.port);
    process.env.MDNS_NAME = cfg.mdnsName;
    process.env.PERSIST = String(cfg.persist);
    process.env.DATA_DIR = cfg.dataDir;
    // Dynamic import so CLI loads fast even without the server bundle
    Promise.resolve().then(() => __importStar(require("./index.js"))).then(({ startServer }) => {
        startServer({
            port: cfg.port,
            mdnsName: cfg.mdnsName,
            persist: cfg.persist,
            dataDir: cfg.dataDir,
        });
    });
});
// ── localchat domain <name> ──────────────────────────────────
program
    .command("domain <name>")
    .description("Set the mDNS domain name (e.g. localchat domain myteam → http://myteam.local)")
    .action((name) => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!clean) {
        console.error("Invalid name. Use letters, numbers, and hyphens only.");
        process.exit(1);
    }
    const cfg = loadConfig();
    cfg.mdnsName = clean;
    saveConfig(cfg);
    console.log(`\n✓ Domain set to: http://${clean}.local`);
    console.log(`  Run "localchat start" to apply.\n`);
});
// ── localchat port <number> ──────────────────────────────────
program
    .command("port <number>")
    .description("Set the server port (use 80 for no port in URL)")
    .action((num) => {
    const port = parseInt(num, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error("Invalid port number.");
        process.exit(1);
    }
    const cfg = loadConfig();
    cfg.port = port;
    saveConfig(cfg);
    const portSuffix = port === 80 ? "" : `:${port}`;
    console.log(`\n✓ Port set to: ${port}`);
    console.log(`  Access via: http://${cfg.mdnsName}.local${portSuffix}`);
    console.log(`  Run "localchat start" to apply.\n`);
});
// ── localchat persist ────────────────────────────────────────
program
    .command("persist [on|off]")
    .description("Enable or disable SQLite message persistence")
    .action((flag = "on") => {
    const enabled = flag !== "off";
    const cfg = loadConfig();
    cfg.persist = enabled;
    saveConfig(cfg);
    console.log(`\n✓ Persistence ${enabled ? "enabled" : "disabled"}`);
    if (enabled)
        console.log(`  DB: ${cfg.dataDir}/localchat.db`);
    console.log(`  Run "localchat start" to apply.\n`);
});
// ── localchat config ─────────────────────────────────────────
program
    .command("config")
    .description("Show current configuration")
    .action(() => {
    const cfg = loadConfig();
    const portSuffix = cfg.port === 80 ? "" : `:${cfg.port}`;
    console.log(`\nLocalChat Configuration`);
    console.log(`  Domain:      http://${cfg.mdnsName}.local${portSuffix}`);
    console.log(`  Port:        ${cfg.port}`);
    console.log(`  Persistence: ${cfg.persist ? "enabled" : "disabled"}`);
    console.log(`  Data dir:    ${cfg.dataDir}`);
    console.log(`  Config file: ${CONFIG_FILE}\n`);
});
// ── localchat hardreset ───────────────────────────────────────
program
    .command("hardreset")
    .description("Delete ALL data: database, config, uploaded files — full factory reset")
    .action(() => {
    const cfg = loadConfig();
    const dataDir = cfg.dataDir;
    if (!fs_1.default.existsSync(dataDir)) {
        console.log(`\n  No data directory found at: ${dataDir}\n`);
        return;
    }
    try {
        fs_1.default.rmSync(dataDir, { recursive: true, force: true });
        console.log(`\n✓ Removed all data at: ${dataDir}`);
        console.log(`  LocalChat has been fully reset.\n`);
    }
    catch (err) {
        const code = err.code;
        if (code === "EBUSY" || code === "EPERM") {
            console.error(`\n✗ Cannot delete — the database file is locked.`);
            console.error(`  Stop the running LocalChat server first, then try again.\n`);
            process.exit(1);
        }
        throw err;
    }
});
// ── localchat clear users ────────────────────────────────────
program
    .command("clear-users")
    .description("Remove all user accounts and sessions (keeps messages and config)")
    .action(() => {
    const cfg = loadConfig();
    const dbPath = path_1.default.join(cfg.dataDir, "localchat.db");
    if (!fs_1.default.existsSync(dbPath)) {
        console.log(`\n  No database found at: ${dbPath}\n`);
        return;
    }
    try {
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(dbPath);
        db.exec("PRAGMA foreign_keys = ON");
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
        db.prepare("DELETE FROM sessions").run();
        db.prepare("DELETE FROM users").run();
        db.close();
        console.log(`\n✓ Cleared ${userCount.count} user(s) and all sessions.`);
        console.log(`  Messages and config are preserved.\n`);
    }
    catch (err) {
        const msg = err.message ?? "";
        if (msg.includes("SQLITE_BUSY") || msg.includes("database is locked")) {
            console.error(`\n✗ Database is locked — stop the running LocalChat server first.\n`);
            process.exit(1);
        }
        throw err;
    }
});
// ── Windows port 80 helper ───────────────────────────────────
program
    .command("setup-port80")
    .description("(Windows) Forward port 80 → 3000 using netsh (run as Administrator)")
    .action(() => {
    console.log(`\nRun this in PowerShell as Administrator:\n`);
    console.log(`  netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1\n`);
    console.log(`To remove it later:`);
    console.log(`  netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0\n`);
});
program.parse(process.argv);
