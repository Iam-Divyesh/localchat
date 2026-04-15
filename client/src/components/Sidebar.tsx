import { useState } from "react";
import { Hash, Plus, User, Wifi, WifiOff, QrCode, LogOut, MessageSquare, X, Trash2, ScrollText, AtSign } from "lucide-react";
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
  activeView, onChangeRoom, onCreateChannel, onDeleteChannel, onOpenDm, onLogout, connected,
  mentions, onDismissMention, onOpenSettings,
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

  return (
    <aside 
      className="flex-shrink-0 flex flex-col h-full glass-panel relative z-20"
      style={{ width: "260px", borderRight: "1px solid var(--glass-border)" }}
    >
      {/* Logo header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div 
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <MessageSquare className="w-4 h-4" />
        </div>
        <span className="font-semibold text-base flex-1" style={{ color: "#fff" }}>
          LocalChat
        </span>
        <div className="flex items-center gap-1.5">
          {connected
            ? <Wifi className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
            : <WifiOff className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />}
          <span className="text-xs" style={{ color: connected ? "var(--success)" : "var(--error)" }}>
            {connected ? "Live" : "…"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {/* Channels */}
        <section className="mb-4">
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Channels
            </span>
            <button
              onClick={() => setShowChannelInput((v) => !v)}
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              title="New channel"
            >
              {showChannelInput ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          {showChannelInput && (
            <div className="px-4 pb-3 flex gap-2">
              <input
                autoFocus
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowChannelInput(false); }}
                placeholder="channel-name"
                className="flex-1 text-sm px-3 py-2 rounded-xl glass-input"
                style={{ color: "#fff" }}
              />
              <button
                onClick={handleCreate}
                className="text-sm font-medium px-4 py-2 rounded-xl"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Add
              </button>
            </div>
          )}

          {channels.map((c) => {
            const isActive = activeView.type === "room" && room === c;
            const isProtected = c === "general" || c === "log";
            const isLog = c === "log";
            const hasUnread = !isActive && unreadChannels.has(c);
            return (
              <ChannelItem
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
        </section>

        {/* Divider */}
        <div className="mx-5 mb-4" style={{ height: "1px", background: "var(--glass-border)" }} />

        {/* Direct Messages */}
        <section className="mb-4">
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Messages
            </span>
            {totalDmUnread > 0 && (
              <span 
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {totalDmUnread}
              </span>
            )}
          </div>

          {/* Active DM threads */}
          {[...dms.values()].map((dm) => (
            <NavItem
              key={dm.roomId}
              icon={<User className="w-4 h-4" />}
              label={dm.peer}
              active={activeView.type === "dm" && activeView.roomId === dm.roomId}
              badge={dm.unread}
              onClick={() => onOpenDm(dm.peer)}
            />
          ))}

          {/* Other users without DM threads */}
          {otherUsers.filter((u) => !dmPeers.has(u)).map((u) => (
            <NavItem
              key={u}
              icon={<User className="w-4 h-4" />}
              label={u}
              active={false}
              onClick={() => onOpenDm(u)}
              muted
            />
          ))}

          {otherUsers.length === 0 && (
            <p className="px-5 py-2 text-sm italic" style={{ color: "var(--text-ghost)" }}>
              No other users online
            </p>
          )}
        </section>

        {/* Divider */}
        <div className="mx-5 mb-4" style={{ height: "1px", background: "var(--glass-border)" }} />

        {/* Online users */}
        <section>
          <div className="px-5 py-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Online · {allUsers.length}
            </span>
          </div>
          {allUsers.map((u) => (
            <div key={u} className="flex items-center gap-3 px-5 py-2">
              <span 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ background: "var(--success)", boxShadow: "0 0 8px var(--success)" }} 
              />
              <span 
                className="text-sm truncate" 
                style={{ color: u === currentUser ? "var(--accent)" : "var(--text-secondary)" }}
              >
                {u}{u === currentUser && " · you"}
              </span>
            </div>
          ))}
        </section>
      </div>

      {/* Mentions panel */}
      {mentions.length > 0 && (
        <div 
          className="mx-4 mb-3 rounded-xl overflow-hidden"
          style={{ background: "var(--accent-dim)", border: "1px solid rgba(138, 180, 248, 0.2)" }}
        >
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <AtSign className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
              Mentions
            </span>
          </div>
          {mentions.slice(-3).map((m) => (
            <div key={m.msgId} className="flex items-start gap-2 px-4 py-2">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{m.from}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}> in #{m.room}</span>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{m.text}</p>
              </div>
              <button 
                onClick={() => onDismissMention(m.msgId)} 
                className="flex-shrink-0 p-1 rounded transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div 
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all"
          style={{ background: "var(--accent)", color: "#fff" }}
          title="Settings"
        >
          {currentUser[0]?.toUpperCase()}
        </button>
        <button 
          onClick={onOpenSettings} 
          className="text-sm font-medium truncate flex-1 text-left transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          {currentUser}
        </button>
        <a 
          href="/qr" 
          target="_blank" 
          rel="noreferrer" 
          title="QR code"
          className="p-2 rounded-xl btn-glass"
        >
          <QrCode className="w-4 h-4" />
        </a>
        <button 
          onClick={onLogout} 
          title="Sign out"
          className="p-2 rounded-xl transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

function ChannelItem({ label, active, isLog, canDelete, hasUnread, onClick, onDelete }: {
  label: string;
  active: boolean;
  isLog: boolean;
  canDelete: boolean;
  hasUnread: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all duration-150 ${active ? "nav-active" : ""}`}
      style={{ 
        background: active ? "var(--accent-dim)" : hovered ? "rgba(255,255,255,0.03)" : "transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onClick}>
        <span style={{ color: active ? "var(--accent)" : isLog ? "var(--warning)" : "var(--text-muted)" }}>
          {isLog ? <ScrollText className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
        </span>
        <span 
          className="truncate flex-1 text-sm"
          style={{ 
            color: active ? "var(--accent)" : isLog ? "var(--warning)" : hasUnread ? "#fff" : "var(--text-secondary)",
            fontWeight: hasUnread || active ? 600 : 400,
          }}
        >
          {label}
        </span>
      </button>
      {hasUnread && !hovered && (
        <span 
          className="w-2 h-2 rounded-full flex-shrink-0" 
          style={{ background: "var(--accent)" }} 
        />
      )}
      {canDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          title={`Delete #${label}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge, muted }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all duration-150 ${active ? "nav-active" : ""}`}
      style={{
        background: active ? "var(--accent-dim)" : "transparent",
        color: active ? "var(--accent)" : muted ? "var(--text-ghost)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => { 
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; 
      }}
      onMouseLeave={(e) => { 
        if (!active) e.currentTarget.style.background = "transparent"; 
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{icon}</span>
      <span className="truncate flex-1 text-sm">{label}</span>
      {badge ? (
        <span 
          className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
