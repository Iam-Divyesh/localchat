import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Smile, X, CornerUpLeft } from "lucide-react";
import { UploadProgress } from "../hooks/useFiles";
import { fileListToArray } from "../lib/fileChunker";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

interface Props {
  onSend: (text: string) => void;
  onTyping: () => void;
  onFiles: (files: File[]) => void;
  uploads: UploadProgress[];
  placeholder?: string;
  disableFiles?: boolean;
  disabled?: boolean;
  replyTo?: { id: string; username: string; text: string } | null;
  onCancelReply?: () => void;
}

export default function ChatInput({ 
  onSend, onTyping, onFiles, uploads, placeholder, disableFiles, disabled, replyTo, onCancelReply 
}: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    if (ref.current) { 
      ref.current.style.height = "auto"; 
      ref.current.focus(); 
    }
  };

  const handleFiles = useCallback((files: File[]) => {
    if (!disableFiles && files.length) onFiles(files);
  }, [disableFiles, onFiles]);

  // Clipboard paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        handleFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  const handleEmojiClick = (data: EmojiClickData) => {
    setText((prev) => prev + data.emoji);
    ref.current?.focus();
  };

  // Drag and drop
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setDraggingOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setDraggingOver(false);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDraggingOver(false);
    handleFiles(fileListToArray(e.dataTransfer.files));
  };

  return (
    <div className="px-6 pb-6 pt-2 relative z-10">
      {/* Reply preview */}
      {replyTo && (
        <div 
          className="flex items-center gap-3 mb-3 px-4 py-3 rounded-xl"
          style={{ background: "var(--accent-dim)", borderLeft: "3px solid var(--accent)" }}
        >
          <CornerUpLeft className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{replyTo.username}</span>
            <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{replyTo.text.slice(0, 80)}</p>
          </div>
          <button 
            onClick={onCancelReply} 
            className="flex-shrink-0 p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2 mb-3">
          {uploads.map((u) => (
            <div key={u.fileId} className="flex items-center gap-3">
              <div 
                className="flex-1 rounded-full overflow-hidden" 
                style={{ height: "4px", background: "rgba(255,255,255,0.1)" }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${(u.sent / u.total) * 100}%`, background: "var(--accent)" }} 
                />
              </div>
              <span className="text-sm truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>
                {u.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input bar - frosted glass */}
      <div
        className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-200 relative"
        style={{
          background: disabled 
            ? "rgba(255,255,255,0.02)" 
            : draggingOver 
              ? "var(--accent-dim)" 
              : "rgba(40, 40, 40, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${
            disabled 
              ? "var(--glass-border)" 
              : draggingOver 
                ? "var(--accent)" 
                : focused 
                  ? "rgba(255,255,255,0.15)" 
                  : "var(--glass-border)"
          }`,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : undefined,
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Drag overlay */}
        {draggingOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl pointer-events-none z-10">
            <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              Drop files to attach
            </span>
          </div>
        )}

        {/* Emoji button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={disabled}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0"
            style={{ 
              color: showEmoji ? "var(--accent)" : "var(--text-muted)",
              background: showEmoji ? "var(--accent-dim)" : "transparent",
            }}
            onMouseEnter={(e) => !disabled && (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => !disabled && !showEmoji && (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Smile className="w-5 h-5" />
          </button>
          
          {showEmoji && (
            <div ref={emojiRef} className="absolute bottom-full left-0 mb-2 z-50">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={handleEmojiClick}
                width={320}
                height={400}
                searchDisabled={false}
                skinTonesDisabled
                lazyLoadEmojis
              />
            </div>
          )}
        </div>

        {/* File attach button */}
        {!disableFiles && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => !disabled && (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => !disabled && (e.currentTarget.style.color = "var(--text-muted)")}
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { handleFiles(fileListToArray(e.target.files)); e.target.value = ""; }}
            />
          </>
        )}

        {/* Text input */}
        <textarea
          ref={ref}
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            onTyping();
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { 
              e.preventDefault(); 
              submit(); 
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={draggingOver ? "" : (placeholder ?? "Messages")}
          className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed max-h-[120px] overflow-y-auto py-1.5"
          style={{ color: "#fff", opacity: draggingOver ? 0 : 1 }}
        />

        {/* Send button */}
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: text.trim() ? "var(--accent)" : "rgba(255,255,255,0.06)",
            color: text.trim() ? "#fff" : "var(--text-muted)",
            cursor: text.trim() && !disabled ? "pointer" : "not-allowed",
            boxShadow: text.trim() ? "0 0 20px var(--accent-glow)" : "none",
          }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
