# 💬 LocalChat

**LAN-only ephemeral chat and file sharing — no internet, no persistence, no installation for users.**

Open a browser, type your name, start chatting. Files and messages vanish when the session ends.

---

## Features

- **Real-time chat** — instant messaging with typing indicators and online user list
- **File sharing** — drag & drop any file (PDF, image, doc, zip…) directly into the chat
- **Multiple rooms** — create or switch rooms on the fly
- **Session-only** — zero persistence; everything is gone when the server restarts
- **LAN discovery** — announces via mDNS (`localchat.local`) + UDP broadcast fallback
- **QR code** — `/qr` endpoint generates a scannable link for mobile devices
- **No installation for users** — just open a browser
- **Dark mode** — auto-detects system preference, toggleable

---

## Quick Start

### Install from GitHub (recommended)

Requires [Node.js 18+](https://nodejs.org/) and npm. No other setup needed.

```bash
npm install -g github:your-github-username/localchat
localchat start
```

Open your browser at the URL shown in the terminal (e.g. `http://192.168.1.50:3000`).

Teammates on the same LAN just open that URL — no install required for them.

### CLI commands

```bash
localchat start                    # Start on port 3000
localchat start --port 80          # Start on port 80 (no port in URL)
localchat start --persist          # Enable message persistence to disk
localchat domain myteam            # Set mDNS name → http://myteam.local
localchat config                   # Show current config
localchat hardreset                # Delete all data and reset
localchat clear-users              # Remove all accounts (keeps messages)
localchat setup-port80             # (Windows) Print port 80 forwarding command
```

---

### Run from source (development)

```bash
git clone https://github.com/your-github-username/localchat
cd localchat

# Install dependencies
cd server && npm install && cd ../client && npm install && cd ..

# Start dev servers (two terminals)
cd server && npm run dev     # Terminal 1
cd client && npm run dev     # Terminal 2
```

---

## Discovery — How teammates find the server

| Platform | How to access |
|---|---|
| macOS / Linux / iOS | `http://localchat.local:3000` (mDNS, automatic) |
| Windows | Install [Bonjour Print Services](https://support.apple.com/kb/DL999) (free), then use `localchat.local` |
| Android / any device | Scan the QR code at `http://<server-ip>:3000/qr` |
| Everyone | Direct IP — shown in terminal on startup |

### Recommended: Static DHCP reservation

Reserve a fixed IP for your server machine in your router admin panel (DHCP → Static/Reserved leases → bind to MAC address). The IP never changes — teammates bookmark it once.

---

## Docker

```bash
docker compose up --build
```

> Note: `network_mode: host` is required for mDNS multicast and UDP broadcast to reach the LAN.

---

## Configuration

All settings via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `MAX_FILE_SIZE_MB` | `200` | Max file size per upload |
| `FILE_EXPIRY_MINUTES` | `5` | Minutes until shared files are cleared from RAM |
| `MDNS_NAME` | `localchat` | mDNS hostname (`<name>.local`) |
| `UDP_BROADCAST_PORT` | `41234` | UDP port for LAN discovery broadcasts |

---

## Architecture

```
client/   React + Vite + Tailwind — browser UI
server/   Node.js + Express + Socket.IO — LAN server

No database. All state is in-memory.
Server restart = all messages and files gone.
```

**File transfer flow:**
1. Sender drags file → split into 64 KB chunks
2. Chunks sent via Socket.IO binary frames
3. Server buffers chunks in RAM
4. File announced to room
5. Recipients click download → chunks streamed to browser
6. Browser assembles Blob → download triggered
7. File cleared from RAM after 5 minutes or server restart

---

## Project Structure

```
localchat/
├── server/
│   └── src/
│       ├── index.ts              # Express + Socket.IO entry
│       ├── config.ts             # Env config
│       ├── socket/
│       │   ├── chat.ts           # Chat event handlers
│       │   └── files.ts          # File transfer handlers
│       ├── store/
│       │   └── rooms.ts          # In-memory state
│       └── discovery/
│           ├── mdns.ts           # Bonjour/mDNS announce
│           └── udpBroadcast.ts   # UDP broadcast for discovery
├── client/
│   └── src/
│       ├── App.tsx
│       ├── components/           # UI components
│       ├── hooks/                # Socket, chat, file hooks
│       └── lib/                  # Socket client, file chunker
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── LICENSE                       # MIT
└── README.md
```

---

## Development

Run server and client concurrently in dev mode:

**Terminal 1 — Server:**
```bash
cd server && npm run dev
```

**Terminal 2 — Client (with HMR):**
```bash
cd client && npm run dev
```

Client dev server proxies `/socket.io`, `/discover`, and `/qr` to `localhost:3000`.

---

## Security

- **LAN only** — bind to `0.0.0.0` but not exposed to internet (keep firewall rules in place)
- **No authentication** — the local network is the trust boundary
- **No data persistence** — no logs, no database, no recovery vectors
- **File validation** — size limits enforced server-side; files never executed
- **Rate limiting** — add if needed for larger/untrusted networks

For semi-trusted networks (shared office WiFi), consider adding room passwords or HTTPS with a self-signed certificate.

---

## Contributing

Contributions are welcome! This project is MIT licensed and open to everyone.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Open a Pull Request with a clear description

### Ideas for contributions

- [ ] Emoji picker
- [ ] Image preview inline in chat
- [ ] Pinned messages
- [ ] Sound notifications
- [ ] Room passwords
- [ ] HTTPS / WSS support guide
- [ ] dnsmasq / Pi-hole setup guide
- [ ] Electron wrapper for desktop

Please keep PRs focused. No new dependencies without discussion. No persistence features — session-only is a core design principle.

---

## License

[MIT](./LICENSE) — free to use, modify, and distribute.

---

*Built for internal onsite teams who value speed, privacy, and zero setup.*
