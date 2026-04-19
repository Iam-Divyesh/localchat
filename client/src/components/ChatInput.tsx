import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Send, Paperclip, Smile, X, CornerUpLeft, Plus } from "lucide-react";
import { UploadProgress } from "../hooks/useFiles";
import { fileListToArray } from "../lib/fileChunker";
import EmojiPickerPanel from "./EmojiPickerPanel";

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
  const [draggingOver, setDraggingOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number } | null>(null);
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
      if (
        emojiRef.current && !emojiRef.current.contains(e.target as Node) &&
        emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)
      ) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
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
    <div className="px-4 pt-2 pb-safe sm:px-6" style={{ background: "var(--bg)", flexShrink: 0 }}>
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

        {/* Mobile "+" toggle — hidden on md+ */}
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          disabled={disabled}
          className="md:hidden icon-btn flex-shrink-0"
          style={{ color: showExtras ? "var(--accent)" : "var(--text-muted)", background: showExtras ? "var(--accent-light)" : "transparent" }}
        >
          {showExtras ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>

        {/* Emoji button — always on md+, toggle on mobile */}
        <div className={showExtras ? "" : "hidden md:block"}>
          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => {
              if (!showEmoji && emojiBtnRef.current) {
                const rect = emojiBtnRef.current.getBoundingClientRect();
                const pickerH = 370;
                const pickerW = 324;
                const top = rect.top - pickerH - 8 < 0
                  ? rect.bottom + 8
                  : rect.top - pickerH - 8;
                const left = Math.min(rect.left, window.innerWidth - pickerW - 8);
                setEmojiPos({ top, left });
              }
              setShowEmoji((v) => !v);
            }}
            disabled={disabled}
            className="icon-btn flex-shrink-0"
            style={{ color: showEmoji ? "var(--accent)" : "var(--text-muted)", background: showEmoji ? "var(--accent-light)" : "transparent" }}
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        {/* Emoji picker — rendered in a portal so it escapes all stacking contexts */}
        {showEmoji && emojiPos && createPortal(
          <div
            ref={emojiRef}
            style={{
              position: "fixed",
              top: emojiPos.top,
              left: emojiPos.left,
              zIndex: 99999,
              maxWidth: "calc(100vw - 1rem)",
            }}
          >
            <EmojiPickerPanel onEmojiClick={handleEmojiClick} />
          </div>,
          document.body
        )}

        {/* File attach button — always on md+, toggle on mobile */}
        {!disableFiles && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`icon-btn flex-shrink-0 ${showExtras ? "" : "hidden md:flex"}`}
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
