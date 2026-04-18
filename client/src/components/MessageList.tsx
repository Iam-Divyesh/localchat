import { useEffect, useRef, memo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Message, FileAvailable } from "../hooks/useChat";
import { formatTime, FILE_MESSAGE_PREFIX } from "../lib/fileChunker";
import FileCard from "./FileCard";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Reply, SmilePlus, Pin, Copy, Check, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  messages: Message[];
  currentUser: string;
  typingUsers: string[];
  getFileById: (id: string) => FileAvailable | undefined;
  onDownload: (fileId: string, name: string, mimeType: string, totalChunks: number) => Promise<void>;
  onFetchBlob: (fileId: string, mimeType: string, totalChunks: number) => Promise<string>;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (replyTo: { id: string; username: string; text: string }) => void;
  onPin?: (msgId: string) => void;
  onDelete?: (msgId: string) => void;
  onProfileClick?: (username: string) => void;
  onLoadMore?: () => Promise<Message[]>;
  isLog?: boolean;
}

function fallbackCopy(text: string, setCopied: (v: boolean) => void) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch { /* silent */ }
  document.body.removeChild(ta);
}

function CtxItem({ icon, label, onClick, success, danger }: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void; 
  success?: boolean; 
  danger?: boolean 
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
      style={{ color: success ? "var(--success)" : danger ? "var(--error)" : "var(--text-muted)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#FEF2F2" : "var(--border-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

function MsgContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }: { className?: string; children?: React.ReactNode }) {
          const isInline = !className;
          const code = String(children ?? "").replace(/\n$/, "");
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded text-sm"
                style={{
                  background: "var(--border-soft)",
                  color: "var(--accent)",
                }}
              >
                {children}
              </code>
            );
          }
          return (
            <pre
              className="rounded-xl p-3 text-sm my-2 overflow-x-auto"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <code>{code}</code>
            </pre>
          );
        },
        p({ children }) {
          return <p className="leading-relaxed">{highlightMentions(children)}</p>;
        },
        a({ href, children }) {
          return (
            <a 
              href={href} 
              target="_blank" 
              rel="noreferrer"
              className="underline underline-offset-2"
              style={{ color: "var(--accent)" }}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function highlightMentions(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) =>
      part.startsWith("@")
        ? <span key={i} className="font-semibold" style={{ color: "var(--accent)" }}>{part}</span>
        : part
    );
  }
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{highlightMentions(c)}</span>);
  return children;
}

