import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Hash } from "lucide-react";
import { Message } from "../hooks/useChat";
import { formatTime } from "../lib/fileChunker";

interface Props {
  onSearch: (query: string) => Promise<Array<{ room: string; msg: Message }>>;
  onNavigate: (room: string) => void;
  onClose: () => void;
}

export default function SearchModal({ onSearch, onNavigate, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ room: string; msg: Message }>>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    onSearch(q).then((r) => { setResults(r); setSearching(false); }).catch(() => setSearching(false));
  }, [onSearch]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden glass-card animate-slide-up"
      >
        {/* Search input */}
        <div 
          className="flex items-center gap-4 px-5 py-4"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-base focus:outline-none"
            style={{ color: "#fff" }}
          />
          {searching && <div className="spinner" style={{ width: "20px", height: "20px" }} />}
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.trim() && !searching && (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No messages found for "{query}"
            </p>
          )}
          {results.length === 0 && !query.trim() && (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Type to search across all channels
            </p>
          )}
          {results.map(({ room, msg }) => (
            <button
              key={msg.id}
              onClick={() => { onNavigate(room); onClose(); }}
              className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
              style={{ borderBottom: "1px solid var(--glass-border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                <Hash className="w-4 h-4" />
                <span className="text-xs">{room}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{msg.username}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatTime(msg.timestamp)}</span>
                </div>
                <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{msg.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
