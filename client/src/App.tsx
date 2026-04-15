import { useState, useEffect, useCallback, useRef } from "react";
import AuthScreen from "./components/AuthScreen";
import JoinScreen from "./components/JoinScreen";
import Sidebar from "./components/Sidebar";
import MessageList from "./components/MessageList";
import ChatInput from "./components/ChatInput";
import PinnedBanner from "./components/PinnedBanner";
import SearchModal from "./components/SearchModal";
import UserProfileModal from "./components/UserProfileModal";
import SettingsModal from "./components/SettingsModal";
import { useChat } from "./hooks/useChat";
import { useFiles } from "./hooks/useFiles";
import { useSocketStatus } from "./hooks/useSocket";
import { initSocket, disconnectSocket } from "./lib/socket";
import { getMe, logout, AuthUser } from "./lib/api";
import { dmRoomKey } from "./lib/dmRoom";
import { Search, Menu } from "lucide-react";

type ActiveView =
  | { type: "room"; room: string }
  | { type: "dm"; roomId: string; peer: string };

type AppState = "loading" | "auth" | "join" | "chat";

export default function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; text: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [profileUser, setProfileUser] = useState<{ username: string; email?: string; online: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => localStorage.getItem("lc_sound") !== "false");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mount — check for existing session
  useEffect(() => {
    const stored = localStorage.getItem("lc_token");
    if (!stored) { setAppState("auth"); return; }

    getMe(stored).then((user) => {
      if (!user) {
        localStorage.removeItem("lc_token");
        setAppState("auth");
        return;
      }
      setToken(stored);
      setAuthUser(user);
      initSocket(stored);
      const lastRoom = sessionStorage.getItem("lc_room");
      if (lastRoom) {
        setRoom(lastRoom);
        setActiveView({ type: "room", room: lastRoom });
        setAppState("chat");
      } else {
        setAppState("join");
      }
    });
  }, []);

  const handleAuth = useCallback((t: string, user: AuthUser) => {
    setToken(t);
    setAuthUser(user);
    initSocket(t);
    setAppState("join");
  }, []);

  const handleJoin = useCallback((r: string) => {
    sessionStorage.setItem("lc_room", r);
    setRoom(r);
    setActiveView({ type: "room", room: r });
    setAppState("chat");
  }, []);

  const handleLogout = useCallback(async () => {
    if (token) await logout(token).catch(() => {});
    localStorage.removeItem("lc_token");
    sessionStorage.removeItem("lc_room");
    disconnectSocket();
    setToken(null);
    setAuthUser(null);
    setRoom(null);
    setActiveView(null);
    setAppState("auth");
  }, [token]);

  // Handle socket auth errors (expired/invalid token) — force logout
  useEffect(() => {
    const handler = () => handleLogout();
    window.addEventListener("lc:auth_error", handler);
    return () => window.removeEventListener("lc:auth_error", handler);
  }, [handleLogout]);

  const connected = useSocketStatus();
  const username = authUser?.username ?? null;

  // When a channel is deleted, redirect to general if we're in it
  const handleChannelDeleted = useCallback((name: string) => {
    if (room === name) {
      sessionStorage.setItem("lc_room", "general");
      setRoom("general");
      setActiveView({ type: "room", room: "general" });
    }
  }, [room]);

  const {
    messages, allUsers, typingUsers,
    channels, unreadChannels, createChannel, deleteChannel,
    sendMessage, sendDm, notifyTyping, notifyDmTyping,
    toggleReaction, clearChannelUnread,
    getFileById, dms, clearDmUnread,
    mentions, dismissMention,
    pinnedMessage, pinMsg, unpinMsg,
    searchMsgs, getUserProfile, deleteMsg, loadMoreMessages,
  } = useChat(appState === "chat" ? room : null, username, handleChannelDeleted);

  const { uploadFile, downloadFile, fetchBlob, uploads } = useFiles();

  // Notification sound — play a soft beep on new message / mention
  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* AudioContext not available */ }
  }, [soundEnabled]);

  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (appState !== "chat") return;
    const total = messages.length;
    if (prevMsgCount.current > 0 && total > prevMsgCount.current) {
      const newest = messages[messages.length - 1];
      if (newest?.username !== username) playSound();
    }
    prevMsgCount.current = total;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChangeRoom = useCallback((newRoom: string) => {
    sessionStorage.setItem("lc_room", newRoom);
    setRoom(newRoom);
    setActiveView({ type: "room", room: newRoom });
    clearChannelUnread(newRoom);
    setSidebarOpen(false);
  }, [clearChannelUnread]);

  const handleOpenDm = useCallback((peer: string) => {
    const roomId = dmRoomKey(username ?? "", peer);
    clearDmUnread(roomId);
    setActiveView({ type: "dm", roomId, peer });
    setSidebarOpen(false);
  }, [username, clearDmUnread]);

  const handleFiles = useCallback((files: File[]) => {
    if (!activeView) return;
    const roomId = activeView.type === "dm" ? activeView.roomId : activeView.room;
    for (const f of files) uploadFile(f, roomId).catch((err) => alert(`Upload failed: ${err.message}`));
  }, [uploadFile, activeView]);

  const handleSend = useCallback((text: string) => {
    if (!activeView) return;
    if (activeView.type === "room") sendMessage(text, replyTo ?? undefined);
    else sendDm(activeView.peer, text, replyTo ?? undefined);
    setReplyTo(null);
  }, [activeView, sendMessage, sendDm, replyTo]);

  const handleTyping = useCallback(() => {
    if (!activeView) return;
    if (activeView.type === "room") notifyTyping();
    else notifyDmTyping(activeView.peer);
  }, [activeView, notifyTyping, notifyDmTyping]);

  const handleReaction = useCallback((msgId: string, emoji: string) => {
    if (!activeView) return;
    const roomId = activeView.type === "dm" ? activeView.roomId : (room ?? "general");
    toggleReaction(roomId, msgId, emoji);
  }, [activeView, room, toggleReaction]);

  const handlePin = useCallback((msgId: string) => {
    if (!room || activeView?.type === "dm") return;
    pinMsg(room, msgId);
  }, [room, activeView, pinMsg]);

  const handleDelete = useCallback((msgId: string) => {
    if (!activeView) return;
    const roomId = activeView.type === "dm" ? activeView.roomId : (room ?? "general");
    deleteMsg(roomId, msgId);
  }, [activeView, room, deleteMsg]);

  const handleLoadMore = useCallback(() => {
    if (!room || !messages.length || activeView?.type === "dm") return Promise.resolve([]);
    return loadMoreMessages(room, messages[0].timestamp);
  }, [room, messages, activeView, loadMoreMessages]);

  const handleSoundToggle = useCallback((v: boolean) => {
    setSoundEnabled(v);
    localStorage.setItem("lc_sound", v ? "true" : "false");
  }, []);

  const handleUsernameChanged = useCallback((newUsername: string) => {
    setAuthUser((prev) => prev ? { ...prev, username: newUsername } : prev);
  }, []);

  const handleProfileClick = useCallback(async (targetUsername: string) => {
    const profile = await getUserProfile(targetUsername);
    setProfileUser({ username: targetUsername, email: profile?.email, online: profile?.online ?? false });
  }, [getUserProfile]);

  // Keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Render states ──────────────────────────────────────────

  if (appState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (appState === "auth") {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (appState === "join" || !activeView || !room) {
    return (
      <JoinScreen
        username={username ?? ""}
        onJoin={handleJoin}
        onLogout={handleLogout}
      />
    );
  }

  const isDm = activeView.type === "dm";
  const isLogChannel = !isDm && room === "log";
  const dmConvo = isDm ? dms.get(activeView.roomId) : undefined;
  const visibleMessages = isDm ? (dmConvo?.messages ?? []) : messages;
  const dmTypingUsers = isDm && dmConvo?.peerTyping ? [activeView.peer] : [];
  const headerTitle = isDm ? `@ ${activeView.peer}` : `# ${room}`;
  const headerSub = isLogChannel
    ? "Activity log · read-only · session only"
    : isDm ? "Direct message · session only" : "Channel · messages not stored on internet";

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: "#0a0a0a", color: "#fff" }}
    >
      {/* Depth blob for 3D glass effect */}
      <div className="depth-blob" />
      <div className="ambient-glow" />
      <div className="ambient-glow-2" />

      {showSearch && (
        <SearchModal
          onSearch={searchMsgs}
          onNavigate={handleChangeRoom}
          onClose={() => setShowSearch(false)}
        />
      )}
      {profileUser && (
        <UserProfileModal
          username={profileUser.username}
          email={profileUser.email}
          online={profileUser.online}
          onClose={() => setProfileUser(null)}
        />
      )}
      {showSettings && token && authUser && (
        <SettingsModal
          token={token}
          currentUsername={authUser.username}
          email={authUser.email}
          soundEnabled={soundEnabled}
          onSoundToggle={handleSoundToggle}
          onUsernameChanged={handleUsernameChanged}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transition-transform duration-200
        md:relative md:translate-x-0 md:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Sidebar
          room={room}
          channels={channels}
          unreadChannels={unreadChannels}
          allUsers={allUsers}
          currentUser={username ?? ""}
          dms={dms}
          activeView={activeView}
          onChangeRoom={handleChangeRoom}
          onCreateChannel={createChannel}
          onDeleteChannel={deleteChannel}
          onOpenDm={handleOpenDm}
          onLogout={handleLogout}
          connected={connected}
          mentions={mentions}
          onDismissMention={dismissMention}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
        {/* Channel/DM header - glass panel */}
        <div 
          className="flex items-center gap-3 px-4 py-3 glass-panel"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex-shrink-0 p-2 rounded-xl btn-glass"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base tracking-tight truncate" style={{ color: "#fff" }}>
              {headerTitle}
            </h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{headerSub}</p>
          </div>
          {!isDm && (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-xl btn-glass flex items-center gap-2 flex-shrink-0"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs hidden sm:block">Ctrl+K</span>
            </button>
          )}
        </div>

        {/* Pinned message banner */}
        {!isDm && pinnedMessage && (
          <PinnedBanner
            pinned={pinnedMessage}
            onUnpin={() => room && unpinMsg(room)}
          />
        )}

        <MessageList
          messages={visibleMessages}
          currentUser={username ?? ""}
          typingUsers={isDm ? dmTypingUsers : typingUsers}
          getFileById={getFileById}
          onDownload={downloadFile}
          onFetchBlob={fetchBlob}
          onReact={handleReaction}
          onReply={setReplyTo}
          onPin={!isDm && !isLogChannel ? handlePin : undefined}
          onDelete={handleDelete}
          onProfileClick={handleProfileClick}
          onLoadMore={!isDm && !isLogChannel ? handleLoadMore : undefined}
          isLog={!isDm && room === "log"}
        />

        <ChatInput
          onSend={handleSend}
          onTyping={handleTyping}
          onFiles={handleFiles}
          uploads={uploads}
          placeholder={isLogChannel ? "This channel is read-only" : isDm ? `Message ${activeView.peer}…` : `Message #${room}…`}
          disableFiles={isLogChannel}
          disabled={isLogChannel}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </main>
    </div>
  );
}
