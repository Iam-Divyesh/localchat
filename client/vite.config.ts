import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom")) return "react-dom";
          if (id.includes("node_modules/react/")) return "react";
          if (id.includes("node_modules/lucide-react")) return "lucide";
          if (id.includes("node_modules/socket.io-client")) return "socketio";
          if (id.includes("node_modules/engine.io-client")) return "engineio";
          if (id.includes("node_modules/@socket.io")) return "socketio-parser";
          if (id.includes("node_modules/emoji-picker-react")) return "emoji";
          if (id.includes("node_modules/")) return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localchat.local"],
    proxy: {
      "/api": "http://localhost:1552",
      "/socket.io": {
        target: "http://localhost:1552",
        ws: true,
      },
      "/discover": "http://localhost:1552",
      "/qr": "http://localhost:1552",
    },
  },
});
