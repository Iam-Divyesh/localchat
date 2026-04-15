#!/usr/bin/env node
// Build script: compiles client + server and copies output to root dist/ and client-dist/
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const clientDir = path.join(root, "client");
const serverDir = path.join(root, "server");
const clientDist = path.join(clientDir, "dist");
const rootDist = path.join(root, "dist");
const rootClientDist = path.join(root, "client-dist");

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log("\n=== Building LocalChat ===\n");

// 1. Install client deps
run("npm install", clientDir);

// 2. Build client
run("npm run build", clientDir);

// 3. Install server deps
run("npm install", serverDir);

// 4. Build server TypeScript → server/dist (temporary)
run("npm run build", serverDir);

// 5. Copy server/dist → root dist/
if (fs.existsSync(rootDist)) fs.rmSync(rootDist, { recursive: true, force: true });
fs.cpSync(path.join(serverDir, "dist"), rootDist, { recursive: true });
console.log(`\n> Copied server/dist → dist/`);

// 6. Copy client/dist → root client-dist/
if (fs.existsSync(rootClientDist)) fs.rmSync(rootClientDist, { recursive: true, force: true });
fs.cpSync(clientDist, rootClientDist, { recursive: true });
console.log(`\n> Copied client/dist → client-dist/`);

console.log("\n=== Build complete ===\n");
