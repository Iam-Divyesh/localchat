import { Pin, X } from "lucide-react";
import { Message } from "../hooks/useChat";

interface Props {
  pinned: Message;
  onUnpin: () => void;
  onScrollTo?: () => void;
}

export default function PinnedBanner({ pinned, onUnpin }: Props) {
  return (
    <div 
      className="flex items-center gap-3 px-6 py-3 glass-panel"
      style={{ borderBottom: "1px solid var(--glass-border)" }}
    >
      <Pin className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold mr-2" style={{ color: "var(--accent)" }}>
          {pinned.username}
        </span>
        <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
          {pinned.text.slice(0, 80)}
        </span>
      </div>
      <button 
        onClick={onUnpin}
        className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        title="Unpin"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
