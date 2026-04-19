import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: true,
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
          if (id.includes("node_modules/")) return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ["localchat.local"],
    proxy: {
      "/api": "http://localhost:5001",
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true,
      },
      "/discover": "http://localhost:5001",
      "/qr": "http://localhost:5001",
    },
  },
});