const MsgBubble = memo(function MsgBubble({
  msg, isMe, currentUser, getFileById, onDownload, onFetchBlob, onReact, onReply, onPin, onDelete, onProfileClick,
}: {
  msg: Message;
  isMe: boolean;
  currentUser: string;
  getFileById: (id: string) => FileAvailable | undefined;
  onDownload: Props["onDownload"];
  onFetchBlob: Props["onFetchBlob"];
  onReact: Props["onReact"];
  onReply: Props["onReply"];
  onPin?: Props["onPin"];
  onDelete?: Props["onDelete"];
  onProfileClick?: Props["onProfileClick"];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const menuW = 180, menuH = 140;
    const x = e.clientX + menuW > window.innerWidth ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > window.innerHeight ? e.clientY - menuH : e.clientY;
    setCtxMenu({ x, y });
  }, []);

  const handleEmojiClick = useCallback((data: EmojiClickData) => {
    onReact(msg.id, data.emoji);
    setShowPicker(false);
  }, [msg.id, onReact]);

  const handleCopy = useCallback(() => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg.text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => fallbackCopy(msg.text, setCopied));
    } else {
      fallbackCopy(msg.text, setCopied);
    }
    setCtxMenu(null);
  }, [msg.text]);

  if (msg.type === "system") {
    if (msg.text.startsWith(FILE_MESSAGE_PREFIX)) {
      const file = getFileById(msg.text.slice(FILE_MESSAGE_PREFIX.length));
      if (!file) return null;
      return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"} my-2 msg-enter-${isMe ? "right" : "left"}`}>
          <FileCard file={file} onDownload={onDownload} onFetchBlob={onFetchBlob} />
        </div>
      );
    }
    return (
      <div className="flex justify-center my-3 animate-fade-in">
        <span 
          className="text-xs px-4 py-1.5 rounded-full"
          style={{ background: "var(--border-soft)", color: "var(--text-muted)" }}
        >
          {msg.text}
        </span>
      </div>
    );
  }

  const reactions = msg.reactions ?? {};
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div
      className={`flex ${isMe ? "justify-end msg-enter-right" : "justify-start msg-enter-left"} mb-3 group relative`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar for other users */}
      {!isMe && (
        <button
          onClick={() => onProfileClick?.(msg.username)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mr-3 mt-1"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          {msg.username[0]?.toUpperCase()}
        </button>
      )}

      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`} style={{ maxWidth: "75%", minWidth: 0, overflow: "hidden" }}>
        {/* Username and time for others */}
        {!isMe && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <button
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--text-primary)" }}
              onClick={() => onProfileClick?.(msg.username)}
            >
              {msg.username}
            </button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
        )}

        {/* Reply context */}
        {msg.replyTo && (
          <div 
            className="flex items-center gap-2 mb-1 px-3 py-1.5 rounded-xl max-w-full"
            style={{ background: "var(--accent-light)", borderLeft: "2px solid var(--accent)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
              {msg.replyTo.username}
            </span>
            <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {msg.replyTo.text.slice(0, 60)}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div className="relative">
          <div
            className={`bubble ${isMe ? "bubble-out" : "bubble-in"} text-sm`}
            onContextMenu={handleContextMenu}
            style={{ cursor: "context-menu" }}
          >
            <MsgContent text={msg.text} />
          </div>

          {/* Hover actions */}
          {hovered && (
            <div
              className={`absolute top-0 flex items-center gap-1 ${isMe ? "right-full mr-2" : "left-full ml-2"}`}
            >
              {onPin && (
                <button
                  onClick={() => onPin(msg.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center btn-glass"
                  title="Pin"
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center btn-glass"
                  title="React"
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {showPicker && (
                  <div
                    ref={pickerRef}
                    className="absolute z-50"
                    style={{ [isMe ? "right" : "left"]: 0, bottom: "110%" }}
                  >
                    <EmojiPicker
                      theme={Theme.DARK}
                      onEmojiClick={handleEmojiClick}
                      width={300}
                      height={350}
                      searchDisabled={false}
                      skinTonesDisabled
                      lazyLoadEmojis
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Context menu */}
        {ctxMenu && createPortal(
          <div
            className="fixed z-[9999] rounded-xl overflow-hidden py-1"
            style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: "160px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CtxItem 
              icon={<Reply className="w-4 h-4" />} 
              label="Reply" 
              onClick={() => { onReply({ id: msg.id, username: msg.username, text: msg.text }); setCtxMenu(null); }} 
            />
            <CtxItem 
              icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} 
              label={copied ? "Copied!" : "Copy"} 
              onClick={handleCopy} 
              success={copied} 
            />
            {onPin && (
              <CtxItem 
                icon={<Pin className="w-4 h-4" />} 
                label="Pin" 
                onClick={() => { onPin(msg.id); setCtxMenu(null); }} 
              />
            )}
            {isMe && onDelete && (
              <>
                <div style={{ height: "1px", background: "var(--border)", margin: "4px 12px" }} />
                <CtxItem 
                  icon={<Trash2 className="w-4 h-4" />} 
                  label="Delete" 
                  onClick={() => { onDelete(msg.id); setCtxMenu(null); }} 
                  danger 
                />
              </>
            )}
          </div>,
          document.body
        )}

        {/* Reactions */}
        {hasReactions && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all"
                style={{
                  background: users.includes(currentUser) ? "var(--accent-light)" : "var(--border-soft)",
                  border: `1px solid ${users.includes(currentUser) ? "var(--accent)" : "var(--border)"}`,
                  color: users.includes(currentUser) ? "var(--accent)" : "var(--text-muted)",
                }}
                title={users.join(", ")}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Time for own messages */}
        {isMe && (
          <span className="text-xs mt-1 mr-1" style={{ color: "var(--text-muted)" }}>
            {formatTime(msg.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
});

export default function MessageList({ 
  messages, currentUser, typingUsers, getFileById, onDownload, onFetchBlob, 
  onReact, onReply, onPin, onDelete, onProfileClick, onLoadMore, isLog 
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingUsers.length]);

  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadingMore || noMore) return;
    setLoadingMore(true);
    const older = await onLoadMore();
    if (older.length === 0) setNoMore(true);
    setLoadingMore(false);
  }, [onLoadMore, loadingMore, noMore]);

  const otherTyping = typingUsers.filter((u) => u !== currentUser);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 relative z-10" style={{ display: "flex", flexDirection: "column" }}>
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center select-none">
          <div 
            className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
            style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <rect width="18" height="14" x="3" y="3" rx="2"/>
              <path d="m3 17 4-4h10"/>
            </svg>
          </div>
          <p className="text-base font-medium" style={{ color: "var(--text-muted)" }}>No messages yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Be the first to say something</p>
        </div>
      )}

      {/* Load older */}
      {onLoadMore && !isLog && messages.length > 0 && !noMore && (
        <div className="flex justify-center py-3">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm px-4 py-2 rounded-full"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "var(--font-ui)", cursor: "pointer" }}
          >
            {loadingMore ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}

      <div className="flex-1" />

      {isLog ? (
        <div className="space-y-1">
          {messages.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>No activity yet</p>
          )}
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className="flex items-baseline gap-3 py-2 px-3 rounded-lg animate-fade-in"
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                {formatTime(msg.timestamp)}
              </span>
              <span className="text-sm" style={{ color: "var(--warning)" }}>
                {msg.text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {messages.map((msg) => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              isMe={msg.username === currentUser}
              currentUser={currentUser}
              getFileById={getFileById}
              onDownload={onDownload}
              onFetchBlob={onFetchBlob}
              onReact={onReact}
              onReply={onReply}
              onPin={!isLog ? onPin : undefined}
              onDelete={!isLog ? onDelete : undefined}
              onProfileClick={onProfileClick}
            />
          ))}
        </div>
      )}

      {/* Typing indicator */}
      {otherTyping.length > 0 && (
        <div className="flex items-center gap-3 mt-3 animate-fade-in">
          <div 
            className="bubble bubble-in flex items-center gap-2"
            style={{ padding: "10px 16px" }}
          >
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {otherTyping.join(", ")}
            </span>
            <TypingDots />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
