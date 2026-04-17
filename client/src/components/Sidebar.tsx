import { useState } from "react";
import { Hash, Plus, Wifi, WifiOff, QrCode, LogOut, MessageSquare, X, Trash2, ScrollText, Settings } from "lucide-react";
import { DmConversation } from "../hooks/useChat";

interface Props {
  room: string;
  channels: string[];
  unreadChannels: Set<string>;
  allUsers: string[];
  currentUser: string;
  dms: Map<string, DmConversation>;
  activeView: { type: "room"; room: string } | { type: "dm"; roomId: string; peer: string };
  onChangeRoom: (room: string) => void;
  onCreateChannel: (name: string) => void;
  onDeleteChannel: (name: string) => void;
  onOpenDm: (peer: string) => void;
  onLogout: () => void;
  connected: boolean;
  mentions: Array<{ from: string; room: string; text: string; msgId: string }>;
  onDismissMention: (msgId: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  room, channels, unreadChannels, allUsers, currentUser, dms,
  activeView, onChangeRoom, onCreateChannel, onDeleteChannel,
  onOpenDm, onLogout, connected, mentions, onDismissMention, onOpenSettings,
}: Props) {
  const [channelInput, setChannelInput] = useState("");
  const [showChannelInput, setShowChannelInput] = useState(false);

  const handleCreate = () => {
    const r = channelInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!r) return;
    setChannelInput("");
    setShowChannelInput(false);
    onCreateChannel(r);
    onChangeRoom(r);
  };

  const totalDmUnread = [...dms.values()].reduce((s, d) => s + d.unread, 0);
  const dmPeers = new Set([...dms.values()].map((d) => d.peer));
  const otherUsers = allUsers.filter((u) => u !== currentUser);

  const avColor = (name: string) => {
    const colors = [
      { bg: "#EFF4FF", fg: "#2563EB" },
      { bg: "#FEF3C7", fg: "#B45309" },
      { bg: "#FCE7F3", fg: "#BE185D" },
      { bg: "#E0F2FE", fg: "#0369A1" },
      { bg: "#F0FDF4", fg: "#15803D" },
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const myColor = avColor(currentUser);

  return (
    <aside
      className="sidebar-width flex-shrink-0 flex flex-col h-full"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
          <MessageSquare className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="flex-1" style={{ fontFamily: "var(--font-serif)", fontSize: "16px", color: "var(--text-primary)" }}>
          LocalChat
        </span>
        <span className="live-pill">{connected ? "live" : "off"}</span>
        {!connected && <WifiOff className="w-3.5 h-3.5 ml-1" style={{ color: "var(--error)" }} />}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: "none" }}>

        {/* Channels section */}
        <div className="mb-1">
          <div className="flex items-center justify-between px-4 mb-1">
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "11px", color: "var(--text-dim)" }}>
              Channels
            </span>
            <button
              onClick={() => setShowChannelInput((v) => !v)}
              className="icon-btn"
              style={{ width: "20px", height: "20px", borderRadius: "4px" }}
              title="New channel"
            >
              {showChannelInput ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showChannelInput && (
            <div className="px-3 pb-2 flex gap-1.5">
              <input
                autoFocus
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowChannelInput(false); }}
                placeholder="channel-name"
                className="flex-1 text-sm px-3 py-1.5 rounded-md"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-mid)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 text-xs font-medium rounded-md"
                style={{ background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
              >
                Add
              </button>
            </div>
          )}

          {channels.map((c) => {
            const isActive = activeView.type === "room" && room === c;
            const isLog = c === "log";
            const isProtected = c === "general" || c === "log";
            const hasUnread = !isActive && unreadChannels.has(c);
            return (
              <ChannelRow
                key={c}
                label={c}
                active={isActive}
                isLog={isLog}
                canDelete={!isProtected}
                hasUnread={hasUnread}
                onClick={() => onChangeRoom(c)}
                onDelete={() => onDeleteChannel(c)}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 mx-4" style={{ height: "1px", background: "var(--border-soft)" }} />

        {/* DMs section */}
        <div className="mb-1">
          <div className="flex items-center justify-between px-4 mb-1">
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "11px", color: "var(--text-dim)" }}>
              Messages
            </span>
            {totalDmUnread > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent)", color: "#fff", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                {totalDmUnread}
              </span>
            )}
          </div>

          {[...dms.values()].map((dm) => {
            const c = avColor(dm.peer);
            return (
              <DmRow
                key={dm.roomId}
                label={dm.peer}
                active={activeView.type === "dm" && activeView.roomId === dm.roomId}
                badge={dm.unread}
                avBg={c.bg}
                avFg={c.fg}
                onClick={() => onOpenDm(dm.peer)}
              />
            );
          })}

          {otherUsers.filter((u) => !dmPeers.has(u)).map((u) => {
            const c = avColor(u);
            return (
              <DmRow
                key={u}
                label={u}
                active={false}
                avBg={c.bg}
                avFg={c.fg}
                muted
                onClick={() => onOpenDm(u)}
              />
            );
          })}

          {otherUsers.length === 0 && (
            <p className="px-4 py-2 text-sm italic" style={{ color: "var(--text-dim)", fontFamily: "var(--font-serif)" }}>
              No other users online
            </p>
          )}
        </div>

        {/* Online users */}
        <div className="mt-6" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <p className="px-4 pt-3 pb-1" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "11px", color: "var(--text-dim)" }}>
            Online · {allUsers.length}
          </p>
          {allUsers.map((u) => {
            const c = avColor(u);
            return (
              <div key={u} className="flex items-center gap-2.5 px-4 py-1.5 rounded-md mx-1.5" style={{ cursor: "default" }}>
                <div className="av relative" style={{ width: "20px", height: "20px", background: c.bg, color: c.fg, fontSize: "9px" }}>
                  {u[0]?.toUpperCase()}
                  <span className="online-dot" style={{ borderColor: "var(--sidebar-bg)" }} />
                </div>
                <span style={{ fontSize: "12px", color: u === currentUser ? "var(--accent)" : "var(--text-muted)" }}>
                  {u}{u === currentUser && <em style={{ fontStyle: "normal", color: "var(--text-dim)", fontSize: "11px" }}> · you</em>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mentions */}
        {mentions.length > 0 && (
          <div className="mx-3 mt-4 rounded-lg overflow-hidden" style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)" }}>
            <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Mentions
              </span>
            </div>
            {mentions.slice(-3).map((m) => (
              <div key={m.msgId} className="flex items-start gap-2 px-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{m.from}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}> in #{m.room}</span>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{m.text}</p>
                </div>
                <button onClick={() => onDismissMention(m.msgId)} className="icon-btn" style={{ width: "20px", height: "20px", flexShrink: 0 }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User bar */}
      <div className="flex items-center gap-2.5 px-3 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--sidebar-bg)" }}>
        <button
          onClick={onOpenSettings}
          className="av flex-shrink-0"
          style={{ width: "28px", height: "28px", background: myColor.bg, color: myColor.fg, fontSize: "11px", border: "none", cursor: "pointer" }}
          title="Settings"
        >
          {currentUser[0]?.toUpperCase()}
        </button>
        <button
          onClick={onOpenSettings}
          className="flex-1 text-left text-sm font-medium truncate"
          style={{ color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
        >
          {currentUser}
        </button>
        <a href="/qr" target="_blank" rel="noreferrer" title="QR code" className="icon-btn">
          <QrCode className="w-4 h-4" />
        </a>
        <button onClick={onOpenSettings} className="icon-btn" title="Settings">
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={onLogout}
          className="icon-btn"
          title="Sign out"
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

function ChannelRow({ label, active, isLog, canDelete, hasUnread, onClick, onDelete }: {
  label: string; active: boolean; isLog: boolean; canDelete: boolean;
  hasUnread: boolean; onClick: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`nav-row${active ? " active" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer" }}>
        <span className="nav-icon flex-shrink-0" style={{ color: active ? "var(--accent)" : isLog ? "#B45309" : "var(--text-dim)" }}>
          {isLog
            ? <ScrollText className="w-3.5 h-3.5" />
            : <Hash className="w-3.5 h-3.5" style={{ fontFamily: "var(--font-mono)" }} />
          }
        </span>
        <span
          className="nav-text truncate flex-1"
          style={{
            color: active ? "var(--accent)" : hasUnread ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: hasUnread || active ? 500 : 400,
            fontSize: "13px",
          }}
        >
          {label}
        </span>
      </button>
      {hasUnread && !hovered && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
      )}
      {canDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="icon-btn flex-shrink-0"
          style={{ width: "20px", height: "20px" }}
          title={`Delete #${label}`}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function DmRow({ label, active, badge, avBg, avFg, muted, onClick }: {
  label: string; active: boolean; badge?: number;
  avBg: string; avFg: string; muted?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`nav-row w-full${active ? " active" : ""}`}
      style={{ background: active ? "var(--accent-light)" : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
    >
      <div className="av relative flex-shrink-0" style={{ width: "22px", height: "22px", background: avBg, color: avFg, fontSize: "9px" }}>
        {label[0]?.toUpperCase()}
        {!muted && <span className="online-dot" style={{ borderColor: "var(--sidebar-bg)" }} />}
      </div>
      <span
        className="nav-text truncate flex-1"
        style={{
          fontSize: "13px",
          color: active ? "var(--accent)" : muted ? "var(--text-dim)" : "var(--text-muted)",
          fontWeight: active ? 500 : 400,
        }}
      >
        {label}
      </span>
      {badge ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500, color: "#fff", background: "var(--accent)", padding: "1px 6px", borderRadius: "10px" }}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}
