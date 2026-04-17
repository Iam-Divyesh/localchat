"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT ?? "5001", 10),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? "50", 10),
    maxStorageMb: parseInt(process.env.MAX_STORAGE_MB ?? "500", 10),
    fileExpiryMinutes: parseInt(process.env.FILE_EXPIRY_MINUTES ?? "5", 10),
    mdnsName: process.env.MDNS_NAME ?? "localchat",
    udpBroadcastPort: parseInt(process.env.UDP_BROADCAST_PORT ?? "41234", 10),
    persist: process.env.PERSIST === "true",
    dataDir: process.env.DATA_DIR,
};
