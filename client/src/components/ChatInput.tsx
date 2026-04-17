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
    <div className="px-4 pb-5 pt-2 sm:px-6" style={{ background: "var(--bg)", flexShrink: 0 }}>
      {/* Reply preview */}
      {replyTo && (
        <div
          className="flex items-center gap-3 mb-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--accent-light)", borderLeft: "3px solid var(--accent)" }}
        >
          <CornerUpLeft className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{replyTo.username}</span>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{replyTo.text.slice(0, 80)}</p>
          </div>
          <button onClick={onCancelReply} className="icon-btn" style={{ width: "20px", height: "20px", flexShrink: 0 }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {uploads.map((u) => (
            <div key={u.fileId} className="flex items-center gap-3">
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: "3px", background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${(u.sent / u.total) * 100}%`, background: "var(--accent)" }}
                />
              </div>
              <span className="text-xs truncate max-w-[150px]" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {u.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        className={`chat-input-wrap${draggingOver ? " drag-over" : ""}`}
        style={{ opacity: disabled ? 0.6 : 1, position: "relative" }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {draggingOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none z-10">
            <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>Drop files to attach</span>
          </div>
        )}

        {/* Emoji button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={disabled}
            className="icon-btn flex-shrink-0"
            style={{ color: showEmoji ? "var(--accent)" : "var(--text-muted)", background: showEmoji ? "var(--accent-light)" : "transparent" }}
          >
            <Smile className="w-4 h-4" />
          </button>
          {showEmoji && (
            <div ref={emojiRef} className="absolute bottom-full left-0 mb-2 z-50">
              <EmojiPicker
                theme={Theme.LIGHT}
                onEmojiClick={handleEmojiClick}
                width={300}
                height={380}
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
              className="icon-btn flex-shrink-0"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
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
          placeholder={draggingOver ? "" : (placeholder ?? "Message…")}
          className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed max-h-[120px] overflow-y-auto py-1"
          style={{ color: "var(--text-primary)", opacity: draggingOver ? 0 : 1, fontFamily: "var(--font-ui)", caretColor: "var(--accent)" }}
        />

        {/* Send button */}
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="send-btn flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      <p className="mt-1.5 text-right" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)" }}>
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
