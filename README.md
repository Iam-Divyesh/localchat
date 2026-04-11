# LocalChat

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

## Install

Requires [Node.js 22+](https://nodejs.org/).

```bash
npm install -g github:Iam-Divyesh/localchat
```

---

## Usage

```bash
localchat start                  # Start on port 3000
localchat start --port 80        # Start on port 80 (no port in URL)
localchat start --persist        # Enable message persistence to disk
localchat domain myteam          # Set mDNS name → http://myteam.local
localchat port 8080              # Change default port
localchat config                 # Show current config
localchat clear-users            # Remove all accounts (keeps messages)
localchat hardreset              # Delete all data and reset to factory defaults
localchat setup-port80           # (Windows) Forward port 80 → 3000 via netsh
```

Open the URL shown in the terminal (e.g. `http://192.168.1.50:3000`).

Teammates on the same LAN just open that URL — no install required on their end.

---

## Uninstall

```bash
npm uninstall -g localchat-app
```

---

## Discovery — How teammates find the server

| Platform | How to access |
|---|---|
| macOS / Linux / iOS | `http://localchat.local:3000` (mDNS, automatic) |
| Windows | Install [Bonjour Print Services](https://support.apple.com/kb/DL999), then use `localchat.local` |
| Android / any device | Scan the QR code at `http://<server-ip>:3000/qr` |
| Everyone | Direct IP — printed in terminal on startup |

**Tip:** Reserve a fixed IP for your server in your router's DHCP settings so teammates can bookmark it once and never update it.

---

## Docker

```bash
docker compose up --build
```

> `network_mode: host` is required for mDNS multicast and UDP broadcast to work on the LAN.

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

## Security

- **LAN only** — binds to `0.0.0.0` but not intended for internet exposure (keep firewall rules in place)
- **No authentication** — the local network is the trust boundary
- **No data persistence** — no logs, no database, no recovery vectors
- **File validation** — size limits enforced server-side; files are never executed
- **Rate limiting** — add if needed for larger or untrusted networks

For semi-trusted networks (shared office WiFi), consider adding room passwords or HTTPS with a self-signed certificate.

---

## License

[MIT](./LICENSE) — free to use, modify, and distribute.

---

*Built for internal onsite teams who value speed, privacy, and zero setup.*
